from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.weather import WeatherSnapshotRead


class JournalEntryCreate(BaseModel):
    captured_at: datetime
    title: str | None = None
    memory: str | None = None
    observation: str | None = None
    height_cm: Decimal | None = None
    leaf_count: int | None = None
    flower_count: int | None = None
    watering_done: bool = False
    fertilized: bool = False
    tags: list[str] | None = None


class JournalEntryUpdate(BaseModel):
    captured_at: datetime | None = None
    title: str | None = None
    memory: str | None = None
    observation: str | None = None
    height_cm: Decimal | None = None
    leaf_count: int | None = None
    flower_count: int | None = None
    watering_done: bool | None = None
    fertilized: bool | None = None
    tags: list[str] | None = None


class JournalEntryRead(BaseModel):
    id: int
    plant_id: int
    captured_at: datetime
    photo_path: str
    display_path: str
    thumbnail_path: str
    original_filename: str | None
    title: str | None
    memory: str | None
    observation: str | None
    height_cm: Decimal | None
    leaf_count: int | None
    flower_count: int | None
    watering_done: bool
    fertilized: bool
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime
    weather_snapshot: WeatherSnapshotRead | None = None

    model_config = {"from_attributes": True}
