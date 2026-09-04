from __future__ import annotations

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AISettings(Base, TimestampMixin):
    __tablename__ = "ai_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    assistant_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_summary_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    story_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=256, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.45, nullable=False)
    model_display_name: Mapped[str] = mapped_column(String(120), default="Qwen3-0.6B", nullable=False)
