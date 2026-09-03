from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.models.weather_snapshot import WeatherSnapshot
from app.schemas.journal import JournalEntryRead, JournalEntryUpdate
from app.services.image_service import process_upload, to_fs_path
from app.services.weather_service import weather_client

router = APIRouter()


def _must_get_plant(db: Session, plant_id: int) -> Plant:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@router.get("", response_model=list[JournalEntryRead])
def list_entries(plant_id: int, db: Session = Depends(get_db)) -> list[JournalEntry]:
    _must_get_plant(db, plant_id)
    stmt = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.weather_snapshot))
        .where(JournalEntry.plant_id == plant_id)
        .order_by(JournalEntry.captured_at.desc())
    )
    return list(db.scalars(stmt))


@router.post("", response_model=JournalEntryRead, status_code=status.HTTP_201_CREATED)
async def create_entry(
    plant_id: int,
    captured_at: datetime = Form(...),
    title: str | None = Form(None),
    memory: str | None = Form(None),
    observation: str | None = Form(None),
    height_cm: float | None = Form(None),
    leaf_count: int | None = Form(None),
    flower_count: int | None = Form(None),
    watering_done: bool = Form(False),
    fertilized: bool = Form(False),
    tags: str | None = Form(None),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> JournalEntry:
    plant = _must_get_plant(db, plant_id)

    image = await process_upload(plant_id, captured_at, photo)
    parsed_tags = [item.strip() for item in tags.split(",")] if tags else None

    entry = JournalEntry(
        plant_id=plant_id,
        captured_at=captured_at,
        title=title,
        memory=memory,
        observation=observation,
        height_cm=height_cm,
        leaf_count=leaf_count,
        flower_count=flower_count,
        watering_done=watering_done,
        fertilized=fertilized,
        tags=parsed_tags,
        **image,
    )
    db.add(entry)
    db.flush()

    if plant.latitude is not None and plant.longitude is not None:
        weather = await weather_client.fetch(float(plant.latitude), float(plant.longitude))
        snapshot = WeatherSnapshot(journal_entry_id=entry.id, **weather)
        db.add(snapshot)

    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryRead)
def update_entry(plant_id: int, entry_id: int, payload: JournalEntryUpdate, db: Session = Depends(get_db)) -> JournalEntry:
    _must_get_plant(db, plant_id)
    entry = db.get(JournalEntry, entry_id)
    if not entry or entry.plant_id != plant_id:
        raise HTTPException(status_code=404, detail="Entry not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(plant_id: int, entry_id: int, db: Session = Depends(get_db)) -> None:
    _must_get_plant(db, plant_id)
    entry = db.get(JournalEntry, entry_id)
    if not entry or entry.plant_id != plant_id:
        raise HTTPException(status_code=404, detail="Entry not found")
    for media_path in [entry.photo_path, entry.display_path, entry.thumbnail_path]:
        fs_path = to_fs_path(media_path)
        if fs_path.exists():
            fs_path.unlink()
    db.delete(entry)
    db.commit()
