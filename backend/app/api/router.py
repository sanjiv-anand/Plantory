from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.routes.ai import router as ai_router
from app.api.routes.assistant import router as assistant_router
from app.api.routes.auth import router as auth_router
from app.api.routes.entries import router as entries_router
from app.api.routes.events import router as events_router
from app.api.routes.plants import router as plants_router
from app.api.routes.weather import router as weather_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])

protected = APIRouter(dependencies=[Depends(get_current_user)])
protected.include_router(plants_router, prefix="/plants", tags=["plants"])
protected.include_router(entries_router, prefix="/plants/{plant_id}/entries", tags=["entries"])
protected.include_router(events_router, prefix="/plants/{plant_id}/events", tags=["events"])
protected.include_router(weather_router, prefix="/weather", tags=["weather"])
protected.include_router(assistant_router, prefix="/plants/{plant_id}/assistant", tags=["assistant"])
protected.include_router(ai_router, prefix="/ai", tags=["ai"])
api_router.include_router(protected)
