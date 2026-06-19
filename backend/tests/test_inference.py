import json
from pathlib import Path
from uuid import uuid4

import numpy as np
import pytest

from app.services.inference import (
    NUM_VERTICES,
    _apply_hemodynamic_delay,
    load_inference_metadata,
    load_prediction,
)


class TestHemodynamicDelay:
    def test_no_delay(self):
        preds = np.ones((10, NUM_VERTICES))
        result = _apply_hemodynamic_delay(preds, 0)
        np.testing.assert_array_equal(result, preds)

    def test_delay_shifts_forward(self):
        preds = np.arange(30).reshape(10, 3)
        result = _apply_hemodynamic_delay(preds, 5)
        np.testing.assert_array_equal(result[:5], np.zeros((5, 3)))
        np.testing.assert_array_equal(result[5:], preds[:5])

    def test_delay_preserves_shape(self):
        preds = np.random.randn(20, NUM_VERTICES)
        result = _apply_hemodynamic_delay(preds, 5)
        assert result.shape == preds.shape

    def test_delay_exceeds_length(self):
        preds = np.ones((3, 5))
        result = _apply_hemodynamic_delay(preds, 10)
        np.testing.assert_array_equal(result, np.zeros((3, 5)))

    def test_negative_delay(self):
        preds = np.ones((5, 3))
        result = _apply_hemodynamic_delay(preds, -1)
        np.testing.assert_array_equal(result, preds)


class TestPredictionStorage:
    def test_load_prediction_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.inference.settings.upload_dir", tmp_path)
        result = load_prediction(uuid4())
        assert result is None

    def test_load_prediction_roundtrip(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.inference.settings.upload_dir", tmp_path)
        video_id = uuid4()
        video_dir = tmp_path / str(video_id)
        video_dir.mkdir()
        predictions = np.random.randn(10, NUM_VERTICES).astype(np.float32)
        np.save(video_dir / "predictions.npy", predictions)
        loaded = load_prediction(video_id)
        np.testing.assert_array_almost_equal(loaded, predictions)

    def test_load_inference_metadata_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.inference.settings.upload_dir", tmp_path)
        result = load_inference_metadata(uuid4())
        assert result is None

    def test_load_inference_metadata_roundtrip(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.inference.settings.upload_dir", tmp_path)
        video_id = uuid4()
        video_dir = tmp_path / str(video_id)
        video_dir.mkdir()
        meta = {
            "video_id": str(video_id),
            "model_id": "facebook/tribev2",
            "duration_seconds": 10.0,
            "num_timepoints": 10,
            "num_vertices": NUM_VERTICES,
            "hemodynamic_delay_seconds": 5,
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        (video_dir / "inference.json").write_text(json.dumps(meta))
        loaded = load_inference_metadata(video_id)
        assert loaded["num_timepoints"] == 10
        assert loaded["num_vertices"] == NUM_VERTICES
