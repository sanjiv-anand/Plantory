from __future__ import annotations

import hashlib
import re
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.models.plant_event import PlantEvent, PlantEventType
from app.models.weather_snapshot import WeatherSnapshot
from app.services.weather_service import weather_client


def _fmt_date(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _fmt_decimal(value: Decimal | float | int | None) -> str | None:
    if value is None:
        return None
    return f"{float(value):g}"


class PlantContextTools:
    """Controlled backend tools for assembling plant context. Never exposed to the LLM directly."""

    def __init__(self, db: Session, plant_id: int) -> None:
        self.db = db
        self.plant_id = plant_id
        self._plant: Plant | None = None

    def _plant_or_raise(self) -> Plant:
        if self._plant is None:
            plant = self.db.get(Plant, self.plant_id)
            if not plant:
                raise ValueError("Plant not found")
            self._plant = plant
        return self._plant

    def get_plant(self) -> dict:
        plant = self._plant_or_raise()
        planting = plant.planting_date
        day_number = None
        if planting:
            day_number = (date.today() - planting).days + 1
        return {
            "name": plant.name,
            "species": plant.species,
            "variety": plant.variety,
            "description": plant.description,
            "planting_date": _fmt_date(planting),
            "day_number": day_number,
            "location": plant.location_name,
            "latitude": _fmt_decimal(plant.latitude),
            "longitude": _fmt_decimal(plant.longitude),
            "pot_size": plant.pot_size,
            "pot_material": plant.pot_material,
            "soil_mix": plant.soil_mix,
            "sunlight": plant.sunlight_description,
            "watering_notes": plant.watering_notes,
            "notes": plant.notes,
            "status": plant.status.value,
        }

    def get_recent_entries(self, days: int = 7, limit: int = 20) -> list[dict]:
        cutoff = datetime.now(UTC) - timedelta(days=days)
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.weather_snapshot))
            .where(JournalEntry.plant_id == self.plant_id, JournalEntry.captured_at >= cutoff)
            .order_by(JournalEntry.captured_at.desc())
            .limit(limit)
        )
        return [self._entry_dict(entry) for entry in self.db.scalars(stmt)]

    def get_entry(self, target_date: date) -> list[dict]:
        start = datetime.combine(target_date, datetime.min.time(), tzinfo=UTC)
        end = start + timedelta(days=1)
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.weather_snapshot))
            .where(
                JournalEntry.plant_id == self.plant_id,
                JournalEntry.captured_at >= start,
                JournalEntry.captured_at < end,
            )
            .order_by(JournalEntry.captured_at.asc())
        )
        return [self._entry_dict(entry) for entry in self.db.scalars(stmt)]

    def get_growth_stats(self) -> dict:
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.plant_id == self.plant_id, JournalEntry.height_cm.is_not(None))
            .order_by(JournalEntry.captured_at.asc())
        )
        measurements = list(self.db.scalars(stmt))
        if not measurements:
            return {"measurement_count": 0, "measurements": []}
        first = measurements[0]
        last = measurements[-1]
        growth = None
        if first.height_cm is not None and last.height_cm is not None:
            growth = float(last.height_cm) - float(first.height_cm)
        return {
            "measurement_count": len(measurements),
            "first_height_cm": _fmt_decimal(first.height_cm),
            "first_date": _fmt_date(first.captured_at),
            "latest_height_cm": _fmt_decimal(last.height_cm),
            "latest_date": _fmt_date(last.captured_at),
            "recorded_growth_cm": _fmt_decimal(growth),
            "measurements": [
                {
                    "date": _fmt_date(entry.captured_at),
                    "height_cm": _fmt_decimal(entry.height_cm),
                    "leaf_count": entry.leaf_count,
                    "flower_count": entry.flower_count,
                }
                for entry in measurements[-10:]
            ],
        }

    async def get_weather(self, target_date: date) -> dict | None:
        entries = self.get_entry(target_date)
        for entry in entries:
            weather = entry.get("weather")
            if weather:
                return {"date": target_date.isoformat(), "source": "entry_snapshot", **weather}
        plant = self._plant_or_raise()
        if plant.latitude is None or plant.longitude is None:
            return None
        forecast = await weather_client.fetch_forecast(float(plant.latitude), float(plant.longitude), forecast_days=16)
        for day in forecast.get("days", []):
            if day.get("date") == target_date.isoformat():
                return {"date": target_date.isoformat(), "source": "forecast_api", **day}
        return None

    async def get_weather_range(self, start_date: date, end_date: date) -> list[dict]:
        results: list[dict] = []
        current = start_date
        while current <= end_date:
            weather = await self.get_weather(current)
            if weather:
                results.append(weather)
            current += timedelta(days=1)
        return results

    def get_events(self, limit: int = 30) -> list[dict]:
        stmt = (
            select(PlantEvent)
            .where(PlantEvent.plant_id == self.plant_id)
            .order_by(PlantEvent.event_date.asc())
            .limit(limit)
        )
        return [
            {
                "type": event.event_type.value,
                "date": _fmt_date(event.event_date),
                "title": event.title,
                "description": event.description,
            }
            for event in self.db.scalars(stmt)
        ]

    def search_journal(self, query: str, limit: int = 10) -> list[dict]:
        pattern = f"%{query.strip()}%"
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.weather_snapshot))
            .where(
                JournalEntry.plant_id == self.plant_id,
                or_(
                    JournalEntry.memory.ilike(pattern),
                    JournalEntry.observation.ilike(pattern),
                    JournalEntry.title.ilike(pattern),
                ),
            )
            .order_by(JournalEntry.captured_at.desc())
            .limit(limit)
        )
        return [self._entry_dict(entry) for entry in self.db.scalars(stmt)]

    def get_photo_metadata(self, target_date: date | None = None, limit: int = 20) -> list[dict]:
        stmt = select(JournalEntry).where(JournalEntry.plant_id == self.plant_id)
        if target_date:
            start = datetime.combine(target_date, datetime.min.time(), tzinfo=UTC)
            end = start + timedelta(days=1)
            stmt = stmt.where(JournalEntry.captured_at >= start, JournalEntry.captured_at < end)
        stmt = stmt.order_by(JournalEntry.captured_at.desc()).limit(limit)
        return [
            {
                "date": _fmt_date(entry.captured_at),
                "title": entry.title,
                "original_filename": entry.original_filename,
                "has_photo": True,
            }
            for entry in self.db.scalars(stmt)
        ]

    def get_last_watering(self) -> dict | None:
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.plant_id == self.plant_id, JournalEntry.watering_done.is_(True))
            .order_by(JournalEntry.captured_at.desc())
            .limit(1)
        )
        entry = self.db.scalar(stmt)
        if not entry:
            return None
        return {"date": _fmt_date(entry.captured_at), "entry_title": entry.title}

    def summarize_timeline(self, max_entries: int = 15) -> dict:
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.weather_snapshot))
            .where(JournalEntry.plant_id == self.plant_id)
            .order_by(JournalEntry.captured_at.desc())
            .limit(max_entries)
        )
        entries = [self._entry_dict(entry) for entry in self.db.scalars(stmt)]
        return {
            "total_entries": self.db.scalar(
                select(func.count()).select_from(JournalEntry).where(JournalEntry.plant_id == self.plant_id)
            ),
            "total_photos": self.db.scalar(
                select(func.count()).select_from(JournalEntry).where(JournalEntry.plant_id == self.plant_id)
            ),
            "recent_entries": entries,
            "events": self.get_events(limit=15),
            "growth": self.get_growth_stats(),
        }

    def data_fingerprint(self) -> str:
        plant = self._plant_or_raise()
        parts = [
            str(plant.updated_at),
            str(
                self.db.scalar(
                    select(func.max(JournalEntry.updated_at)).where(JournalEntry.plant_id == self.plant_id)
                )
            ),
            str(
                self.db.scalar(
                    select(func.max(PlantEvent.created_at)).where(PlantEvent.plant_id == self.plant_id)
                )
            ),
        ]
        return hashlib.sha256("|".join(parts).encode()).hexdigest()

    def _entry_dict(self, entry: JournalEntry) -> dict:
        weather = entry.weather_snapshot
        return {
            "date": _fmt_date(entry.captured_at),
            "title": entry.title,
            "memory": entry.memory,
            "observation": entry.observation,
            "height_cm": _fmt_decimal(entry.height_cm),
            "leaf_count": entry.leaf_count,
            "flower_count": entry.flower_count,
            "watering_done": entry.watering_done,
            "fertilized": entry.fertilized,
            "tags": entry.tags,
            "has_photo": True,
            "weather": self._weather_dict(weather) if weather else None,
        }

    @staticmethod
    def _weather_dict(snapshot: WeatherSnapshot) -> dict:
        return {
            "temperature_c": _fmt_decimal(snapshot.temperature),
            "humidity_pct": _fmt_decimal(snapshot.humidity),
            "precipitation_mm": _fmt_decimal(snapshot.precipitation),
            "wind_speed": _fmt_decimal(snapshot.wind_speed),
            "weather_code": snapshot.weather_code,
        }


