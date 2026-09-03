from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.models.plant_event import PlantEvent
from app.schemas.plant import PlantCreate, PlantRead, PlantUpdate

router = APIRouter()


@router.get("/export")
def export_garden(db: Session = Depends(get_db)) -> dict:
    plants = list(db.scalars(select(Plant).order_by(Plant.created_at.desc())))
    entries = list(
        db.scalars(
            select(JournalEntry)
            .options(selectinload(JournalEntry.weather_snapshot))
            .order_by(JournalEntry.captured_at.desc())
        )
    )
    events = list(db.scalars(select(PlantEvent).order_by(PlantEvent.event_date.desc())))
    return {
        "version": 1,
        "exported_at": datetime.now(UTC).isoformat(),
        "plants": [PlantRead.model_validate(plant).model_dump(mode="json") for plant in plants],
        "entries": [
            {
                "id": entry.id,
                "plant_id": entry.plant_id,
                "captured_at": entry.captured_at.isoformat(),
                "title": entry.title,
                "memory": entry.memory,
                "observation": entry.observation,
                "height_cm": float(entry.height_cm) if entry.height_cm is not None else None,
                "leaf_count": entry.leaf_count,
                "flower_count": entry.flower_count,
                "watering_done": entry.watering_done,
                "fertilized": entry.fertilized,
                "tags": entry.tags,
            }
            for entry in entries
        ],
        "events": [
            {
                "id": event.id,
                "plant_id": event.plant_id,
                "event_type": event.event_type.value,
                "event_date": event.event_date.isoformat(),
                "title": event.title,
                "description": event.description,
            }
            for event in events
        ],
    }


@router.get("", response_model=list[PlantRead])
def list_plants(db: Session = Depends(get_db)) -> list[Plant]:
    return list(db.scalars(select(Plant).order_by(Plant.created_at.desc())))


@router.post("", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(payload: PlantCreate, db: Session = Depends(get_db)) -> Plant:
    plant = Plant(**payload.model_dump())
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.get("/{plant_id}", response_model=PlantRead)
def get_plant(plant_id: int, db: Session = Depends(get_db)) -> Plant:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@router.patch("/{plant_id}", response_model=PlantRead)
def update_plant(plant_id: int, payload: PlantUpdate, db: Session = Depends(get_db)) -> Plant:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(plant, key, value)

    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(plant_id: int, db: Session = Depends(get_db)) -> None:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    db.delete(plant)
    db.commit()
