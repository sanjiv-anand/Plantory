from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.models.journal_entry import JournalEntry
from app.models.plant import Plant
from app.models.weather_snapshot import WeatherSnapshot
from app.schemas.journal import JournalEntryRead, JournalEntryUpdate
from app.services.image_service import process_upload, to_fs_path
from app.services.memory_service import MemoryService
from app.services.weather_service import weather_client

router = APIRouter()


async def _extract_memories(entry_id: int) -> None:
    import app.db.base  # noqa: F401
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        await MemoryService(db).extract_from_journal_entry(entry_id)
        db.commit()
    finally:
        db.close()


def _optional_float(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    return float(value)


def _optional_int(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    return int(value)


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
    background_tasks: BackgroundTasks,
    captured_at: datetime = Form(...),
    title: str | None = Form(None),
    memory: str | None = Form(None),
    observation: str | None = Form(None),
    height_cm: str | None = Form(None),
    leaf_count: str | None = Form(None),
    flower_count: str | None = Form(None),
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
        height_cm=_optional_float(height_cm),
        leaf_count=_optional_int(leaf_count),
        flower_count=_optional_int(flower_count),
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
    background_tasks.add_task(_extract_memories, entry.id)
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryRead)
def update_entry(
    plant_id: int,
    entry_id: int,
    payload: JournalEntryUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> JournalEntry:
    _must_get_plant(db, plant_id)
    entry = db.get(JournalEntry, entry_id)
    if not entry or entry.plant_id != plant_id:
        raise HTTPException(status_code=404, detail="Entry not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)

    db.add(entry)
    db.commit()
    db.refresh(entry)
    background_tasks.add_task(_extract_memories, entry.id)
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
    MemoryService(db).invalidate_for_journal_entry(entry_id)
    db.delete(entry)
    db.commit()
