from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.assistant_memory import AssistantMemory, MemoryConfidence, MemoryType
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.models.plant_event import PlantEvent, PlantEventType
from app.services.plant_context_tools import PlantContextTools, classify_intents, extract_search_query


@dataclass
class ScoredItem:
    kind: str
    score: float
    data: dict[str, Any]
    date: date | None = None


@dataclass
class RetrievalResult:
    plant_facts: list[dict[str, Any]] = field(default_factory=list)
    memories: list[dict[str, Any]] = field(default_factory=list)
    journal_entries: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    photos: list[dict[str, Any]] = field(default_factory=list)
    weather: list[dict[str, Any]] = field(default_factory=list)
    measurements: list[dict[str, Any]] = field(default_factory=list)
    contradictions: list[str] = field(default_factory=list)
    recent_days: int = 7


def _tokenize(query: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9']+", query.lower()) if len(t) > 2]


def _keyword_score(text: str | None, tokens: list[str]) -> float:
    if not text or not tokens:
        return 0.0
    lower = text.lower()
    hits = sum(1 for token in tokens if token in lower)
    return hits / len(tokens)


def _date_relevance(item_date: date | None, current: date, *, prefer_recent: bool) -> float:
    if item_date is None:
        return 0.0
    days_ago = (current - item_date).days
    if days_ago < 0:
        return 0.3
    if prefer_recent:
        if days_ago <= 7:
            return 1.0
        if days_ago <= 30:
            return 0.7
        if days_ago <= 90:
            return 0.4
        return max(0.1, 1.0 - days_ago / 365)
    return max(0.2, 1.0 - days_ago / 730)


class RetrievalService:
    """Ranked context retrieval. Embeddings can replace scoring internals later."""

    def __init__(self, db: Session, plant_id: int) -> None:
        self.db = db
        self.plant_id = plant_id
        self.tools = PlantContextTools(db, plant_id)

    def retrieve_context(
        self,
        query: str,
        *,
        current_date: date | None = None,
        journal_entry_id: int | None = None,
        recent_days: int | None = None,
    ) -> RetrievalResult:
        today = current_date or date.today()
        intents = classify_intents(query)
        tokens = _tokenize(query)
        search_query = extract_search_query(query) or query
        days = recent_days or (30 if "range" in intents or "timeline" in intents else 7)

        result = RetrievalResult(recent_days=days)
        result.plant_facts = self._plant_facts()
        result.contradictions = self._detect_contradictions(result.plant_facts)

        scored: list[ScoredItem] = []

        for memory in self._fetch_memories():
            score = self._score_memory(memory, tokens, today)
            scored.append(
                ScoredItem(
                    kind="memory",
                    score=score,
                    data=self._memory_dict(memory),
                    date=memory.created_at.date() if memory.created_at else None,
                )
            )

        for entry in self._fetch_journal_entries(days=days, search_query=search_query if "search" in intents else None):
            entry_date = entry.captured_at.date() if entry.captured_at else None
            score = self._score_journal(entry, tokens, today, intents)
            if journal_entry_id and entry.id == journal_entry_id:
                score += 5.0
            scored.append(
                ScoredItem(
                    kind="journal",
                    score=score,
                    data=self.tools._entry_dict(entry) | {"id": entry.id},
                    date=entry_date,
                )
            )

        for event in self._fetch_events():
            event_date = event.event_date
            score = self._score_event(event, tokens, today, intents)
            scored.append(
                ScoredItem(
                    kind="event",
                    score=score,
                    data={
                        "id": event.id,
                        "type": event.event_type.value,
                        "date": event.event_date.isoformat(),
                        "title": event.title,
                        "description": event.description,
                    },
                    date=event_date,
                )
            )

        if "photos" in intents or journal_entry_id:
            for photo in self.tools.get_photo_metadata(limit=10):
                score = 0.5 + _keyword_score(photo.get("title"), tokens)
                scored.append(ScoredItem(kind="photo", score=score, data=photo, date=_parse_date(photo.get("date"))))

        scored.sort(key=lambda item: item.score, reverse=True)

        seen_journal: set[int] = set()
        seen_event: set[int] = set()
        for item in scored:
            if item.kind == "memory" and len(result.memories) < 8:
                result.memories.append(item.data)
            elif item.kind == "journal":
                entry_id = item.data.get("id")
                if entry_id in seen_journal:
                    continue
                if len(result.journal_entries) < 10 and item.score >= 0.15:
                    seen_journal.add(entry_id)
                    result.journal_entries.append(item.data)
                    if item.data.get("weather"):
                        result.weather.append({"date": item.data.get("date"), **item.data["weather"]})
                    if item.data.get("height_cm"):
                        result.measurements.append(
                            {
                                "date": item.data.get("date"),
                                "height_cm": item.data.get("height_cm"),
                                "leaf_count": item.data.get("leaf_count"),
                                "flower_count": item.data.get("flower_count"),
                            }
                        )
            elif item.kind == "event":
                event_id = item.data.get("id")
                if event_id in seen_event:
                    continue
                if len(result.events) < 8 and item.score >= 0.2:
                    seen_event.add(event_id)
                    result.events.append(item.data)
            elif item.kind == "photo" and len(result.photos) < 6:
                result.photos.append(item.data)

        if "timeline" in intents and not result.journal_entries:
            result.journal_entries = self.tools.get_recent_entries(days=30, limit=10)

        if "events" in intents and not result.events:
            result.events = self.tools.get_events(limit=10)

        if journal_entry_id:
            entry = self.db.get(JournalEntry, journal_entry_id)
            if entry and entry.plant_id == self.plant_id:
                current = self.tools._entry_dict(entry) | {"id": entry.id}
                if not any(j.get("id") == entry.id for j in result.journal_entries):
                    result.journal_entries.insert(0, current)

        return result

    def _plant_facts(self) -> list[dict[str, Any]]:
        plant = self.tools.get_plant()
        facts: list[dict[str, Any]] = []
        if plant.get("name"):
            facts.append({"fact": f"Plant name: {plant['name']}", "source": "plant_metadata"})
        if plant.get("species"):
            facts.append({"fact": f"Species: {plant['species']}", "source": "plant_metadata"})
        if plant.get("variety"):
            facts.append({"fact": f"Variety: {plant['variety']}", "source": "plant_metadata"})
        if plant.get("planting_date"):
            facts.append({"fact": f"Planted: {plant['planting_date']}", "source": "plant_metadata"})
        if plant.get("location"):
            facts.append({"fact": f"Location: {plant['location']}", "source": "plant_metadata"})
        if plant.get("pot_size"):
            facts.append({"fact": f"Pot: {plant['pot_size']}", "source": "plant_metadata"})
        if plant.get("soil_mix"):
            facts.append({"fact": f"Soil: {plant['soil_mix']}", "source": "plant_metadata"})
        if plant.get("day_number"):
            facts.append({"fact": f"Plant age: {plant['day_number']} days", "source": "plant_metadata"})
        facts.append({"fact": f"Status: {plant.get('status')}", "source": "plant_metadata"})
        return facts

    def _detect_contradictions(self, plant_facts: list[dict[str, Any]]) -> list[str]:
        planting_from_metadata = None
        for fact in plant_facts:
            if fact["fact"].startswith("Planted:"):
                planting_from_metadata = fact["fact"].replace("Planted: ", "")
                break

        planting_entries: list[str] = []
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.plant_id == self.plant_id)
            .order_by(JournalEntry.captured_at.asc())
        )
        for entry in self.db.scalars(stmt):
            text = " ".join(filter(None, [entry.memory, entry.observation, entry.title])).lower()
            if "plant" in text and ("today" in text or "planted" in text):
                planting_entries.append(entry.captured_at.date().isoformat())

        contradictions: list[str] = []
        unique_dates = sorted(set(planting_entries))
        if len(unique_dates) > 1:
            contradictions.append(
                f"Multiple journal entries describe planting on different dates: {', '.join(unique_dates)}."
            )
        if planting_from_metadata and unique_dates and planting_from_metadata not in unique_dates:
            contradictions.append(
                f"Plant record says planted {planting_from_metadata}, but journal entries mention planting on {', '.join(unique_dates)}."
            )
        return contradictions

    def _fetch_memories(self) -> list[AssistantMemory]:
        stmt = (
            select(AssistantMemory)
            .where(
                or_(AssistantMemory.plant_id == self.plant_id, AssistantMemory.plant_id.is_(None)),
                AssistantMemory.confidence == MemoryConfidence.high,
                AssistantMemory.memory_type != MemoryType.conversation_context,
            )
            .order_by(AssistantMemory.importance.desc(), AssistantMemory.updated_at.desc())
            .limit(30)
        )
        return list(self.db.scalars(stmt))

    def _fetch_journal_entries(self, *, days: int, search_query: str | None) -> list[JournalEntry]:
        cutoff = datetime.now(UTC) - timedelta(days=days)
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.weather_snapshot))
            .where(JournalEntry.plant_id == self.plant_id)
        )
        if search_query and search_query.strip():
            pattern = f"%{search_query.strip()}%"
            stmt = stmt.where(
                or_(
                    JournalEntry.memory.ilike(pattern),
                    JournalEntry.observation.ilike(pattern),
                    JournalEntry.title.ilike(pattern),
                    func.array_to_string(JournalEntry.tags, " ").ilike(pattern),
                )
            )
        else:
            stmt = stmt.where(JournalEntry.captured_at >= cutoff)
        stmt = stmt.order_by(JournalEntry.captured_at.desc()).limit(40)
        return list(self.db.scalars(stmt))

    def _fetch_events(self) -> list[PlantEvent]:
        stmt = (
            select(PlantEvent)
            .where(PlantEvent.plant_id == self.plant_id)
            .order_by(PlantEvent.event_date.asc())
        )
        return list(self.db.scalars(stmt))

    def _score_memory(self, memory: AssistantMemory, tokens: list[str], today: date) -> float:
        score = memory.importance / 10.0
        score += _keyword_score(memory.content, tokens) * 2.0
        if memory.created_at:
            score += _date_relevance(memory.created_at.date(), today, prefer_recent=False) * 0.5
        return score

    def _score_journal(self, entry: JournalEntry, tokens: list[str], today: date, intents: set[str]) -> float:
        text = " ".join(filter(None, [entry.title, entry.memory, entry.observation]))
        score = _keyword_score(text, tokens) * 3.0
        entry_date = entry.captured_at.date() if entry.captured_at else None
        score += _date_relevance(entry_date, today, prefer_recent="recent" in intents)
        if entry.tags:
            score += _keyword_score(" ".join(entry.tags), tokens) * 1.5
        return score

    def _score_event(self, event: PlantEvent, tokens: list[str], today: date, intents: set[str]) -> float:
        text = f"{event.event_type.value} {event.title} {event.description or ''}"
        score = _keyword_score(text, tokens) * 2.5
        score += _date_relevance(event.event_date, today, prefer_recent=False)
        if "events" in intents or "timeline" in intents:
            score += 1.0
        milestone_types = {
            PlantEventType.planted,
            PlantEventType.sprouted,
            PlantEventType.first_leaf,
            PlantEventType.first_flower,
            PlantEventType.bud_formed,
        }
        if event.event_type in milestone_types:
            score += 0.8
            if any(w in tokens for w in ("sprout", "shoot", "flower", "plant", "milestone", "first")):
                score += 2.0
        return score

    @staticmethod
    def _memory_dict(memory: AssistantMemory) -> dict[str, Any]:
        return {
            "id": memory.id,
            "content": memory.content,
            "memory_type": memory.memory_type.value,
            "source_type": memory.source_type.value,
            "source_id": memory.source_id,
            "importance": memory.importance,
            "confidence": memory.confidence.value,
        }


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
