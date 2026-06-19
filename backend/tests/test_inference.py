import json
import time
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import numpy as np
import pytest

from app.exceptions import GPUOutOfMemoryError, MissingTokenError, VideoFormatError
from app.schemas.inference import JobStatus
from app.services.inference import (
    NUM_VERTICES,
    _apply_hemodynamic_delay,
    _validate_video,
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


class TestVideoValidation:
    def test_missing_file_raises(self, tmp_path):
        fake_path = tmp_path / "nonexistent.mp4"
        with pytest.raises(VideoFormatError, match="not found"):
            _validate_video(fake_path)

    def test_unsupported_extension_raises(self, tmp_path):
        bad_file = tmp_path / "video.mkv"
        bad_file.write_bytes(b"fake")
        with pytest.raises(VideoFormatError, match="Unsupported video format"):
            _validate_video(bad_file)

    def test_empty_file_raises(self, tmp_path):
        empty_file = tmp_path / "video.mp4"
        empty_file.touch()
        with pytest.raises(VideoFormatError, match="empty or corrupted"):
            _validate_video(empty_file)

    def test_valid_file_passes(self, tmp_path):
        valid_file = tmp_path / "video.mp4"
        valid_file.write_bytes(b"fake video data")
        _validate_video(valid_file)

    def test_error_lists_accepted_formats(self, tmp_path):
        bad_file = tmp_path / "video.flv"
        bad_file.write_bytes(b"fake")
        with pytest.raises(VideoFormatError, match="avi.*mov.*mp4.*webm"):
            _validate_video(bad_file)


class TestMissingTokenError:
    @pytest.fixture(autouse=True)
    def _reset_model(self):
        import app.services.inference as inf_mod
        inf_mod._model = None
        yield
        inf_mod._model = None

    def _make_tribev2_mock(self, from_pretrained_fn=None):
        if from_pretrained_fn is None:
            from_pretrained_fn = staticmethod(lambda *a, **kw: "model")
        return type("module", (), {
            "TribeModel": type("TribeModel", (), {
                "from_pretrained": from_pretrained_fn,
            }),
        })()

    def test_empty_token_raises(self, monkeypatch):
        import app.services.inference as inf_mod

        monkeypatch.setattr("app.services.inference.settings.hf_token", "")
        mock_mod = self._make_tribev2_mock()
        with patch.dict("sys.modules", {"tribev2": mock_mod}):
            with pytest.raises(MissingTokenError, match="NEUROSCORE_HF_TOKEN"):
                inf_mod._load_model()

    def test_auth_failure_raises(self, monkeypatch):
        import app.services.inference as inf_mod

        monkeypatch.setattr("app.services.inference.settings.hf_token", "bad-token")
        mock_mod = self._make_tribev2_mock(
            from_pretrained_fn=staticmethod(
                lambda *a, **kw: (_ for _ in ()).throw(
                    OSError("401 Unauthorized")
                )
            )
        )
        with patch.dict("sys.modules", {"tribev2": mock_mod}):
            with pytest.raises(MissingTokenError, match="authentication failed"):
                inf_mod._load_model()


class TestGPUOutOfMemoryError:
    def test_cuda_oom_raises(self, tmp_path, monkeypatch):
        from app.services.inference import run_inference

        monkeypatch.setattr("app.services.inference.settings.hf_token", "valid")
        video_path = tmp_path / "video.mp4"
        video_path.write_bytes(b"fake video data")

        mock_model = type("MockModel", (), {
            "get_events_dataframe": lambda self, path: "events",
            "predict": lambda self, events: (_ for _ in ()).throw(
                RuntimeError("CUDA out of memory. Tried to allocate 2 GiB")
            ),
        })()

        with patch("app.services.inference._load_model", return_value=mock_model):
            with pytest.raises(GPUOutOfMemoryError, match="reducing the video length"):
                run_inference(video_path, uuid4())

    def test_memory_error_raises(self, tmp_path, monkeypatch):
        from app.services.inference import run_inference

        monkeypatch.setattr("app.services.inference.settings.hf_token", "valid")
        video_path = tmp_path / "video.mp4"
        video_path.write_bytes(b"fake video data")

        mock_model = type("MockModel", (), {
            "get_events_dataframe": lambda self, path: "events",
            "predict": lambda self, events: (_ for _ in ()).throw(MemoryError()),
        })()

        with patch("app.services.inference._load_model", return_value=mock_model):
            with pytest.raises(GPUOutOfMemoryError, match="out of memory"):
                run_inference(video_path, uuid4())


class TestVideoFormatErrorInInference:
    def test_corrupted_video_raises(self, tmp_path, monkeypatch):
        from app.services.inference import run_inference

        monkeypatch.setattr("app.services.inference.settings.hf_token", "valid")
        video_path = tmp_path / "video.mp4"
        video_path.write_bytes(b"not a real video")

        mock_model = type("MockModel", (), {
            "get_events_dataframe": lambda self, path: (_ for _ in ()).throw(
                ValueError("Cannot decode video stream")
            ),
        })()

        with patch("app.services.inference._load_model", return_value=mock_model):
            with pytest.raises(VideoFormatError, match="corrupted"):
                run_inference(video_path, uuid4())


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

    def test_job_captures_missing_token_error(self, tmp_path):
        video_id = uuid4()
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch(
            "app.services.jobs.run_inference",
            side_effect=MissingTokenError("Set NEUROSCORE_HF_TOKEN"),
        ):
            job = submit_inference(video_path, video_id)
            result = self._wait_for_job(job.job_id)

        assert result is not None
        assert result.status == JobStatus.FAILED
        assert "NEUROSCORE_HF_TOKEN" in result.error

    def test_job_captures_video_format_error(self, tmp_path):
        video_id = uuid4()
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch(
            "app.services.jobs.run_inference",
            side_effect=VideoFormatError("Unsupported format"),
        ):
            job = submit_inference(video_path, video_id)
            result = self._wait_for_job(job.job_id)

        assert result is not None
        assert result.status == JobStatus.FAILED
        assert "Unsupported format" in result.error

    def test_job_captures_gpu_oom_error(self, tmp_path):
        video_id = uuid4()
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch(
            "app.services.jobs.run_inference",
            side_effect=GPUOutOfMemoryError("GPU ran out of memory"),
        ):
            job = submit_inference(video_path, video_id)
            result = self._wait_for_job(job.job_id)

        assert result is not None
        assert result.status == JobStatus.FAILED
        assert "out of memory" in result.error
