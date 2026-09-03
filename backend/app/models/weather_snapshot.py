from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"), unique=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    temperature: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    apparent_temperature: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    humidity: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    precipitation: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    precipitation_probability: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    wind_speed: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    uv_index: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    cloud_cover: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    weather_code: Mapped[int | None] = mapped_column()
    sunrise: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sunset: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    soil_temperature: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    soil_moisture: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    evapotranspiration: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="weather_snapshot")
