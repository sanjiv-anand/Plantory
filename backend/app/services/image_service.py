from __future__ import annotations

import imghdr
from io import BytesIO
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from app.core.config import settings

register_heif_opener()


def _safe_ext(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in {".heic", ".heif"}:
        return ".jpg"
    return ext if ext else ".jpg"


def _validate_bytes(data: bytes) -> None:
    image_type = imghdr.what(None, h=data)
    if image_type in {"jpeg", "png", "webp"}:
        return
    try:
        with Image.open(BytesIO(data)) as img:
            fmt = (img.format or "").upper()
            if fmt in {"HEIF", "HEIC", "JPEG", "PNG", "WEBP"}:
                return
    except Exception:
        pass
    raise HTTPException(status_code=400, detail="Unsupported image format. Use JPEG/PNG/WebP/HEIC.")


def _build_paths(plant_id: int, captured_at: datetime, ext: str) -> tuple[Path, Path, Path]:
    day_path = captured_at.strftime("%Y/%m/%d")
    base_dir = settings.photos_root_path / "plants" / str(plant_id) / day_path
    base_dir.mkdir(parents=True, exist_ok=True)
    uid = uuid4().hex
    original = base_dir / f"{uid}_original{ext}"
    display = base_dir / f"{uid}_display.jpg"
    thumb = base_dir / f"{uid}_thumb.jpg"
    return original, display, thumb


def _to_media(path: Path) -> str:
    return f"{settings.photos_public_base}/{path.relative_to(settings.photos_root_path)}"


def to_fs_path(media_path: str) -> Path:
    relative = media_path.replace(f"{settings.photos_public_base}/", "", 1)
    return settings.photos_root_path / relative


async def process_upload(plant_id: int, captured_at: datetime, upload: UploadFile) -> dict[str, str]:
    raw = await upload.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.max_upload_mb}MB")

    _validate_bytes(raw)
    ext = _safe_ext(upload.filename or "photo.jpg")
    original_path, display_path, thumb_path = _build_paths(plant_id, captured_at, ext)

    original_path.write_bytes(raw)

    with Image.open(original_path) as img:
        normalized = ImageOps.exif_transpose(img).convert("RGB")

        display = normalized.copy()
        if display.width > settings.display_max_width:
            ratio = settings.display_max_width / display.width
            display = display.resize((settings.display_max_width, int(display.height * ratio)), Image.Resampling.LANCZOS)
        display.save(display_path, format="JPEG", quality=88, optimize=True)

        thumb = normalized.copy()
        thumb.thumbnail((settings.thumbnail_size, settings.thumbnail_size), Image.Resampling.LANCZOS)
        thumb.save(thumb_path, format="JPEG", quality=85, optimize=True)

    return {
        "photo_path": _to_media(original_path),
        "display_path": _to_media(display_path),
        "thumbnail_path": _to_media(thumb_path),
        "original_filename": upload.filename or "",
    }
