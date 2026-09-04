from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ai_settings import AISettings
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant, PlantStatus
from app.models.plant_event import PlantEvent, PlantEventType
from app.services.llm_service import LLMUnavailableError
from app.services.plant_assistant_service import PlantAssistantService
from app.services.plant_context_tools import PlantContextTools


def _settings(**overrides: object) -> AISettings:
    base = {
        "id": 1,
        "assistant_enabled": True,
        "daily_summary_enabled": False,
        "story_enabled": True,
        "max_tokens": 256,
        "temperature": 0.3,
        "model_display_name": "Test",
    }
    base.update(overrides)
    return AISettings(**base)  # type: ignore[arg-type]


def _make_db_with_plant(*, with_entries: bool = True, many_entries: bool = False) -> MagicMock:
    plant = Plant(
        id=1,
        name="Stargazer #1",
        species="Oriental Lily",
        planting_date=date(2026, 9, 3),
        location_name="Chennai",
        status=PlantStatus.active,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    entries = []
    if with_entries:
        count = 120 if many_entries else 2
        for index in range(count):
            entries.append(
                JournalEntry(
                    id=index + 1,
                    plant_id=1,
                    captured_at=datetime(2026, 9, 1, tzinfo=UTC) + timedelta(days=index),
                    photo_path=f"/media/{index}.jpg",
                    display_path=f"/media/{index}-d.jpg",
                    thumbnail_path=f"/media/{index}-t.jpg",
                    memory="first rain" if index == 0 else "steady growth",
                    height_cm=Decimal("10") + index if index % 5 == 0 else None,
                    watering_done=index == 1,
                )
            )
    events = [
        PlantEvent(
            id=1,
            plant_id=1,
            event_type=PlantEventType.sprouted,
            event_date=date(2026, 9, 9),
            title="First shoot",
            created_at=datetime.now(UTC),
        )
    ]

    db = MagicMock()
    db.get.side_effect = lambda model, pk: {
        (AISettings, 1): None,
        (Plant, 1): plant,
    }.get((model, pk))

    def scalar(stmt):
        sql = str(stmt)
        if "count" in sql.lower():
            return len(entries)
        if "max" in sql.lower() and "journal_entries" in sql.lower():
            return datetime.now(UTC)
        if "max" in sql.lower():
            return datetime.now(UTC)
        return None

    def scalars(stmt):
        sql = str(stmt)
        result = MagicMock()
        if "PlantEvent" in sql:
            result.__iter__ = lambda self: iter(events)
        elif "JournalEntry" in sql:
            if "ilike" in sql.lower() or "memory" in sql.lower():
                filtered = [entry for entry in entries if entry.memory and "rain" in entry.memory]
                result.__iter__ = lambda self: iter(filtered[:8])
            elif "watering_done" in sql.lower():
                watered = [entry for entry in entries if entry.watering_done]
                result.__iter__ = lambda self: iter(watered[:1])
            elif "height_cm" in sql.lower():
                measured = [entry for entry in entries if entry.height_cm is not None]
                result.__iter__ = lambda self: iter(measured)
            else:
                limit = 120 if many_entries else 20
                result.__iter__ = lambda self: iter(entries[:limit])
        else:
            result.__iter__ = lambda self: iter([])
        return result

    db.scalar.side_effect = scalar
    db.scalars.side_effect = scalars
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock(side_effect=lambda obj: obj)
    return db


@pytest.mark.asyncio
async def test_chat_success():
    db = _make_db_with_plant()
    llm = AsyncMock()
    llm.chat_completion.return_value = "Your lily has two recorded entries."
    service = PlantAssistantService(db, llm=llm)
    with patch.object(service, "get_settings", return_value=_settings()):
        result = await service.chat(1, "How is my lily doing?")
    assert result["message"] == "Your lily has two recorded entries."
    llm.chat_completion.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_llm_unavailable():
    db = _make_db_with_plant()
    llm = AsyncMock()
    llm.chat_completion.side_effect = LLMUnavailableError("down")
    service = PlantAssistantService(db, llm=llm)
    with patch.object(service, "get_settings", return_value=_settings()):
        result = await service.chat(1, "How is my lily doing?")
    assert result["error"] == "AI_UNAVAILABLE"


@pytest.mark.asyncio
async def test_journal_search_context():
    db = _make_db_with_plant()
    llm = AsyncMock()
    llm.chat_completion.return_value = "You wrote about first rain."
    service = PlantAssistantService(db, llm=llm)
    with patch.object(service, "get_settings", return_value=_settings()):
        await service.chat(1, "Find the entry where I wrote about the first rain")
    messages = llm.chat_completion.await_args.kwargs if llm.chat_completion.await_args.kwargs else {}
    if not messages:
        messages = llm.chat_completion.await_args.args[0] if llm.chat_completion.await_args.args else []
    payload = llm.chat_completion.await_args
    sent_messages = payload.args[0]
    user_content = sent_messages[-1]["content"]
    assert "CURRENT CONTEXT:" in user_content or "PLANT FACTS:" in user_content


@pytest.mark.asyncio
async def test_empty_plant_history_story():
    db = _make_db_with_plant(with_entries=False)
    db.scalars.side_effect = lambda stmt: iter([]) if "PlantEvent" not in str(stmt) else iter([])
    llm = AsyncMock()
    service = PlantAssistantService(db, llm=llm)
    with patch.object(service, "get_settings", return_value=_settings(story_enabled=True)):
        result = await service.generate_story(1)
    assert result["story"] is None


@pytest.mark.asyncio
async def test_daily_summary():
    db = _make_db_with_plant()
    llm = AsyncMock()
    llm.chat_completion.return_value = "Day 8 summary from records."
    service = PlantAssistantService(db, llm=llm)
    with patch.object(service, "get_settings", return_value=_settings(daily_summary_enabled=True)):
        with patch.object(PlantContextTools, "get_entry", return_value=[{"date": "2026-09-03", "memory": "first shoot"}]):
            result = await service.generate_daily_summary(1, date(2026, 9, 3))
    assert result["summary"] == "Day 8 summary from records."


@pytest.mark.asyncio
async def test_huge_journal_histories_limited_in_context():
    db = _make_db_with_plant(many_entries=True)
    llm = AsyncMock()
    llm.chat_completion.return_value = "Recent changes noted."
    service = PlantAssistantService(db, llm=llm)
    with patch.object(service, "get_settings", return_value=_settings()):
        await service.chat(1, "What changed this week?")
    sent_messages = llm.chat_completion.await_args.args[0]
    user_content = sent_messages[-1]["content"]
    assert "CURRENT CONTEXT:" in user_content or "PLANT DATA" in user_content
    assert len(user_content) < 50000
