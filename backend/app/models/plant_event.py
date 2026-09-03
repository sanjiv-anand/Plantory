from __future__ import annotations

import enum
from datetime import date
from datetime import datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PlantEventType(str, enum.Enum):
    planted = "PLANTED"
    sprouted = "SPROUTED"
    first_leaf = "FIRST_LEAF"
    repotted = "REPOTTED"
    watered = "WATERED"
    fertilized = "FERTILIZED"
    bud_formed = "BUD_FORMED"
    first_flower = "FIRST_FLOWER"
    flowering = "FLOWERING"
    dormant = "DORMANT"
    other = "OTHER"


class PlantEvent(Base):
    __tablename__ = "plant_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[PlantEventType] = mapped_column(Enum(PlantEventType), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    metadata: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    plant: Mapped["Plant"] = relationship("Plant", back_populates="events")
