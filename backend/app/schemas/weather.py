from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class WeatherSnapshotRead(BaseModel):
    id: int
    journal_entry_id: int
    timestamp: datetime
    temperature: Decimal | None = None
    apparent_temperature: Decimal | None = None
    humidity: Decimal | None = None
    precipitation: Decimal | None = None
    precipitation_probability: Decimal | None = None
    wind_speed: Decimal | None = None
    uv_index: Decimal | None = None
    cloud_cover: Decimal | None = None
    weather_code: int | None = None
    sunrise: datetime | None = None
    sunset: datetime | None = None
    soil_temperature: Decimal | None = None
    soil_moisture: Decimal | None = None
    evapotranspiration: Decimal | None = None

    model_config = {"from_attributes": True}
