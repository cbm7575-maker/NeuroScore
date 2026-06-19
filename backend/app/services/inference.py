import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

NUM_VERTICES = 20484

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

    logger.info("Loading TRIBE v2 model: %s", settings.tribe_model_id)
    _model = TribeModel.from_pretrained(
        settings.tribe_model_id,
        token=settings.hf_token or None,
    )
    logger.info("TRIBE v2 model loaded successfully")
    return _model


def _apply_hemodynamic_delay(predictions: np.ndarray, delay_seconds: int) -> np.ndarray:
    if delay_seconds <= 0:
        return predictions
    shifted = np.zeros_like(predictions)
    if delay_seconds < predictions.shape[0]:
        shifted[delay_seconds:] = predictions[:-delay_seconds]
    return shifted


def run_inference(video_path: Path, video_id: UUID) -> dict:
    model = _load_model()

    logger.info("Running inference on video %s", video_id)
    events = model.get_events_dataframe(str(video_path))
    raw_predictions = model.predict(events)

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
