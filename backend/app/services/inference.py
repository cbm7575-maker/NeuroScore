import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import numpy as np

from app.config import settings
from app.exceptions import GPUOutOfMemoryError, MissingTokenError, VideoFormatError

logger = logging.getLogger(__name__)

NUM_VERTICES = 20484

ACCEPTED_FORMATS = sorted(settings.allowed_extensions)

_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model

    try:
        from tribev2 import TribeModel
    except ImportError:
        raise RuntimeError(
            "tribev2 is not installed. Install with: pip install 'neuroscore[tribe]'"
        )

    if not settings.hf_token:
        logger.error("HuggingFace token is not configured")
        raise MissingTokenError(
            "HuggingFace token is required. "
            "Set NEUROSCORE_HF_TOKEN in your environment or .env file. "
            "Get a token at https://huggingface.co/settings/tokens"
        )

    logger.info("Loading TRIBE v2 model: %s", settings.tribe_model_id)
    try:
        _model = TribeModel.from_pretrained(
            settings.tribe_model_id,
            token=settings.hf_token,
        )
    except OSError as exc:
        if "401" in str(exc) or "unauthorized" in str(exc).lower():
            logger.error("HuggingFace authentication failed: %s", exc)
            raise MissingTokenError(
                "HuggingFace authentication failed. "
                "Verify your NEUROSCORE_HF_TOKEN is valid and has access to "
                f"'{settings.tribe_model_id}'. "
                "Get a token at https://huggingface.co/settings/tokens"
            ) from exc
        raise
    logger.info("TRIBE v2 model loaded successfully")
    return _model


def _apply_hemodynamic_delay(predictions: np.ndarray, delay_seconds: int) -> np.ndarray:
    if delay_seconds <= 0:
        return predictions
    shifted = np.zeros_like(predictions)
    if delay_seconds < predictions.shape[0]:
        shifted[delay_seconds:] = predictions[:-delay_seconds]
    return shifted


def _validate_video(video_path: Path) -> None:
    if not video_path.exists():
        raise VideoFormatError(f"Video file not found: {video_path.name}")

    ext = video_path.suffix.lstrip(".").lower()
    if ext not in settings.allowed_extensions:
        raise VideoFormatError(
            f"Unsupported video format '.{ext}'. "
            f"Accepted formats: {', '.join(ACCEPTED_FORMATS)}"
        )

    if video_path.stat().st_size == 0:
        raise VideoFormatError("Video file is empty or corrupted")


def run_inference(video_path: Path, video_id: UUID) -> dict:
    _validate_video(video_path)

    model = _load_model()

    logger.info("Running inference on video %s", video_id)

    try:
        events = model.get_events_dataframe(str(video_path))
    except Exception as exc:
        logger.error("Failed to extract events from video %s: %s", video_id, exc)
        raise VideoFormatError(
            f"Could not process video file. The file may be corrupted or in an "
            f"unsupported format. Accepted formats: {', '.join(ACCEPTED_FORMATS)}"
        ) from exc

    try:
        raw_predictions = model.predict(events)
    except RuntimeError as exc:
        if "out of memory" in str(exc).lower() or "CUDA" in str(exc):
            logger.error("GPU OOM during inference for video %s: %s", video_id, exc)
            raise GPUOutOfMemoryError(
                "GPU ran out of memory during inference. "
                "Try reducing the video length or resolution before uploading."
            ) from exc
        raise
    except MemoryError as exc:
        logger.error("OOM during inference for video %s: %s", video_id, exc)
        raise GPUOutOfMemoryError(
            "Ran out of memory during inference. "
            "Try reducing the video length or resolution before uploading."
        ) from exc

    if not isinstance(raw_predictions, np.ndarray):
        raw_predictions = np.array(raw_predictions)

    if raw_predictions.ndim != 2 or raw_predictions.shape[1] != NUM_VERTICES:
        raise RuntimeError(
            f"Unexpected prediction shape {raw_predictions.shape}, "
            f"expected (T, {NUM_VERTICES})"
        )

    predictions = _apply_hemodynamic_delay(
        raw_predictions, settings.hemodynamic_delay_seconds
    )

    output_dir = settings.upload_dir / str(video_id)
    prediction_path = output_dir / "predictions.npy"
    np.save(prediction_path, predictions)

    metadata = {
        "video_id": str(video_id),
        "model_id": settings.tribe_model_id,
        "duration_seconds": float(predictions.shape[0]),
        "num_timepoints": predictions.shape[0],
        "num_vertices": predictions.shape[1],
        "hemodynamic_delay_seconds": settings.hemodynamic_delay_seconds,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    inference_path = output_dir / "inference.json"
    inference_path.write_text(json.dumps(metadata, indent=2))

    logger.info("Inference complete: %s → shape %s", video_id, predictions.shape)
    return metadata


def load_prediction(video_id: UUID) -> np.ndarray | None:
    prediction_path = settings.upload_dir / str(video_id) / "predictions.npy"
    if not prediction_path.exists():
        return None
    return np.load(prediction_path)


def load_inference_metadata(video_id: UUID) -> dict | None:
    inference_path = settings.upload_dir / str(video_id) / "inference.json"
    if not inference_path.exists():
        return None
    return json.loads(inference_path.read_text())
