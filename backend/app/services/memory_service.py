from __future__ import annotations

import json
import re
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.assistant_memory import (
    AssistantMemory,
    MemoryConfidence,
    MemorySourceType,
    MemoryType,
)
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.models.plant_event import PlantEvent, PlantEventType
from app.services.llm_service import LLMService, llm_service


class MemoryService:
    def __init__(self, db: Session, llm: LLMService | None = None) -> None:
        self.db = db
        self.llm = llm or llm_service

    def list_memories(self, *, plant_id: int | None = None) -> list[AssistantMemory]:
        stmt = select(AssistantMemory).order_by(AssistantMemory.plant_id.nulls_last(), AssistantMemory.updated_at.desc())
        if plant_id is not None:
            stmt = stmt.where(
                (AssistantMemory.plant_id == plant_id) | (AssistantMemory.plant_id.is_(None))
            )
        return list(self.db.scalars(stmt))

    def get_memory(self, memory_id: int) -> AssistantMemory | None:
        return self.db.get(AssistantMemory, memory_id)

    def create_memory(
        self,
        *,
        content: str,
        memory_type: MemoryType,
        source_type: MemorySourceType,
        plant_id: int | None = None,
        source_id: int | None = None,
        importance: int = 5,
        confidence: MemoryConfidence = MemoryConfidence.high,
        auto_generated: bool = False,
    ) -> AssistantMemory:
        memory = AssistantMemory(
            plant_id=plant_id,
            memory_type=memory_type,
            content=content.strip(),
            source_type=source_type,
            source_id=source_id,
            importance=importance,
            confidence=confidence,
            auto_generated=auto_generated,
        )
        self.db.add(memory)
        self.db.commit()
        self.db.refresh(memory)
        return memory

    def update_memory(self, memory_id: int, *, content: str | None = None, importance: int | None = None) -> AssistantMemory | None:
        memory = self.db.get(AssistantMemory, memory_id)
        if not memory:
            return None
        if content is not None:
            memory.content = content.strip()
            memory.auto_generated = False
        if importance is not None:
            memory.importance = importance
        self.db.add(memory)
        self.db.commit()
        self.db.refresh(memory)
        return memory

    def delete_memory(self, memory_id: int) -> bool:
        memory = self.db.get(AssistantMemory, memory_id)
        if not memory:
            return False
        self.db.delete(memory)
        self.db.commit()
        return True

    def forget_all(self) -> int:
        result = self.db.execute(delete(AssistantMemory))
        self.db.commit()
        return result.rowcount or 0

    def invalidate_for_journal_entry(self, entry_id: int) -> int:
        stmt = delete(AssistantMemory).where(
            AssistantMemory.source_type == MemorySourceType.journal_entry,
            AssistantMemory.source_id == entry_id,
        )
        result = self.db.execute(stmt)
        self.db.commit()
        return result.rowcount or 0

    def validate_sources(self) -> int:
        """Remove memories whose journal source no longer exists."""
        removed = 0
        stmt = select(AssistantMemory).where(
            AssistantMemory.source_type == MemorySourceType.journal_entry,
            AssistantMemory.source_id.is_not(None),
        )
        for memory in self.db.scalars(stmt):
            if not self.db.get(JournalEntry, memory.source_id):
                self.db.delete(memory)
                removed += 1
        if removed:
            self.db.commit()
        return removed

    async def extract_from_journal_entry(self, entry_id: int, *, use_llm: bool = True) -> list[AssistantMemory]:
        entry = self.db.get(JournalEntry, entry_id)
        if not entry:
            return []

        self.invalidate_for_journal_entry(entry_id)
        created: list[AssistantMemory] = []

        rule_based = self._rule_extract(entry)
        for item in rule_based:
            memory = self._persist_if_new(item, entry)
            if memory:
                created.append(memory)

        if use_llm and entry.memory and len(entry.memory.strip()) > 40:
            llm_items = await self._llm_extract(entry)
            for item in llm_items:
                if item.get("confidence") != MemoryConfidence.high.value:
                    continue
                memory = self._persist_if_new(item, entry)
                if memory:
                    created.append(memory)

        self.db.commit()
        return created

    def rebuild_memories(self, *, plant_id: int | None = None) -> dict[str, int]:
        """Clear generated memories and rebuild from canonical sources."""
        stmt = delete(AssistantMemory).where(AssistantMemory.auto_generated.is_(True))
        if plant_id is not None:
            stmt = stmt.where(
                (AssistantMemory.plant_id == plant_id) | (AssistantMemory.plant_id.is_(None))
            )
        cleared = self.db.execute(stmt).rowcount or 0

        created = 0
        plant_stmt = select(Plant)
        if plant_id is not None:
            plant_stmt = plant_stmt.where(Plant.id == plant_id)
        for plant in self.db.scalars(plant_stmt):
            created += self._rebuild_plant_metadata(plant)
            created += self._rebuild_events(plant.id)
            for entry in self.db.scalars(
                select(JournalEntry).where(JournalEntry.plant_id == plant.id).order_by(JournalEntry.captured_at.asc())
            ):
                for item in self._rule_extract(entry):
                    if self._persist_if_new(item, entry):
                        created += 1

        self.db.commit()
        return {"cleared": cleared, "created": created}

    def _rebuild_plant_metadata(self, plant: Plant) -> int:
        count = 0
        if plant.planting_date:
            item = {
                "content": f"{plant.name} was planted on {plant.planting_date.isoformat()}.",
                "memory_type": MemoryType.plant_fact,
                "source_type": MemorySourceType.plant_metadata,
                "source_id": plant.id,
                "importance": 9,
                "confidence": MemoryConfidence.high.value,
            }
            if self._persist_if_new(item, plant_id=plant.id):
                count += 1
        if plant.name:
            item = {
                "content": f"User named this plant {plant.name}.",
                "memory_type": MemoryType.plant_fact,
                "source_type": MemorySourceType.plant_metadata,
                "source_id": plant.id,
                "importance": 7,
                "confidence": MemoryConfidence.high.value,
            }
            if self._persist_if_new(item, plant_id=plant.id):
                count += 1
        return count

    def _rebuild_events(self, plant_id: int) -> int:
        count = 0
        for event in self.db.scalars(select(PlantEvent).where(PlantEvent.plant_id == plant_id)):
            label = event.title or event.event_type.value.replace("_", " ").title()
            item = {
                "content": f"{label} recorded on {event.event_date.isoformat()}.",
                "memory_type": MemoryType.milestone,
                "source_type": MemorySourceType.plant_event,
                "source_id": event.id,
                "importance": 8 if event.event_type in {PlantEventType.sprouted, PlantEventType.first_flower} else 6,
                "confidence": MemoryConfidence.high.value,
            }
            if self._persist_if_new(item, plant_id=plant_id):
                count += 1
        return count

    def _rule_extract(self, entry: JournalEntry) -> list[dict]:
        items: list[dict] = []
        text = " ".join(filter(None, [entry.memory, entry.observation])).strip()
        if not text:
            return items

        lower = text.lower()
        entry_date = entry.captured_at.date().isoformat() if entry.captured_at else "unknown date"

        if re.search(r"\bplanted\b", lower):
            items.append(
                {
                    "content": f"Journal on {entry_date} mentions planting.",
                    "memory_type": MemoryType.plant_fact,
                    "source_type": MemorySourceType.journal_entry,
                    "source_id": entry.id,
                    "importance": 7,
                    "confidence": MemoryConfidence.high.value,
                }
            )

        milestone_words = {
            "first shoot": MemoryType.milestone,
            "first sprout": MemoryType.milestone,
            "first flower": MemoryType.milestone,
            "first bud": MemoryType.milestone,
        }
        for phrase, mtype in milestone_words.items():
            if phrase in lower:
                items.append(
                    {
                        "content": f"Journal on {entry_date} mentions {phrase}.",
                        "memory_type": mtype,
                        "source_type": MemorySourceType.journal_entry,
                        "source_id": entry.id,
                        "importance": 8,
                        "confidence": MemoryConfidence.high.value,
                    }
                )

        long_term_patterns = [
            r"long[\s-]?term",
            r"stick with",
            r"learn patience",
            r"personal project",
        ]
        for pattern in long_term_patterns:
            if re.search(pattern, lower):
                items.append(
                    {
                        "content": "The user views this plant project as a long-term personal commitment.",
                        "memory_type": MemoryType.important_memory,
                        "source_type": MemorySourceType.journal_entry,
                        "source_id": entry.id,
                        "importance": 6,
                        "confidence": MemoryConfidence.high.value,
                    }
                )
                break

        patience_count = len(re.findall(r"\bpatience\b", lower))
        if patience_count >= 2:
            items.append(
                {
                    "content": "User frequently writes about patience and gradual growth.",
                    "memory_type": MemoryType.journal_theme,
                    "source_type": MemorySourceType.journal_entry,
                    "source_id": entry.id,
                    "importance": 4,
                    "confidence": MemoryConfidence.medium.value,
                }
            )

        return items

    async def _llm_extract(self, entry: JournalEntry) -> list[dict]:
        prompt = (
            "Extract at most 2 durable plant-journal memories from the entry below.\n"
            "Return JSON array with objects: content, memory_type (PLANT_FACT|MILESTONE|IMPORTANT_MEMORY|JOURNAL_THEME), confidence (HIGH|MEDIUM|LOW).\n"
            "Be conservative. Do not infer psychology. Only HIGH confidence facts about planting, milestones, or explicit long-term intent.\n"
            "If nothing qualifies, return [].\n\n"
            f"ENTRY:\n{entry.memory or ''}"
        )
        try:
            if not await self.llm.is_available():
                return []
            raw = await self.llm.chat_completion(
                [
                    {"role": "system", "content": "You extract structured memories. Reply with JSON only."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=200,
                temperature=0,
            )
            if not isinstance(raw, str):
                return []
            match = re.search(r"\[.*\]", raw, re.S)
            if not match:
                return []
            parsed = json.loads(match.group())
            items: list[dict] = []
            for row in parsed[:2]:
                if not row.get("content"):
                    continue
                items.append(
                    {
                        "content": row["content"],
                        "memory_type": MemoryType(row.get("memory_type", "PLANT_FACT")),
                        "source_type": MemorySourceType.journal_entry,
                        "source_id": entry.id,
                        "importance": 5,
                        "confidence": row.get("confidence", "LOW"),
                    }
                )
            return items
        except Exception:
            return []

    def _persist_if_new(
        self,
        item: dict,
        entry: JournalEntry | None = None,
        *,
        plant_id: int | None = None,
    ) -> AssistantMemory | None:
        pid = plant_id or (entry.plant_id if entry else None)
        content = item["content"]
        existing = self.db.scalar(
            select(AssistantMemory).where(
                AssistantMemory.plant_id == pid,
                AssistantMemory.content == content,
            )
        )
        if existing:
            return None

        confidence_raw = item.get("confidence", MemoryConfidence.high.value)
        if isinstance(confidence_raw, MemoryConfidence):
            confidence = confidence_raw
        else:
            confidence = MemoryConfidence(confidence_raw)

        if confidence != MemoryConfidence.high:
            return None

        memory_type = item["memory_type"]
        if isinstance(memory_type, str):
            memory_type = MemoryType(memory_type)

        source_type = item["source_type"]
        if isinstance(source_type, str):
            source_type = MemorySourceType(source_type)

        memory = AssistantMemory(
            plant_id=pid,
            memory_type=memory_type,
            content=content,
            source_type=source_type,
            source_id=item.get("source_id") or (entry.id if entry else None),
            importance=int(item.get("importance", 5)),
            confidence=confidence,
            auto_generated=True,
        )
        self.db.add(memory)
        self.db.flush()
        return memory
