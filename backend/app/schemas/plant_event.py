from datetime import date, datetime

from pydantic import BaseModel

from app.models.plant_event import PlantEventType


class PlantEventCreate(BaseModel):
    event_type: PlantEventType
    event_date: date
    title: str
    description: str | None = None
    metadata: dict | None = None


class PlantEventRead(PlantEventCreate):
    id: int
    plant_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
