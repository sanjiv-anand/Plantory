from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.llm_service import LLMResponseError, LLMService, LLMTimeoutError, LLMUnavailableError


@pytest.mark.asyncio
async def test_llm_unavailable_when_disabled():
    service = LLMService()
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.llm_enabled = False
        with pytest.raises(LLMUnavailableError):
            await service.chat_completion([{"role": "user", "content": "hi"}])


@pytest.mark.asyncio
async def test_llm_unavailable_on_connection_error():
    service = LLMService()
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.llm_enabled = True
        mock_settings.llm_base_url = "http://llm:8080"
        mock_settings.llm_model = "test"
        mock_settings.llm_max_tokens = 64
        mock_settings.llm_temperature = 0.1
        mock_settings.llm_timeout_seconds = 5
        mock_settings.llm_max_concurrent_requests = 1
        with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("down")):
            with pytest.raises(LLMUnavailableError):
                await service.chat_completion([{"role": "user", "content": "hi"}])


@pytest.mark.asyncio
async def test_llm_timeout():
    service = LLMService()
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.llm_enabled = True
        mock_settings.llm_base_url = "http://llm:8080"
        mock_settings.llm_model = "test"
        mock_settings.llm_max_tokens = 64
        mock_settings.llm_temperature = 0.1
        mock_settings.llm_timeout_seconds = 5
        mock_settings.llm_max_concurrent_requests = 1
        with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("slow")):
            with pytest.raises(LLMTimeoutError):
                await service.chat_completion([{"role": "user", "content": "hi"}])


@pytest.mark.asyncio
async def test_llm_successful_response():
    service = LLMService()
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"choices": [{"message": {"content": "Hello from Plantory."}}]}
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.llm_enabled = True
        mock_settings.llm_base_url = "http://llm:8080"
        mock_settings.llm_model = "test"
        mock_settings.llm_max_tokens = 64
        mock_settings.llm_temperature = 0.1
        mock_settings.llm_timeout_seconds = 5
        mock_settings.llm_max_concurrent_requests = 1
        with patch("httpx.AsyncClient.post", return_value=response):
            result = await service.chat_completion([{"role": "user", "content": "hi"}])
    assert result == "Hello from Plantory."


@pytest.mark.asyncio
async def test_llm_malformed_response():
    service = LLMService()
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"choices": []}
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.llm_enabled = True
        mock_settings.llm_base_url = "http://llm:8080"
        mock_settings.llm_model = "test"
        mock_settings.llm_max_tokens = 64
        mock_settings.llm_temperature = 0.1
        mock_settings.llm_timeout_seconds = 5
        mock_settings.llm_max_concurrent_requests = 1
        with patch("httpx.AsyncClient.post", return_value=response):
            with pytest.raises(LLMResponseError):
                await service.chat_completion([{"role": "user", "content": "hi"}])


@pytest.mark.asyncio
async def test_llm_is_available():
    service = LLMService()
    response = MagicMock()
    response.status_code = 200
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.llm_enabled = True
        mock_settings.llm_base_url = "http://llm:8080"
        mock_settings.llm_health_timeout_seconds = 2
        with patch("httpx.AsyncClient.get", return_value=response):
            assert await service.is_available() is True
