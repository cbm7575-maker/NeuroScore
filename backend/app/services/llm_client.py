import logging

import anthropic

from app.config import settings
from app.exceptions import (
    LLMAuthenticationError,
    LLMConnectionError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are NeuroScore, an expert neural video performance analyst. You interpret "
    "brain activation data from the TRIBE v2 neuroimaging model, which predicts how "
    "viewers' brains respond to video content.\n"
    "\n"
    "You analyze five cortical networks:\n"
    "- Visual Network: processes visual stimuli including scene complexity, color, "
    "motion, faces, and visual novelty.\n"
    "- Auditory Network: processes sound including speech, music, sound effects, "
    "and audio dynamics.\n"
    "- Attention Network: governs focused attention including pacing, information "
    "density, and cognitive load.\n"
    "- Salience Network: detects emotional and motivational significance including "
    "surprise, humor, controversy, and urgency.\n"
    "- Default Mode Network: activates during self-referential thought including "
    "personal relevance, storytelling, empathy, and daydreaming.\n"
    "\n"
    "Scoring scale (0-100):\n"
    "- 80-100 Very Strong: exceptional neural engagement\n"
    "- 60-79 Strong: above-average engagement\n"
    "- 40-59 Moderate: typical engagement\n"
    "- 20-39 Weak: below-average engagement, improvement needed\n"
    "- 0-19 Very Weak: minimal engagement, significant changes required\n"
    "\n"
    "You provide actionable, creator-friendly insights. Your analysis connects "
    "neural data to concrete content decisions: what to keep, what to change, and "
    "where to focus editing effort. Always respond with valid JSON only."
)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is not None:
        return _client

    if not settings.anthropic_api_key:
        raise LLMAuthenticationError(
            "Anthropic API key is required. "
            "Set NEUROSCORE_ANTHROPIC_API_KEY in your environment or .env file."
        )

    _client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        max_retries=settings.llm_max_retries,
        timeout=settings.llm_timeout_seconds,
    )
    return _client


async def generate(prompt: str, *, system: str | None = None) -> str:
    """Send a prompt to the LLM and return the response text.

    Uses the neural-interpretation system prompt by default.
    Pass *system* to override.
    """
    client = _get_client()
    system_text = system if system is not None else SYSTEM_PROMPT

    try:
        message = await client.messages.create(
            model=settings.analysis_model,
            max_tokens=4096,
            system=system_text,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    except anthropic.AuthenticationError as exc:
        logger.error("LLM authentication failed: %s", exc)
        raise LLMAuthenticationError(
            "Anthropic API authentication failed. "
            "Verify your NEUROSCORE_ANTHROPIC_API_KEY is valid."
        ) from exc

    except anthropic.RateLimitError as exc:
        logger.warning("LLM rate limit exceeded after retries: %s", exc)
        raise LLMRateLimitError(
            "Analysis service is temporarily busy. "
            "Please try again in a few minutes."
        ) from exc

    except anthropic.APITimeoutError as exc:
        logger.warning("LLM request timed out: %s", exc)
        raise LLMTimeoutError(
            "Analysis request timed out. The video may be too long "
            "or the service is under heavy load. Please try again."
        ) from exc

    except anthropic.APIConnectionError as exc:
        logger.error("LLM connection failed: %s", exc)
        raise LLMConnectionError(
            "Could not connect to the analysis service. "
            "Please check your internet connection and try again."
        ) from exc

    except anthropic.APIStatusError as exc:
        logger.error("LLM API error (status %s): %s", exc.status_code, exc)
        raise LLMError(
            "Analysis service returned an error. Please try again later."
        ) from exc


def reset_client() -> None:
    """Reset the cached client (useful for testing or config changes)."""
    global _client
    _client = None
