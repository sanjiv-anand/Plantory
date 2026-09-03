from pathlib import Path

from app.core.config import settings


def ensure_storage_dirs() -> None:
    Path(settings.photos_root).mkdir(parents=True, exist_ok=True)
    Path(settings.backup_dir).mkdir(parents=True, exist_ok=True)
