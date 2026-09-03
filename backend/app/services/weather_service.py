from __future__ import annotations

from datetime import UTC, datetime

import httpx
from dateutil import parser

from app.core.config import settings


class WeatherClient:
    async def fetch_forecast(self, latitude: float, longitude: float, *, forecast_days: int = 7) -> dict:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset",
            "timezone": "auto",
            "forecast_days": forecast_days,
        }
        async with httpx.AsyncClient(timeout=settings.weather_timeout_seconds) as client:
            response = await client.get(settings.weather_api_url, params=params)
            response.raise_for_status()
            payload = response.json()

        daily = payload.get("daily", {})
        dates = daily.get("time") or []
        days = []
        for index, date in enumerate(dates):
            days.append(
                {
                    "date": date,
                    "temp_max": (daily.get("temperature_2m_max") or [None])[index],
                    "temp_min": (daily.get("temperature_2m_min") or [None])[index],
                    "precipitation": (daily.get("precipitation_sum") or [None])[index],
                    "weather_code": (daily.get("weather_code") or [None])[index],
                    "sunrise": (daily.get("sunrise") or [None])[index],
                    "sunset": (daily.get("sunset") or [None])[index],
                }
            )

        alerts = []
        for day in days[:3]:
            temp_min = day.get("temp_min")
            temp_max = day.get("temp_max")
            if temp_min is not None and temp_min <= 2:
                alerts.append(
                    {
                        "type": "frost",
                        "severity": "warning",
                        "date": day["date"],
                        "message": f"Frost risk on {day['date']}: low of {temp_min:.0f}°C. Move sensitive plants indoors or cover them.",
                    }
                )
            if temp_max is not None and temp_max >= 35:
                alerts.append(
                    {
                        "type": "heat",
                        "severity": "warning",
                        "date": day["date"],
                        "message": f"Heat alert on {day['date']}: high of {temp_max:.0f}°C. Increase watering and provide shade.",
                    }
                )

        return {"days": days, "alerts": alerts}

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
