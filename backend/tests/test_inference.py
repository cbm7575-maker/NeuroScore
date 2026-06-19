import json
import time
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import numpy as np
import pytest

from app.schemas.inference import JobStatus
from app.services.inference import (
    NUM_VERTICES,
    _apply_hemodynamic_delay,
    load_inference_metadata,
    load_prediction,
)
from app.services.jobs import _jobs, _lock, get_job, get_job_for_video, submit_inference


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


class TestJobSubmission:
    @pytest.fixture(autouse=True)
    def _clear_jobs(self):
        with _lock:
            _jobs.clear()
        yield
        with _lock:
            _jobs.clear()

    def test_submit_returns_pending_job(self, tmp_path):
        video_id = uuid4()
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch("app.services.jobs.run_inference", side_effect=lambda *a: time.sleep(5)):
            job = submit_inference(video_path, video_id)

        assert job.status == JobStatus.PENDING
        assert job.video_id == video_id
        assert job.job_id is not None

    def test_submit_deduplicates_active_jobs(self, tmp_path):
        video_id = uuid4()
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch("app.services.jobs.run_inference", side_effect=lambda *a: time.sleep(5)):
            job1 = submit_inference(video_path, video_id)
            job2 = submit_inference(video_path, video_id)

        assert job1.job_id == job2.job_id

    def test_get_job_returns_none_for_unknown(self):
        assert get_job("nonexistent") is None

    def test_get_job_for_video_returns_none_when_empty(self):
        assert get_job_for_video(uuid4()) is None

    def _wait_for_job(self, job_id: str, timeout: float = 5.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            result = get_job(job_id)
            if result and result.status not in (JobStatus.PENDING, JobStatus.PROCESSING):
                return result
            time.sleep(0.1)
        return get_job(job_id)

    def test_job_completes_successfully(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.inference.settings.upload_dir", tmp_path)
        video_id = uuid4()
        video_dir = tmp_path / str(video_id)
        video_dir.mkdir()
        video_path = video_dir / "video.mp4"
        video_path.touch()

        fake_meta = {
            "video_id": str(video_id),
            "model_id": "facebook/tribev2",
            "duration_seconds": 10.0,
            "num_timepoints": 10,
            "num_vertices": NUM_VERTICES,
            "hemodynamic_delay_seconds": 5,
            "created_at": "2026-01-01T00:00:00+00:00",
        }

        with patch("app.services.jobs.run_inference", return_value=fake_meta):
            job = submit_inference(video_path, video_id)
            result = self._wait_for_job(job.job_id)

        assert result is not None
        assert result.status == JobStatus.COMPLETED
        assert result.prediction is not None
        assert result.completed_at is not None

    def test_job_fails_on_error(self, tmp_path):
        video_id = uuid4()
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch("app.services.jobs.run_inference", side_effect=RuntimeError("GPU OOM")):
            job = submit_inference(video_path, video_id)
            result = self._wait_for_job(job.job_id)

        assert result is not None
        assert result.status == JobStatus.FAILED
        assert result.error == "GPU OOM"
        assert result.completed_at is not None
