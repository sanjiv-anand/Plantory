from __future__ import annotations

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MemoryType(str, enum.Enum):
    plant_fact = "PLANT_FACT"
    milestone = "MILESTONE"
    user_preference = "USER_PREFERENCE"
    journal_theme = "JOURNAL_THEME"
    important_memory = "IMPORTANT_MEMORY"
    conversation_context = "CONVERSATION_CONTEXT"


class MemorySourceType(str, enum.Enum):
    journal_entry = "JOURNAL_ENTRY"
    plant_metadata = "PLANT_METADATA"
    plant_event = "PLANT_EVENT"
    user_explicit = "USER_EXPLICIT"
    conversation = "CONVERSATION"


class MemoryConfidence(str, enum.Enum):
    high = "HIGH"
    medium = "MEDIUM"
    low = "LOW"


class AssistantMemory(Base, TimestampMixin):
    __tablename__ = "assistant_memories"

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int | None] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    memory_type: Mapped[MemoryType] = mapped_column(
        Enum(MemoryType, name="memorytype", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[MemorySourceType] = mapped_column(
        Enum(MemorySourceType, name="memorysourcetype", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    source_id: Mapped[int | None] = mapped_column(Integer)
    importance: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    confidence: Mapped[MemoryConfidence] = mapped_column(
        Enum(MemoryConfidence, name="memoryconfidence", values_callable=lambda x: [e.value for e in x]),
        default=MemoryConfidence.high,
        nullable=False,
    )
    auto_generated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
