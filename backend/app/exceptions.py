class InferenceError(Exception):
    """Base class for inference pipeline errors."""


class MissingTokenError(InferenceError):
    """HuggingFace token is missing or invalid."""


class GPUOutOfMemoryError(InferenceError):
    """GPU ran out of memory during inference."""


class VideoFormatError(InferenceError):
    """Video format is unsupported or file is corrupted."""
