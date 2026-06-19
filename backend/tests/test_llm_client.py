from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
import pytest

from app.exceptions import (
    LLMAuthenticationError,
    LLMConnectionError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.services import llm_client
from app.services.llm_client import SYSTEM_PROMPT, generate, reset_client


@pytest.fixture(autouse=True)
def _reset():
    reset_client()
    yield
    reset_client()


class TestSystemPrompt:
    def test_mentions_five_networks(self):
        for network in ["Visual", "Auditory", "Attention", "Salience", "Default Mode"]:
            assert network in SYSTEM_PROMPT

    def test_mentions_scoring_scale(self):
        assert "0-100" in SYSTEM_PROMPT
        for label in ["Very Strong", "Strong", "Moderate", "Weak", "Very Weak"]:
            assert label in SYSTEM_PROMPT

    def test_mentions_tribe(self):
        assert "TRIBE v2" in SYSTEM_PROMPT

    def test_requests_json_output(self):
        assert "JSON" in SYSTEM_PROMPT


class TestGetClient:
    def test_missing_api_key_raises(self, monkeypatch):
        monkeypatch.setattr("app.services.llm_client.settings.anthropic_api_key", "")
        with pytest.raises(LLMAuthenticationError, match="API key is required"):
            llm_client._get_client()

    def test_creates_client_with_key(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test-key"
        )
        monkeypatch.setattr("app.services.llm_client.settings.llm_max_retries", 2)
        monkeypatch.setattr("app.services.llm_client.settings.llm_timeout_seconds", 30.0)
        client = llm_client._get_client()
        assert isinstance(client, anthropic.AsyncAnthropic)

    def test_reuses_cached_client(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test-key"
        )
        first = llm_client._get_client()
        second = llm_client._get_client()
        assert first is second

    def test_reset_clears_cache(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test-key"
        )
        first = llm_client._get_client()
        reset_client()
        second = llm_client._get_client()
        assert first is not second


def _mock_message(text: str) -> MagicMock:
    block = MagicMock()
    block.text = text
    msg = MagicMock()
    msg.content = [block]
    return msg


class TestGenerate:
    @pytest.mark.asyncio
    async def test_returns_response_text(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_create = AsyncMock(return_value=_mock_message("hello"))
        with patch.object(
            anthropic.AsyncAnthropic, "messages", create=True
        ) as mock_messages:
            mock_messages.create = mock_create
            reset_client()
            monkeypatch.setattr(
                "app.services.llm_client.settings.anthropic_api_key", "sk-test"
            )
            client = llm_client._get_client()
            client.messages = MagicMock()
            client.messages.create = mock_create
            result = await generate("test prompt")
            assert result == "hello"

    @pytest.mark.asyncio
    async def test_uses_default_system_prompt(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_create = AsyncMock(return_value=_mock_message("ok"))
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        await generate("test")
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["system"] == SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_custom_system_prompt(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_create = AsyncMock(return_value=_mock_message("ok"))
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        await generate("test", system="custom system")
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["system"] == "custom system"

    @pytest.mark.asyncio
    async def test_auth_error_wrapped(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-bad"
        )
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.headers = {}
        mock_create = AsyncMock(
            side_effect=anthropic.AuthenticationError(
                message="invalid key",
                response=mock_resp,
                body=None,
            )
        )
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        with pytest.raises(LLMAuthenticationError, match="authentication failed"):
            await generate("test")

    @pytest.mark.asyncio
    async def test_rate_limit_error_wrapped(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.headers = {}
        mock_create = AsyncMock(
            side_effect=anthropic.RateLimitError(
                message="rate limited",
                response=mock_resp,
                body=None,
            )
        )
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        with pytest.raises(LLMRateLimitError, match="temporarily busy"):
            await generate("test")

    @pytest.mark.asyncio
    async def test_timeout_error_wrapped(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_create = AsyncMock(
            side_effect=anthropic.APITimeoutError(request=MagicMock())
        )
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        with pytest.raises(LLMTimeoutError, match="timed out"):
            await generate("test")

    @pytest.mark.asyncio
    async def test_connection_error_wrapped(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_create = AsyncMock(
            side_effect=anthropic.APIConnectionError(request=MagicMock())
        )
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        with pytest.raises(LLMConnectionError, match="Could not connect"):
            await generate("test")

    @pytest.mark.asyncio
    async def test_generic_api_error_wrapped(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.llm_client.settings.anthropic_api_key", "sk-test"
        )
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.headers = {}
        mock_create = AsyncMock(
            side_effect=anthropic.InternalServerError(
                message="server error",
                response=mock_resp,
                body=None,
            )
        )
        client = llm_client._get_client()
        client.messages = MagicMock()
        client.messages.create = mock_create
        with pytest.raises(LLMError, match="returned an error"):
            await generate("test")
