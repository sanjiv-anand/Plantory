from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.plant import Plant
from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantContextResponse,
    AssistantStoryResponse,
    AssistantSummaryRequest,
    AssistantSummaryResponse,
)
from app.services.plant_assistant_service import PlantAssistantService

router = APIRouter()


def _must_get_plant(db: Session, plant_id: int) -> Plant:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return plant


@router.get("/context", response_model=AssistantContextResponse)
async def assistant_context(
    plant_id: int,
    query: str = Query(default="", max_length=500),
    journal_entry_id: int | None = None,
    current_page: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
) -> AssistantContextResponse:
    _must_get_plant(db, plant_id)
    result = await PlantAssistantService(db).get_context_preview(
        plant_id,
        query=query,
        journal_entry_id=journal_entry_id,
        current_page=current_page,
    )
    return AssistantContextResponse(**result)


@router.post("/chat", response_model=None)
async def assistant_chat(
    plant_id: int,
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
) -> AssistantChatResponse | StreamingResponse:
    _must_get_plant(db, plant_id)
    service = PlantAssistantService(db)
    result = await service.chat(
        plant_id,
        payload.message,
        conversation_id=payload.conversation_id,
        history=payload.history,
        stream=payload.stream,
        journal_entry_id=payload.journal_entry_id,
        current_page=payload.current_page,
    )

    if payload.stream:

        async def event_stream():
            async for chunk in result:  # type: ignore[union-attr]
                yield chunk

        return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")

    if isinstance(result, dict) and result.get("error"):
        return AssistantChatResponse(error=result["error"], detail=result.get("message"))
    return AssistantChatResponse(**result)  # type: ignore[arg-type]


@router.post("/summary", response_model=AssistantSummaryResponse)
async def assistant_summary(
    plant_id: int,
    payload: AssistantSummaryRequest,
    db: Session = Depends(get_db),
) -> AssistantSummaryResponse:
    from datetime import date

    _must_get_plant(db, plant_id)
    target = date.fromisoformat(payload.date) if payload.date else None
    result = await PlantAssistantService(db).generate_daily_summary(plant_id, target)
    if result.get("error"):
        return AssistantSummaryResponse(error=result["error"], detail=result.get("message"))
    return AssistantSummaryResponse(**result)


@router.post("/story", response_model=AssistantStoryResponse)
async def assistant_story(plant_id: int, db: Session = Depends(get_db)) -> AssistantStoryResponse:
    _must_get_plant(db, plant_id)
    result = await PlantAssistantService(db).generate_story(plant_id)
    if result.get("error"):
        return AssistantStoryResponse(error=result["error"], detail=result.get("message"))
    return AssistantStoryResponse(**result)
