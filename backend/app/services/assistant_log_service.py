from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.assistant_memory import MemorySourceType, MemoryType
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.services.memory_service import MemoryService


@dataclass
class ParsedLogAction:
    target_date: date
    height_cm: Decimal | None = None
    height_delta_cm: Decimal | None = None
    leaf_count: int | None = None
    flower_count: int | None = None
    watering_done: bool | None = None
    fertilized: bool | None = None
    observation: str | None = None
    memory: str | None = None
    confidence: float = 0.0
    raw_note: str | None = None


@dataclass
class AppliedLogAction:
    entry_id: int
    target_date: str
    field: str
    value: str
    created: bool = False
    summary: str = ""


_LOG_SIGNALS = (
    "noticed",
    "log ",
    "record",
    "update the",
    "remember that",
    "i watered",
    "i fertilized",
    "grew",
    "grown",
    "watered",
    "fertilized",
    "leaves",
    "flowers",
    "height",
    "taller",
    "sprouted",
    "journal",
    "cm",
    "centimeter",
)


def looks_like_log_statement(message: str) -> bool:
    text = message.strip().lower()
    if not text:
        return False
    if text.endswith("?") and text.split()[0] in {"did", "has", "was", "when", "how", "what", "is", "are", "could"}:
        return False
    return any(signal in text for signal in _LOG_SIGNALS)


def parse_log_action(message: str, today: date | None = None) -> ParsedLogAction | None:
    today = today or date.today()
    text = message.strip()
    lower = text.lower()

    target_date = _parse_target_date(lower, today)
    action = ParsedLogAction(target_date=target_date, raw_note=text)

    height_abs = _first_match(
        lower,
        [
            r"(?:height|tall)(?:\s+is|\s+was|\s+now|\s+at)?\s*(?:about|around|roughly)?\s*(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?|mms?|mccms?)",
            r"(?:measured|measure(?:d)? at|now)\s*(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?|mms?|mccms?)",
            r"(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?|mms?|mccms?)\s+tall",
        ],
    )
    height_delta = _first_match(
        lower,
        [
            r"(?:grew|grown|grow|growing)\s*(?:by|about|around|roughly|approximately)?\s*(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?|mms?|mccms?)",
            r"(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?|mms?|mccms?)\s+(?:taller|growth)",
        ],
    )
    if height_abs:
        action.height_cm = Decimal(height_abs)
        action.confidence += 0.45
    if height_delta:
        action.height_delta_cm = Decimal(height_delta)
        action.confidence += 0.45

    leaf_match = _first_match(lower, [r"(\d+)\s+leaves?", r"leaf count(?:\s+is|\s+was|\s+now)?\s*(\d+)"])
    if leaf_match:
        action.leaf_count = int(leaf_match)
        action.confidence += 0.35

    flower_match = _first_match(lower, [r"(\d+)\s+flowers?", r"flower count(?:\s+is|\s+was|\s+now)?\s*(\d+)"])
    if flower_match:
        action.flower_count = int(flower_match)
        action.confidence += 0.35

    if re.search(r"\b(watered|watering done|gave (?:her|it|them) water)\b", lower):
        action.watering_done = True
        action.confidence += 0.4

    if re.search(r"\b(fertilized|fed|feeding|fertilizer)\b", lower):
        action.fertilized = True
        action.confidence += 0.4

    notice_match = re.search(
        r"(?:noticed|note that|remember that|log that|record that)\s+(.+?)(?:\.|$)",
        text,
        re.I,
    )
    if notice_match:
        action.observation = notice_match.group(1).strip()
        action.confidence += 0.2

    if action.confidence == 0 and looks_like_log_statement(message):
        action.observation = text
        action.confidence = 0.35

    if action.confidence < 0.35:
        return None

    action.memory = _build_memory_summary(action)
    return action


def _parse_target_date(text: str, today: date) -> date:
    if "yesterday" in text:
        return today - timedelta(days=1)
    if "today" in text:
        return today
    days_ago = re.search(r"(\d+)\s+days?\s+ago", text)
    if days_ago:
        return today - timedelta(days=int(days_ago.group(1)))
    iso = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
    if iso:
        return date.fromisoformat(iso.group(1))
    return today


def _first_match(text: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1)
    return None


def _build_memory_summary(action: ParsedLogAction) -> str:
    parts: list[str] = [f"On {action.target_date.isoformat()}"]
    if action.height_cm is not None:
        parts.append(f"height recorded as {action.height_cm} cm")
    elif action.height_delta_cm is not None:
        parts.append(f"growth of about {action.height_delta_cm} cm noted")
    if action.leaf_count is not None:
        parts.append(f"{action.leaf_count} leaves")
    if action.flower_count is not None:
        parts.append(f"{action.flower_count} flowers")
    if action.watering_done:
        parts.append("watered")
    if action.fertilized:
        parts.append("fertilized")
    if action.observation and len(parts) == 1:
        parts.append(action.observation[:120])
    return ", ".join(parts) + "."


def ensure_assistant_placeholder() -> dict[str, str]:
    rel = settings.photos_root_path / "assistant" / "placeholder.jpg"
    rel.parent.mkdir(parents=True, exist_ok=True)
    if not rel.exists():
        img = Image.new("RGB", (800, 600), color=(236, 245, 233))
        draw = ImageDraw.Draw(img)
        draw.text((36, 36), "Assistant log entry", fill=(56, 102, 65))
        draw.text((36, 72), "No photo — logged via Plantory Assistant", fill=(86, 130, 95))
        img.save(rel, format="JPEG", quality=85, optimize=True)
    media = f"{settings.photos_public_base}/assistant/placeholder.jpg"
    return {
        "photo_path": media,
        "display_path": media,
        "thumbnail_path": media,
        "original_filename": "assistant-placeholder",
    }


