from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.assistant_memory import MemorySourceType, MemoryType
from app.models.plant import Plant
from app.schemas.assistant import (
    AISettingsUpdate,
    AIStatusResponse,
    AITestResponse,
    MemoryCreate,
    MemoryForgetResponse,
    MemoryRead,
    MemoryRebuildResponse,
    MemoryUpdate,
)
from app.services.memory_service import MemoryService
from app.services.plant_assistant_service import PlantAssistantService

router = APIRouter()


def _memory_to_read(memory, plant_name: str | None = None) -> MemoryRead:
    return MemoryRead(
        id=memory.id,
        plant_id=memory.plant_id,
        plant_name=plant_name,
        memory_type=memory.memory_type.value,
        content=memory.content,
        source_type=memory.source_type.value,
        source_id=memory.source_id,
        importance=memory.importance,
        confidence=memory.confidence.value,
        auto_generated=memory.auto_generated,
        created_at=memory.created_at.isoformat(),
        updated_at=memory.updated_at.isoformat(),
    )


@router.get("/status", response_model=AIStatusResponse)
async def ai_status(db: Session = Depends(get_db)) -> AIStatusResponse:
    return AIStatusResponse(**await PlantAssistantService(db).status())


@router.get("/settings", response_model=AIStatusResponse)
async def get_ai_settings(db: Session = Depends(get_db)) -> AIStatusResponse:
    return AIStatusResponse(**await PlantAssistantService(db).status())


@router.patch("/settings", response_model=AIStatusResponse)
async def update_ai_settings(payload: AISettingsUpdate, db: Session = Depends(get_db)) -> AIStatusResponse:
    service = PlantAssistantService(db)
    service.update_settings(**payload.model_dump(exclude_unset=True))
    return AIStatusResponse(**await service.status())


@router.post("/test", response_model=AITestResponse)
async def ai_test(db: Session = Depends(get_db)) -> AITestResponse:
    result = await PlantAssistantService(db).test_connection()
    if result.get("error"):
        return AITestResponse(error=result["error"], detail=result.get("message"))
    return AITestResponse(**result)


@router.get("/memory", response_model=list[MemoryRead])
def list_memories(
    plant_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[MemoryRead]:
    service = MemoryService(db)
    memories = service.list_memories(plant_id=plant_id)
    plant_names: dict[int, str] = {}
    result: list[MemoryRead] = []
    for memory in memories:
        name = None
        if memory.plant_id:
            if memory.plant_id not in plant_names:
                plant = db.get(Plant, memory.plant_id)
                plant_names[memory.plant_id] = plant.name if plant else None
            name = plant_names.get(memory.plant_id)
        result.append(_memory_to_read(memory, name))
    return result


@router.post("/memory", response_model=MemoryRead, status_code=status.HTTP_201_CREATED)
def create_memory(payload: MemoryCreate, db: Session = Depends(get_db)) -> MemoryRead:
    if payload.plant_id is not None and not db.get(Plant, payload.plant_id):
        raise HTTPException(status_code=404, detail="Plant not found")
    try:
        memory_type = MemoryType(payload.memory_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid memory_type") from exc
    memory = MemoryService(db).create_memory(
        content=payload.content,
        memory_type=memory_type,
        source_type=MemorySourceType.user_explicit,
        plant_id=payload.plant_id,
        importance=payload.importance,
    )
    plant_name = None
    if memory.plant_id:
        plant = db.get(Plant, memory.plant_id)
        plant_name = plant.name if plant else None
    return _memory_to_read(memory, plant_name)


@router.patch("/memory/{memory_id}", response_model=MemoryRead)
def update_memory(memory_id: int, payload: MemoryUpdate, db: Session = Depends(get_db)) -> MemoryRead:
    memory = MemoryService(db).update_memory(memory_id, content=payload.content, importance=payload.importance)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    plant_name = None
    if memory.plant_id:
        plant = db.get(Plant, memory.plant_id)
        plant_name = plant.name if plant else None
    return _memory_to_read(memory, plant_name)


@router.delete("/memory/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(memory_id: int, db: Session = Depends(get_db)) -> None:
    if not MemoryService(db).delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")


@router.delete("/memory", response_model=MemoryForgetResponse)
def forget_all_memories(db: Session = Depends(get_db)) -> MemoryForgetResponse:
    deleted = MemoryService(db).forget_all()
    return MemoryForgetResponse(deleted=deleted)


@router.post("/memory/rebuild", response_model=MemoryRebuildResponse)
def rebuild_memories(
    plant_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> MemoryRebuildResponse:
    if plant_id is not None and not db.get(Plant, plant_id):
        raise HTTPException(status_code=404, detail="Plant not found")
    result = MemoryService(db).rebuild_memories(plant_id=plant_id)
    return MemoryRebuildResponse(**result)
