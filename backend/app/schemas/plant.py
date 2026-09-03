from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.plant import PlantStatus


class PlantBase(BaseModel):
    name: str
    species: str
    variety: str | None = None
    description: str | None = None
    planting_date: date | None = None
    location_name: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    timezone: str | None = None
    pot_size: str | None = None
    pot_material: str | None = None
    soil_mix: str | None = None
    sunlight_description: str | None = None
    watering_notes: str | None = None
    notes: str | None = None
    status: PlantStatus = PlantStatus.active


class PlantCreate(PlantBase):
    pass


class PlantUpdate(BaseModel):
    name: str | None = None
    species: str | None = None
    variety: str | None = None
    description: str | None = None
    planting_date: date | None = None
    location_name: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    timezone: str | None = None
    pot_size: str | None = None
    pot_material: str | None = None
    soil_mix: str | None = None
    sunlight_description: str | None = None
    watering_notes: str | None = None
    notes: str | None = None
    status: PlantStatus | None = None
    cover_photo_id: int | None = None


class PlantRead(PlantBase):
    id: int
    cover_photo_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
