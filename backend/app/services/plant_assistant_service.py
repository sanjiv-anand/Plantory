from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_settings import AISettings
from app.models.assistant_conversation import AssistantConversation
from app.models.assistant_memory import AssistantMemory, MemoryType
from app.models.assistant_message import AssistantMessage
from app.models.journal_entry import JournalEntry
from app.models.plant_story_cache import PlantStoryCache
from app.models.plant_event import PlantEventType
from app.prompts.assistant_system import DEFAULT_SYSTEM_PROMPT
from app.services.assistant_log_service import AssistantLogService
from app.services.context_assembler import ContextAssembler
from app.services.llm_service import (
    LLMResponseError,
    LLMService,
    LLMTimeoutError,
    LLMUnavailableError,
    llm_service,
)
from app.services.plant_context_tools import PlantContextTools
from app.services.retrieval_service import RetrievalService


class PlantAssistantService:
    def __init__(self, db: Session, llm: LLMService | None = None) -> None:
        self.db = db
        self.llm = llm or llm_service

    def get_settings(self) -> AISettings:
        row = self.db.get(AISettings, 1)
        if row:
            return row
        row = AISettings(
            id=1,
            assistant_enabled=settings.ai_assistant_enabled,
            daily_summary_enabled=settings.ai_daily_summary_enabled,
            story_enabled=settings.ai_story_enabled,
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
            model_display_name=settings.llm_model_display_name,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def update_settings(self, **kwargs: object) -> AISettings:
        row = self.get_settings()
        for key, value in kwargs.items():
            if value is not None and hasattr(row, key):
                setattr(row, key, value)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    async def status(self) -> dict:
        ai_settings = self.get_settings()
        online = await self.llm.is_available() if ai_settings.assistant_enabled else False
        return {
            "online": online,
            "assistant_enabled": ai_settings.assistant_enabled,
            "daily_summary_enabled": ai_settings.daily_summary_enabled,
            "story_enabled": ai_settings.story_enabled,
            "model": ai_settings.model_display_name,
            "runtime": "Local llama.cpp",
            "privacy": "Your plant conversations are processed locally on your server.",
            "max_tokens": ai_settings.max_tokens,
            "temperature": ai_settings.temperature,
        }

    async def get_context_preview(
        self,
        plant_id: int,
        *,
        query: str = "",
        journal_entry_id: int | None = None,
        current_page: str | None = None,
    ) -> dict:
        tools = PlantContextTools(self.db, plant_id)
        plant = tools.get_plant()
        retrieval = RetrievalService(self.db, plant_id).retrieve_context(
            query or "general status",
            journal_entry_id=journal_entry_id,
        )
        current_entry = self._load_journal_entry(plant_id, journal_entry_id)
        preferences = self._user_preferences()
        assembled = ContextAssembler.assemble(
            plant=plant,
            retrieval=retrieval,
            question=query or "(context preview)",
            current_date=date.today(),
            current_page=current_page,
            current_journal_entry=current_entry,
            user_preferences=preferences,
        )
        return {
            "sections": ContextAssembler.context_keys(retrieval, has_conversation=False),
            "plant_name": plant.get("name"),
            "memory_count": len(retrieval.memories),
            "journal_count": len(retrieval.journal_entries),
            "event_count": len(retrieval.events),
            "contradictions": retrieval.contradictions,
            "preview": assembled[:4000],
        }

    async def chat(
        self,
        plant_id: int,
        question: str,
        *,
        conversation_id: str | None = None,
        history: list[dict[str, str]] | None = None,
        stream: bool = False,
        journal_entry_id: int | None = None,
        current_page: str | None = None,
    ) -> dict | AsyncIterator[str]:
        ai_settings = self.get_settings()
        if not ai_settings.assistant_enabled:
            return self._error("AI_DISABLED", "Plantory Assistant is disabled.")

        log_service = AssistantLogService(self.db)
        applied_logs = log_service.try_apply_from_message(plant_id, question)

        tools = PlantContextTools(self.db, plant_id)
        plant = tools.get_plant()
        retrieval = RetrievalService(self.db, plant_id).retrieve_context(
            question,
            journal_entry_id=journal_entry_id,
        )
        current_entry = self._load_journal_entry(plant_id, journal_entry_id)
        preferences = self._user_preferences()

        conv_id = conversation_id or self._new_conversation_id()
        conversation_summary = self._get_conversation_summary(plant_id, conv_id)
        recent_turns = history or []

        context_block = ContextAssembler.assemble(
            plant=plant,
            retrieval=retrieval,
            question=question,
            current_date=date.today(),
            current_page=current_page,
            current_journal_entry=current_entry,
            conversation_summary=conversation_summary,
            recent_turns=recent_turns[-4:],
            user_preferences=preferences,
        )
        if applied_logs:
            log_lines = ["JOURNAL UPDATES JUST APPLIED (acknowledge these in your reply):"]
            for item in applied_logs:
                log_lines.append(f"- {item.summary}")
            context_block = context_block + "\n\n" + "\n".join(log_lines)

        context_keys = ContextAssembler.context_keys(
            retrieval,
            has_conversation=bool(conversation_summary or recent_turns),
        )
        if applied_logs:
            context_keys.append("journal_updates")

        messages = self._build_messages(context_block, recent_turns)
        self._store_message(plant_id, conv_id, "user", question)

        try:
            result = await self.llm.chat_completion(
                messages,
                max_tokens=ai_settings.max_tokens,
                temperature=max(ai_settings.temperature, 0.45),
                stream=stream,
            )
            if stream:
                return self._stream_with_persist(plant_id, conv_id, result, recent_turns, question)  # type: ignore[arg-type]
            assert isinstance(result, str)
            self._store_message(plant_id, conv_id, "assistant", result)
            await self._maybe_update_conversation_summary(plant_id, conv_id, recent_turns, question, result)
            return {
                "conversation_id": conv_id,
                "message": result,
                "context_used": context_keys,
                "actions_applied": [self._serialize_log_action(item) for item in applied_logs],
            }
        except LLMUnavailableError:
            return self._error("AI_UNAVAILABLE", "Plantory Assistant is currently unavailable.")
        except LLMTimeoutError:
            return self._error("AI_TIMEOUT", "Plantory Assistant timed out. Try a shorter question.")
        except LLMResponseError:
            return self._error("AI_ERROR", "Plantory Assistant could not produce a response.")

    async def generate_daily_summary(self, plant_id: int, target_date: date | None = None) -> dict:
        ai_settings = self.get_settings()
        if not ai_settings.daily_summary_enabled:
            return self._error("AI_DISABLED", "Daily summaries are disabled.")

        tools = PlantContextTools(self.db, plant_id)
        plant = tools.get_plant()
        day = target_date or date.today()
        entries = tools.get_entry(day)
        if not entries:
            return {"summary": None, "message": "No journal entries recorded for this day."}

        weather_parts = []
        for entry in entries:
            if entry.get("weather"):
                weather_parts.append(entry["weather"])

        context = {
            "plant": plant,
            "day": day.isoformat(),
            "entries": entries,
            "weather": weather_parts,
        }
        prompt = (
            "Write a brief daily summary (2-3 sentences) using ONLY the recorded entries and weather below. "
            "Do not invent observations. If something was not recorded, do not mention it."
        )
        messages = self._build_messages(
            f"PLANT DATA:\n{json.dumps(context, ensure_ascii=False, default=str)}\n\nUSER QUESTION:\n{prompt}",
            [],
        )
        try:
            summary = await self.llm.chat_completion(
                messages,
                max_tokens=min(ai_settings.max_tokens, 180),
                temperature=ai_settings.temperature,
            )
            assert isinstance(summary, str)
            return {"date": day.isoformat(), "summary": summary}
        except (LLMUnavailableError, LLMTimeoutError, LLMResponseError):
            return self._error("AI_UNAVAILABLE", "Plantory Assistant is currently unavailable.")

    async def generate_story(self, plant_id: int, *, force: bool = False) -> dict:
        ai_settings = self.get_settings()
        if not ai_settings.story_enabled:
            return self._error("AI_DISABLED", "Plant stories are disabled.")

        tools = PlantContextTools(self.db, plant_id)
        fingerprint = tools.data_fingerprint()
        cached = self.db.get(PlantStoryCache, plant_id)
        if cached and cached.data_hash == fingerprint and not force:
            return {"story": cached.content, "cached": True, "generated_at": cached.generated_at.isoformat()}

        timeline = tools.summarize_timeline(max_entries=25)
        if not timeline["recent_entries"] and not timeline["events"]:
            return {"story": None, "message": "Not enough recorded history to write a story yet."}

        context = {"plant": tools.get_plant(), "timeline": timeline}
        prompt = (
            "Write a short plant story (4-6 sentences) using ONLY the recorded timeline below. "
            "Mention planting date and milestones only if they appear in the data. Never invent missing milestones."
        )
        messages = self._build_messages(
            f"PLANT DATA:\n{json.dumps(context, ensure_ascii=False, default=str)}\n\nUSER QUESTION:\n{prompt}",
            [],
        )
        try:
            story = await self.llm.chat_completion(
                messages,
                max_tokens=min(ai_settings.max_tokens, 320),
                temperature=ai_settings.temperature,
            )
            assert isinstance(story, str)
            if cached:
                cached.content = story
                cached.data_hash = fingerprint
                cached.generated_at = datetime.now(UTC)
                self.db.add(cached)
            else:
                self.db.add(PlantStoryCache(plant_id=plant_id, content=story, data_hash=fingerprint))
            self.db.commit()
            return {"story": story, "cached": False}
        except (LLMUnavailableError, LLMTimeoutError, LLMResponseError):
            return self._error("AI_UNAVAILABLE", "Plantory Assistant is currently unavailable.")

    async def test_connection(self) -> dict:
        if not await self.llm.is_available():
            return self._error("AI_UNAVAILABLE", "Plantory Assistant is currently unavailable.")
        try:
            reply = await self.llm.chat_completion(
                [
                    {"role": "system", "content": "You are a test assistant."},
                    {"role": "user", "content": "Reply with exactly: Plantory local AI is online."},
                ],
                max_tokens=32,
                temperature=0,
            )
            assert isinstance(reply, str)
            return {"ok": True, "message": reply}
        except (LLMUnavailableError, LLMTimeoutError, LLMResponseError) as exc:
            return self._error("AI_ERROR", str(exc))

    def _load_journal_entry(self, plant_id: int, entry_id: int | None) -> dict | None:
        if not entry_id:
            return None
        entry = self.db.get(JournalEntry, entry_id)
        if not entry or entry.plant_id != plant_id:
            return None
        tools = PlantContextTools(self.db, plant_id)
        return tools._entry_dict(entry) | {"id": entry.id}

    def _user_preferences(self) -> list[dict]:
        stmt = (
            select(AssistantMemory)
            .where(
                AssistantMemory.plant_id.is_(None),
                AssistantMemory.memory_type == MemoryType.user_preference,
            )
            .order_by(AssistantMemory.updated_at.desc())
            .limit(10)
        )
        return [{"content": m.content, "id": m.id} for m in self.db.scalars(stmt)]

    def _get_conversation_summary(self, plant_id: int, conversation_id: str) -> str | None:
        row = self.db.scalar(
            select(AssistantConversation).where(AssistantConversation.conversation_id == conversation_id)
        )
        return row.summary if row else None

    async def _maybe_update_conversation_summary(
        self,
        plant_id: int,
        conversation_id: str,
        history: list[dict[str, str]],
        question: str,
        answer: str,
    ) -> None:
        total_turns = len(history) + 2
        if total_turns < 6:
            return
        if total_turns % 4 != 0:
            return

        plant = PlantContextTools(self.db, plant_id).get_plant()
        transcript = "\n".join(
            f"{item['role'].upper()}: {item['content'][:200]}"
            for item in (history[-4:] + [{"role": "user", "content": question}, {"role": "assistant", "content": answer}])
        )
        prompt = (
            f"Summarize this plant assistant conversation in 1-2 sentences. Plant: {plant.get('name')}.\n"
            "Focus on what the user is asking about. Do not invent facts.\n\n"
            f"{transcript}"
        )
        try:
            summary = await self.llm.chat_completion(
                [
                    {"role": "system", "content": "You write compact conversation summaries."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=80,
                temperature=0.2,
            )
            if not isinstance(summary, str):
                return
            row = self.db.scalar(
                select(AssistantConversation).where(AssistantConversation.conversation_id == conversation_id)
            )
            if row:
                row.summary = summary.strip()
                self.db.add(row)
            else:
                self.db.add(
                    AssistantConversation(
                        plant_id=plant_id,
                        conversation_id=conversation_id,
                        summary=summary.strip(),
                    )
                )
            self.db.commit()
        except (LLMUnavailableError, LLMTimeoutError, LLMResponseError):
            return

    def _build_messages(
        self,
        context_block: str,
        history: list[dict[str, str]],
    ) -> list[dict[str, str]]:
        system = settings.llm_system_prompt or DEFAULT_SYSTEM_PROMPT
        messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        for item in history[-4:]:
            role = item.get("role")
            content = item.get("content")
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append(
            {
                "role": "user",
                "content": (
                    f"{context_block}\n\n"
                    "Write your reply now. Sound like their journal companion, not a bot."
                ),
            }
        )
        return messages

    async def _stream_with_persist(
        self,
        plant_id: int,
        conversation_id: str,
        stream: AsyncIterator[str],
        history: list[dict[str, str]],
        question: str,
    ) -> AsyncIterator[str]:
        chunks: list[str] = []
        async for chunk in stream:
            chunks.append(chunk)
            yield chunk
        full = "".join(chunks)
        self._store_message(plant_id, conversation_id, "assistant", full)
        await self._maybe_update_conversation_summary(plant_id, conversation_id, history, question, full)

    def _store_message(self, plant_id: int, conversation_id: str, role: str, message: str) -> None:
        self.db.add(AssistantMessage(plant_id=plant_id, conversation_id=conversation_id, role=role, message=message))
        self.db.commit()

    @staticmethod
    def _new_conversation_id() -> str:
        import uuid

        return str(uuid.uuid4())

    @staticmethod
    def _serialize_log_action(item: object) -> dict:
        from app.services.assistant_log_service import AppliedLogAction

        assert isinstance(item, AppliedLogAction)
        return {
            "entry_id": item.entry_id,
            "date": item.target_date,
            "field": item.field,
            "value": item.value,
            "created": item.created,
            "summary": item.summary,
        }

    @staticmethod
    def _error(code: str, message: str) -> dict:
        return {"error": code, "message": message}
