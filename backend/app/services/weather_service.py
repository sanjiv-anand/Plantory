from __future__ import annotations

from datetime import UTC, datetime

import httpx
from dateutil import parser

from app.core.config import settings


class WeatherClient:
    async def fetch(self, latitude: float, longitude: float) -> dict:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover,weather_code",
            "hourly": "precipitation_probability,uv_index,soil_temperature_0cm,soil_moisture_0_to_1cm,et0_fao_evapotranspiration",
            "daily": "sunrise,sunset",
            "timezone": "auto",
            "forecast_days": 1,
        }
        async with httpx.AsyncClient(timeout=settings.weather_timeout_seconds) as client:
            response = await client.get(settings.weather_api_url, params=params)
            response.raise_for_status()
            payload = response.json()

        now = datetime.now(UTC).hour
        hourly = payload.get("hourly", {})
        daily = payload.get("daily", {})

        return {
            "timestamp": datetime.now(UTC),
            "temperature": payload.get("current", {}).get("temperature_2m"),
            "apparent_temperature": payload.get("current", {}).get("apparent_temperature"),
            "humidity": payload.get("current", {}).get("relative_humidity_2m"),
            "precipitation": payload.get("current", {}).get("precipitation"),
            "precipitation_probability": (hourly.get("precipitation_probability") or [None])[now],
            "wind_speed": payload.get("current", {}).get("wind_speed_10m"),
            "uv_index": (hourly.get("uv_index") or [None])[now],
            "cloud_cover": payload.get("current", {}).get("cloud_cover"),
            "weather_code": payload.get("current", {}).get("weather_code"),
            "sunrise": parser.isoparse((daily.get("sunrise") or [None])[0]) if (daily.get("sunrise") or [None])[0] else None,
            "sunset": parser.isoparse((daily.get("sunset") or [None])[0]) if (daily.get("sunset") or [None])[0] else None,
            "soil_temperature": (hourly.get("soil_temperature_0cm") or [None])[now],
            "soil_moisture": (hourly.get("soil_moisture_0_to_1cm") or [None])[now],
            "evapotranspiration": (hourly.get("et0_fao_evapotranspiration") or [None])[now],
        }


weather_client = WeatherClient()
