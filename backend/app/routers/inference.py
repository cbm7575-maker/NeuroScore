import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.exceptions import GPUOutOfMemoryError, MissingTokenError, VideoFormatError
from app.schemas.inference import InferenceJob, InferenceResponse, PredictionMetadata
from app.services.inference import load_inference_metadata
from app.services.jobs import get_job, get_job_for_video, submit_inference
from app.services.video import get_video_path, load_metadata

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inference", tags=["inference"])


@router.post("/{video_id}", response_model=InferenceJob)
async def run_video_inference(video_id: UUID, force: bool = Query(default=False)):
    video_meta = load_metadata(video_id)
    if video_meta is None:
        raise HTTPException(status_code=404, detail="Video not found")

    if not force:
        existing = load_inference_metadata(video_id)
        if existing is not None:
            return InferenceJob(
                job_id="completed",
                video_id=video_id,
                status="completed",
                prediction=PredictionMetadata(**existing),
                created_at=existing["created_at"],
                completed_at=existing["created_at"],
            )

    active = get_job_for_video(video_id)
    if active is not None:
        return active

    video_path = get_video_path(video_id)
    if video_path is None:
        raise HTTPException(status_code=404, detail="Video file not found")

    try:
        job = submit_inference(video_path, video_id)
    except MissingTokenError as exc:
        logger.error("Inference blocked by missing token: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except VideoFormatError as exc:
        logger.warning("Video format error for %s: %s", video_id, exc)
        raise HTTPException(status_code=422, detail=str(exc))
    except GPUOutOfMemoryError as exc:
        logger.error("GPU OOM for video %s: %s", video_id, exc)
        raise HTTPException(status_code=507, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error submitting inference for %s", video_id)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later.",
        )

    return job


@router.get("/{video_id}/status", response_model=InferenceJob)
async def get_inference_status(video_id: UUID):
    active = get_job_for_video(video_id)
    if active is not None:
        return active

    existing = load_inference_metadata(video_id)
    if existing is not None:
        return InferenceJob(
            job_id="completed",
            video_id=video_id,
            status="completed",
            prediction=PredictionMetadata(**existing),
            created_at=existing["created_at"],
            completed_at=existing["created_at"],
        )

    raise HTTPException(
        status_code=404, detail="No inference job found for this video"
    )


@router.get("/jobs/{job_id}", response_model=InferenceJob)
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{video_id}", response_model=InferenceResponse)
async def get_inference_result(video_id: UUID):
    metadata = load_inference_metadata(video_id)
    if metadata is None:
        raise HTTPException(
            status_code=404, detail="No inference results found for this video"
        )
    return InferenceResponse(
        success=True,
        prediction=PredictionMetadata(**metadata),
    )
