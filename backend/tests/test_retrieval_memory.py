from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.assistant_memory import AssistantMemory, MemoryConfidence, MemorySourceType, MemoryType
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant, PlantStatus
from app.models.plant_event import PlantEvent, PlantEventType
from app.services.context_assembler import ContextAssembler
from app.services.memory_service import MemoryService
from app.services.retrieval_service import RetrievalResult, ScoredItem


def test_context_assembler_includes_sections():
    retrieval = RetrievalResult(
        plant_facts=[{"fact": "Planted: 2026-09-03", "source": "plant_metadata"}],
        memories=[{"content": "First shoot recorded on 2026-09-09.", "source_type": "PLANT_EVENT", "source_id": 1}],
        journal_entries=[{"date": "2026-09-09", "memory": "First shoot appeared today!"}],
        events=[{"date": "2026-09-09", "type": "SPROUTED", "title": "First shoot"}],
    )
    plant = {"name": "Stargazer #1", "day_number": 8, "status": "ACTIVE"}
    prompt = ContextAssembler.assemble(
        plant=plant,
        retrieval=retrieval,
        question="How long did it take her to sprout?",
        current_date=date(2026, 9, 10),
        current_page="plant/journal",
    )

    assert "CURRENT CONTEXT:" in prompt
    assert "PLANT FACTS:" in prompt
    assert "RELEVANT MEMORIES:" in prompt
    assert "RELEVANT JOURNAL ENTRIES:" in prompt
    assert "RELEVANT EVENTS:" in prompt
    assert "USER QUESTION:" in prompt


def test_memory_rule_extract_conservative():
    entry = JournalEntry(
        id=1,
        plant_id=1,
        captured_at=datetime(2026, 9, 3, 12, tzinfo=UTC),
        photo_path="/a.jpg",
        display_path="/a-d.jpg",
        thumbnail_path="/a-t.jpg",
        memory=(
            "Planted these two Stargazer bulbs today. The whole point is to learn patience "
            "and actually stick with something long term."
        ),
    )
    items = MemoryService(MagicMock())._rule_extract(entry)
    types = {item["memory_type"] for item in items}
    assert MemoryType.plant_fact in types
    assert MemoryType.important_memory in types
    assert all(item.get("confidence") in {"HIGH", "MEDIUM"} for item in items)


def test_scored_item_ordering():
    items = [
        ScoredItem(kind="event", score=3.5, data={"type": "SPROUTED"}, date=date(2026, 9, 9)),
        ScoredItem(kind="journal", score=1.2, data={"memory": "older note"}, date=date(2026, 8, 1)),
    ]
    items.sort(key=lambda item: item.score, reverse=True)
    assert items[0].kind == "event"


def test_memory_service_persist_skips_low_confidence():
    db = MagicMock()
    db.scalar.return_value = None
    db.flush = MagicMock()
    db.add = MagicMock()

    service = MemoryService(db)
    result = service._persist_if_new(
        {
            "content": "Maybe the user likes plants.",
            "memory_type": MemoryType.journal_theme,
            "source_type": MemorySourceType.journal_entry,
            "source_id": 1,
            "confidence": MemoryConfidence.low.value,
        },
        JournalEntry(id=1, plant_id=1, captured_at=datetime.now(UTC), photo_path="/a.jpg", display_path="/d.jpg", thumbnail_path="/t.jpg"),
    )
    assert result is None
