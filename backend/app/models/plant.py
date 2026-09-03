from __future__ import annotations

import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PlantStatus(str, enum.Enum):
    active = "ACTIVE"
    dormant = "DORMANT"
    archived = "ARCHIVED"


class Plant(Base, TimestampMixin):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    species: Mapped[str] = mapped_column(String(200), nullable=False)
    variety: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    planting_date: Mapped[date | None] = mapped_column(Date)
    location_name: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(8, 5))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(8, 5))
    timezone: Mapped[str | None] = mapped_column(String(64))
    pot_size: Mapped[str | None] = mapped_column(String(120))
    pot_material: Mapped[str | None] = mapped_column(String(120))
    soil_mix: Mapped[str | None] = mapped_column(Text)
    sunlight_description: Mapped[str | None] = mapped_column(Text)
    watering_notes: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PlantStatus] = mapped_column(
        Enum(PlantStatus, name="plantstatus", values_callable=lambda x: [e.value for e in x]),
        default=PlantStatus.active,
        nullable=False,
    )
    cover_photo_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)

    entries: Mapped[list["JournalEntry"]] = relationship(
        "JournalEntry", back_populates="plant", cascade="all, delete-orphan", foreign_keys="JournalEntry.plant_id"
    )
    events: Mapped[list["PlantEvent"]] = relationship("PlantEvent", back_populates="plant", cascade="all, delete-orphan")
