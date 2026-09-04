from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import settings


class LLMUnavailableError(Exception):
    """Raised when the local LLM service cannot be reached."""


class LLMTimeoutError(Exception):
    """Raised when the local LLM service times out."""


class LLMResponseError(Exception):
    """Raised when the local LLM returns an invalid response."""


class LLMService:
    def __init__(self) -> None:
        self._semaphore = asyncio.Semaphore(settings.llm_max_concurrent_requests)

    @property
    def base_url(self) -> str:
        return settings.llm_base_url.rstrip("/")

    async def is_available(self) -> bool:
        if not settings.llm_enabled:
            return False
        try:
            async with httpx.AsyncClient(timeout=settings.llm_health_timeout_seconds) as client:
                response = await client.get(f"{self.base_url}/v1/models")
                return response.status_code == 200
        except (httpx.HTTPError, OSError):
            return False

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
        stream: bool = False,
    ) -> str | AsyncIterator[str]:
        if not settings.llm_enabled:
            raise LLMUnavailableError("Assistant is disabled")

        payload: dict[str, Any] = {
            "model": settings.llm_model,
            "messages": messages,
            "max_tokens": max_tokens or settings.llm_max_tokens,
            "temperature": temperature if temperature is not None else settings.llm_temperature,
            "stream": stream,
        }

        async with self._semaphore:
            try:
                if stream:
                    return self._stream_chat(payload)
                return await self._complete_chat(payload)
            except httpx.TimeoutException as exc:
                raise LLMTimeoutError("Local LLM request timed out") from exc
            except httpx.HTTPError as exc:
                raise LLMUnavailableError("Local LLM service is unavailable") from exc

    async def _complete_chat(self, payload: dict[str, Any]) -> str:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            response = await client.post(f"{self.base_url}/v1/chat/completions", json={**payload, "stream": False})
            if response.status_code >= 500:
                raise LLMUnavailableError("Local LLM service is unavailable")
            if response.status_code >= 400:
                raise LLMResponseError("Local LLM returned an error response")
            data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMResponseError("Malformed LLM response") from exc
        if not isinstance(content, str):
            raise LLMResponseError("Malformed LLM response")
        return content.strip()

    async def _stream_chat(self, payload: dict[str, Any]) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/v1/chat/completions",
                json={**payload, "stream": True},
            ) as response:
                if response.status_code >= 400:
                    raise LLMResponseError("Local LLM returned an error response")
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    chunk = line[6:].strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        parsed = json.loads(chunk)
                        delta = parsed["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                        continue
                    if delta:
                        yield delta


llm_service = LLMService()
