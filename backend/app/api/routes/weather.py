from fastapi import APIRouter, Query

from app.services.weather_service import weather_client

router = APIRouter()


@router.get("/current")
async def get_weather(latitude: float = Query(...), longitude: float = Query(...)) -> dict:
    return await weather_client.fetch(latitude, longitude)
