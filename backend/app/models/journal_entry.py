from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    photo_path: Mapped[str] = mapped_column(String(500), nullable=False)
    display_path: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(String(200))
    memory: Mapped[str | None] = mapped_column(Text)
    observation: Mapped[str | None] = mapped_column(Text)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    leaf_count: Mapped[int | None] = mapped_column(Integer)
    flower_count: Mapped[int | None] = mapped_column(Integer)
    watering_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fertilized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)))

    plant: Mapped["Plant"] = relationship("Plant", back_populates="entries", foreign_keys=[plant_id])
    weather_snapshot: Mapped["WeatherSnapshot | None"] = relationship(
        "WeatherSnapshot", back_populates="journal_entry", uselist=False, cascade="all, delete-orphan"
    )
