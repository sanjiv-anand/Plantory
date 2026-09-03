from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.plant import Plant
from app.models.plant_event import PlantEvent
from app.schemas.plant_event import PlantEventCreate, PlantEventRead

router = APIRouter()


def _must_get_plant(db: Session, plant_id: int) -> Plant:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@router.get("", response_model=list[PlantEventRead])
def list_events(plant_id: int, db: Session = Depends(get_db)) -> list[PlantEvent]:
    _must_get_plant(db, plant_id)
    stmt = select(PlantEvent).where(PlantEvent.plant_id == plant_id).order_by(PlantEvent.event_date.desc())
    return list(db.scalars(stmt))


@router.post("", response_model=PlantEventRead, status_code=status.HTTP_201_CREATED)
def create_event(plant_id: int, payload: PlantEventCreate, db: Session = Depends(get_db)) -> PlantEvent:
    _must_get_plant(db, plant_id)
    event = PlantEvent(plant_id=plant_id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
