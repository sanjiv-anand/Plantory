from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "LILYLOG"
    environment: str = "development"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"])

    database_url: str = "postgresql+psycopg:///lilylog?host=postgres&user=postgres"

    photos_root: str = "/data/photos"
    photos_public_base: str = "/media"

    weather_api_url: str = "https://api.open-meteo.com/v1/forecast"
    weather_timeout_seconds: int = 10

    allowed_upload_extensions: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    max_upload_mb: int = 15

    thumbnail_size: int = 320
    display_max_width: int = 1920

    backup_dir: str = "/data/backups"

    @property
    def photos_root_path(self) -> Path:
        return Path(self.photos_root)


settings = Settings()