class AssistantLogService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def try_apply_from_message(self, plant_id: int, message: str, *, today: date | None = None) -> list[AppliedLogAction]:
        if not looks_like_log_statement(message):
            return []
        parsed = parse_log_action(message, today)
        if not parsed:
            return []
        return self.apply(plant_id, parsed)

    def apply(self, plant_id: int, action: ParsedLogAction) -> list[AppliedLogAction]:
        plant = self.db.get(Plant, plant_id)
        if not plant:
            return []

        if action.height_delta_cm is not None and action.height_cm is None:
            previous = self._last_height_before(plant_id, action.target_date)
            if previous is not None:
                action.height_cm = previous + action.height_delta_cm
            elif action.observation is None:
                action.observation = f"Grew about {action.height_delta_cm} cm."

        entry, created = self._get_or_create_entry(plant_id, action.target_date)
        applied: list[AppliedLogAction] = []

        if action.height_cm is not None:
            entry.height_cm = action.height_cm
            applied.append(
                AppliedLogAction(
                    entry_id=entry.id,
                    target_date=action.target_date.isoformat(),
                    field="height_cm",
                    value=str(action.height_cm),
                    created=created,
                    summary=f"Height set to {action.height_cm} cm for {action.target_date.isoformat()}.",
                )
            )
        if action.leaf_count is not None:
            entry.leaf_count = action.leaf_count
            applied.append(
                AppliedLogAction(
                    entry_id=entry.id,
                    target_date=action.target_date.isoformat(),
                    field="leaf_count",
                    value=str(action.leaf_count),
                    created=created,
                    summary=f"Leaf count set to {action.leaf_count}.",
                )
            )
        if action.flower_count is not None:
            entry.flower_count = action.flower_count
            applied.append(
                AppliedLogAction(
                    entry_id=entry.id,
                    target_date=action.target_date.isoformat(),
                    field="flower_count",
                    value=str(action.flower_count),
                    created=created,
                    summary=f"Flower count set to {action.flower_count}.",
                )
            )
        if action.watering_done:
            entry.watering_done = True
            applied.append(
                AppliedLogAction(
                    entry_id=entry.id,
                    target_date=action.target_date.isoformat(),
                    field="watering_done",
                    value="true",
                    created=created,
                    summary="Marked as watered.",
                )
            )
        if action.fertilized:
            entry.fertilized = True
            applied.append(
                AppliedLogAction(
                    entry_id=entry.id,
                    target_date=action.target_date.isoformat(),
                    field="fertilized",
                    value="true",
                    created=created,
                    summary="Marked as fertilized.",
                )
            )
        if action.observation:
            entry.observation = _append_text(entry.observation, action.observation)
            applied.append(
                AppliedLogAction(
                    entry_id=entry.id,
                    target_date=action.target_date.isoformat(),
                    field="observation",
                    value=action.observation[:120],
                    created=created,
                    summary="Observation added to journal.",
                )
            )

        if not applied:
            return []

        tags = list(entry.tags or [])
        if "assistant-logged" not in tags:
            tags.append("assistant-logged")
        entry.tags = tags

        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)

        if action.memory:
            MemoryService(self.db).create_memory(
                content=action.memory,
                memory_type=MemoryType.plant_fact if action.height_cm else MemoryType.important_memory,
                source_type=MemorySourceType.journal_entry,
                plant_id=plant_id,
                source_id=entry.id,
                importance=7,
                auto_generated=True,
            )

        return applied

    def _get_or_create_entry(self, plant_id: int, target_date: date) -> tuple[JournalEntry, bool]:
        start = datetime.combine(target_date, datetime.min.time(), tzinfo=UTC)
        end = start + timedelta(days=1)
        stmt = (
            select(JournalEntry)
            .where(
                JournalEntry.plant_id == plant_id,
                JournalEntry.captured_at >= start,
                JournalEntry.captured_at < end,
            )
            .order_by(JournalEntry.captured_at.desc())
        )
        entry = self.db.scalar(stmt)
        if entry:
            return entry, False

        placeholder = ensure_assistant_placeholder()
        noon = datetime.combine(target_date, datetime(hour=12, minute=0), tzinfo=UTC)
        entry = JournalEntry(
            plant_id=plant_id,
            captured_at=noon,
            title="Assistant log",
            memory=None,
            observation=None,
            **placeholder,
        )
        self.db.add(entry)
        self.db.flush()
        return entry, True

    def _last_height_before(self, plant_id: int, before: date) -> Decimal | None:
        cutoff = datetime.combine(before, datetime.min.time(), tzinfo=UTC)
        stmt = (
            select(JournalEntry)
            .where(
                JournalEntry.plant_id == plant_id,
                JournalEntry.captured_at < cutoff,
                JournalEntry.height_cm.is_not(None),
            )
            .order_by(JournalEntry.captured_at.desc())
            .limit(1)
        )
        entry = self.db.scalar(stmt)
        return entry.height_cm if entry and entry.height_cm is not None else None


def _append_text(existing: str | None, new: str) -> str:
    if existing and existing.strip():
        if new.strip() in existing:
            return existing
        return f"{existing.rstrip()}\n{new.strip()}"
    return new.strip()
