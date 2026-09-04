from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AssistantConversation(Base, TimestampMixin):
    __tablename__ = "assistant_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    conversation_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    summary: Mapped[str | None] = mapped_column(Text)
