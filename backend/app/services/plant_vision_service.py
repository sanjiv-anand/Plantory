"""Future vision model integration — not implemented."""

from __future__ import annotations


class PlantVisionService:
    """Placeholder for future photo analysis via a local vision model."""

    @property
    def available(self) -> bool:
        return False

    async def analyze_photo(self, photo_path: str) -> dict | None:
        """Return structured observations from a plant photo when a vision model is available."""
        return None


plant_vision_service = PlantVisionService()