def extract_search_query(question: str) -> str | None:
    patterns = [
        r"(?:find|search)(?:\s+the\s+entry\s+where\s+i\s+wrote\s+about)\s+(.+)",
        r"(?:find|search)\s+(?:for\s+)?(.+)",
        r"(?:where i wrote about|entry about|memory about)\s+(.+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, question, re.I)
        if match:
            return match.group(1).strip(" .?\"'")
    return None


def classify_intents(question: str) -> set[str]:
    q = question.lower()
    intents: set[str] = {"plant", "recent"}
    if any(word in q for word in ("weather", "rain", "temperature", "humid", "frost", "hot", "cold")):
        intents.add("weather")
    if any(word in q for word in ("story", "history", "timeline", "journey", "so far")):
        intents.add("timeline")
    if any(word in q for word in ("milestone", "event", "shoot", "sprout", "flower", "bud", "repot")):
        intents.add("events")
    if any(word in q for word in ("photo", "picture", "image", "upload")):
        intents.add("photos")
    if any(word in q for word in ("water", "watered", "watering")):
        intents.add("watering")
    if any(word in q for word in ("grow", "height", "measure", "cm", "change", "compare", "biggest")):
        intents.add("growth")
    if any(word in q for word in ("find", "search", "wrote", "memory", "memories", "recorded", "remember")):
        intents.add("search")
    if any(word in q for word in ("week", "month", "day 20", "around day", "that time", "around that")):
        intents.add("range")
    if any(word in q for word in ("when", "how long", "timeline", "first", "ago")):
        intents.add("events")
        intents.add("search")
    return intents
