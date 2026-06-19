import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app.schemas.inference import InferenceJob, JobStatus, PredictionMetadata
from app.services.inference import load_inference_metadata, run_inference

logger = logging.getLogger(__name__)

_jobs: dict[str, InferenceJob] = {}
_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=1)


def get_job(job_id: str) -> InferenceJob | None:
    with _lock:
        return _jobs.get(job_id)


def get_job_for_video(video_id: UUID) -> InferenceJob | None:
    with _lock:
        for job in reversed(list(_jobs.values())):
            if job.video_id == video_id and job.status in (
                JobStatus.PENDING,
                JobStatus.PROCESSING,
            ):
                return job
    return None


def submit_inference(video_path: Path, video_id: UUID) -> InferenceJob:
    active = get_job_for_video(video_id)
    if active is not None:
        return active

    job_id = str(uuid4())
    now = datetime.now(timezone.utc)
    job = InferenceJob(
        job_id=job_id,
        video_id=video_id,
        status=JobStatus.PENDING,
        created_at=now,
    )
    with _lock:
        _jobs[job_id] = job

    _executor.submit(_run_job, job_id, video_path, video_id)
    logger.info("Submitted inference job %s for video %s", job_id, video_id)
    return job


def _run_job(job_id: str, video_path: Path, video_id: UUID) -> None:
    with _lock:
        job = _jobs[job_id]
        job = job.model_copy(
            update={
                "status": JobStatus.PROCESSING,
                "started_at": datetime.now(timezone.utc),
            }
        )
        _jobs[job_id] = job

    try:
        metadata = run_inference(video_path, video_id)
        prediction = PredictionMetadata(**metadata)
        with _lock:
            _jobs[job_id] = job.model_copy(
                update={
                    "status": JobStatus.COMPLETED,
                    "prediction": prediction,
                    "completed_at": datetime.now(timezone.utc),
                }
            )
        logger.info("Job %s completed successfully", job_id)
    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        with _lock:
            _jobs[job_id] = job.model_copy(
                update={
                    "status": JobStatus.FAILED,
                    "error": str(exc),
                    "completed_at": datetime.now(timezone.utc),
                }
            )
