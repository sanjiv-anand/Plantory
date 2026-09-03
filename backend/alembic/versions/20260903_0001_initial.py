"""initial schema

Revision ID: 20260903_0001
Revises:
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260903_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    plant_status = sa.Enum("ACTIVE", "DORMANT", "ARCHIVED", name="plantstatus")
    event_type = sa.Enum(
        "PLANTED",
        "SPROUTED",
        "FIRST_LEAF",
        "REPOTTED",
        "WATERED",
        "FERTILIZED",
        "BUD_FORMED",
        "FIRST_FLOWER",
        "FLOWERING",
        "DORMANT",
        "OTHER",
        name="planteventtype",
    )

    op.create_table(
        "plants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("species", sa.String(length=200), nullable=False),
        sa.Column("variety", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("planting_date", sa.Date(), nullable=True),
        sa.Column("location_name", sa.String(length=255), nullable=True),
        sa.Column("latitude", sa.Numeric(precision=8, scale=5), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=8, scale=5), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("pot_size", sa.String(length=120), nullable=True),
        sa.Column("pot_material", sa.String(length=120), nullable=True),
        sa.Column("soil_mix", sa.Text(), nullable=True),
        sa.Column("sunlight_description", sa.Text(), nullable=True),
        sa.Column("watering_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", plant_status, nullable=False),
        sa.Column("cover_photo_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "journal_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("photo_path", sa.String(length=500), nullable=False),
        sa.Column("display_path", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_path", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("memory", sa.Text(), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("height_cm", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("leaf_count", sa.Integer(), nullable=True),
        sa.Column("flower_count", sa.Integer(), nullable=True),
        sa.Column("watering_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("fertilized", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("tags", sa.ARRAY(sa.String(length=50)), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_journal_entries_plant_id"), "journal_entries", ["plant_id"], unique=False)

    op.create_foreign_key("fk_plants_cover_photo", "plants", "journal_entries", ["cover_photo_id"], ["id"], ondelete="SET NULL")

    op.create_table(
        "weather_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("journal_entry_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("apparent_temperature", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("humidity", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("precipitation", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("precipitation_probability", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("wind_speed", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("uv_index", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("cloud_cover", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("weather_code", sa.Integer(), nullable=True),
        sa.Column("sunrise", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sunset", sa.DateTime(timezone=True), nullable=True),
        sa.Column("soil_temperature", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("soil_moisture", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("evapotranspiration", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["journal_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weather_snapshots_journal_entry_id"), "weather_snapshots", ["journal_entry_id"], unique=True)

    op.create_table(
        "plant_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plant_events_plant_id"), "plant_events", ["plant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_plant_events_plant_id"), table_name="plant_events")
    op.drop_table("plant_events")
    op.drop_index(op.f("ix_weather_snapshots_journal_entry_id"), table_name="weather_snapshots")
    op.drop_table("weather_snapshots")
    op.drop_constraint("fk_plants_cover_photo", "plants", type_="foreignkey")
    op.drop_index(op.f("ix_journal_entries_plant_id"), table_name="journal_entries")
    op.drop_table("journal_entries")
    op.drop_table("plants")
    sa.Enum(name="planteventtype").drop(op.get_bind(), checkfirst=False)
    sa.Enum(name="plantstatus").drop(op.get_bind(), checkfirst=False)
