class InferenceError(Exception):
    """Base class for inference pipeline errors."""


class MissingTokenError(InferenceError):
    """HuggingFace token is missing or invalid."""


class GPUOutOfMemoryError(InferenceError):
    """GPU ran out of memory during inference."""


class VideoFormatError(InferenceError):
    """Video format is unsupported or file is corrupted."""


class LLMError(Exception):
    """Base class for LLM API errors."""


class LLMAuthenticationError(LLMError):
    """API key is missing or invalid."""


class LLMRateLimitError(LLMError):
    """Rate limit exceeded after retries."""


class LLMTimeoutError(LLMError):
    """Request timed out."""


class LLMConnectionError(LLMError):
    """Could not connect to the LLM API."""
