from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user, get_db
from app.api.routes.ai import router as ai_router
from app.models.app_user import AppUser
from app.services.plant_assistant_service import PlantAssistantService


@pytest.fixture
def client():
    user = AppUser(id=1, display_name="Owner")
    db = MagicMock()

    app = FastAPI()
    app.include_router(ai_router, prefix="/api/ai")

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)


def test_ai_status_endpoint(client):
    with patch.object(PlantAssistantService, "status", AsyncMock(return_value={
        "online": False,
        "assistant_enabled": True,
        "daily_summary_enabled": False,
        "story_enabled": True,
        "model": "Qwen3-0.6B",
        "runtime": "Local llama.cpp",
        "privacy": "local",
        "max_tokens": 256,
        "temperature": 0.3,
    })):
        response = client.get("/api/ai/status")
    assert response.status_code == 200
    assert response.json()["model"] == "Qwen3-0.6B"
