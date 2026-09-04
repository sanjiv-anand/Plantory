"""assistant memory and conversation tables

Revision ID: 20260904_0004
Revises: 20260904_0003
Create Date: 2026-09-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260904_0004"
down_revision: Union[str, None] = "20260904_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MEMORY_TYPE_VALUES = (
    "PLANT_FACT",
    "MILESTONE",
    "USER_PREFERENCE",
    "JOURNAL_THEME",
    "IMPORTANT_MEMORY",
    "CONVERSATION_CONTEXT",
)
MEMORY_SOURCE_VALUES = (
    "JOURNAL_ENTRY",
    "PLANT_METADATA",
    "PLANT_EVENT",
    "USER_EXPLICIT",
    "CONVERSATION",
)
MEMORY_CONFIDENCE_VALUES = ("HIGH", "MEDIUM", "LOW")


def _enum(name: str, values: tuple[str, ...], *, create_type: bool) -> postgresql.ENUM:
    return postgresql.ENUM(*values, name=name, create_type=create_type)


def upgrade() -> None:
    bind = op.get_bind()

    _enum("memorytype", MEMORY_TYPE_VALUES, create_type=True).create(bind, checkfirst=True)
    _enum("memorysourcetype", MEMORY_SOURCE_VALUES, create_type=True).create(bind, checkfirst=True)
    _enum("memoryconfidence", MEMORY_CONFIDENCE_VALUES, create_type=True).create(bind, checkfirst=True)

    memory_type = _enum("memorytype", MEMORY_TYPE_VALUES, create_type=False)
    memory_source = _enum("memorysourcetype", MEMORY_SOURCE_VALUES, create_type=False)
    memory_confidence = _enum("memoryconfidence", MEMORY_CONFIDENCE_VALUES, create_type=False)

    op.create_table(
        "assistant_memories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=True),
        sa.Column("memory_type", memory_type, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_type", memory_source, nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("importance", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("confidence", memory_confidence, nullable=False, server_default="HIGH"),
        sa.Column("auto_generated", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assistant_memories_plant_id"), "assistant_memories", ["plant_id"], unique=False)

    op.create_table(
        "assistant_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assistant_conversations_conversation_id"), "assistant_conversations", ["conversation_id"], unique=True)
    op.create_index(op.f("ix_assistant_conversations_plant_id"), "assistant_conversations", ["plant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assistant_conversations_plant_id"), table_name="assistant_conversations")
    op.drop_index(op.f("ix_assistant_conversations_conversation_id"), table_name="assistant_conversations")
    op.drop_table("assistant_conversations")
    op.drop_index(op.f("ix_assistant_memories_plant_id"), table_name="assistant_memories")
    op.drop_table("assistant_memories")

    bind = op.get_bind()
    _enum("memoryconfidence", MEMORY_CONFIDENCE_VALUES, create_type=True).drop(bind, checkfirst=True)
    _enum("memorysourcetype", MEMORY_SOURCE_VALUES, create_type=True).drop(bind, checkfirst=True)
    _enum("memorytype", MEMORY_TYPE_VALUES, create_type=True).drop(bind, checkfirst=True)
