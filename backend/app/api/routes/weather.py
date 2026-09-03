from fastapi import APIRouter, Query

from app.services.weather_service import weather_client

router = APIRouter()


@router.get("/current")
async def get_weather(latitude: float = Query(...), longitude: float = Query(...)) -> dict:
    return await weather_client.fetch(latitude, longitude)


@router.get("/forecast")
async def get_forecast(
    latitude: float = Query(...),
    longitude: float = Query(...),
    forecast_days: int = Query(7, ge=1, le=14),
) -> dict:
    return await weather_client.fetch_forecast(latitude, longitude, forecast_days=forecast_days)
