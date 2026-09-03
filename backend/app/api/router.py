from fastapi import APIRouter

from app.api.routes.entries import router as entries_router
from app.api.routes.events import router as events_router
from app.api.routes.plants import router as plants_router
from app.api.routes.weather import router as weather_router

api_router = APIRouter()
api_router.include_router(plants_router, prefix="/plants", tags=["plants"])
api_router.include_router(entries_router, prefix="/plants/{plant_id}/entries", tags=["entries"])
api_router.include_router(events_router, prefix="/plants/{plant_id}/events", tags=["events"])
api_router.include_router(weather_router, prefix="/weather", tags=["weather"])
