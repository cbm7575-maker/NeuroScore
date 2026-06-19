from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.schemas.inference import InferenceResponse, PredictionMetadata
from app.services.inference import load_inference_metadata, run_inference
from app.services.video import get_video_path, load_metadata

router = APIRouter(prefix="/api/inference", tags=["inference"])


@router.post("/{video_id}", response_model=InferenceResponse)
async def run_video_inference(video_id: UUID, force: bool = Query(default=False)):
    video_meta = load_metadata(video_id)
    if video_meta is None:
        raise HTTPException(status_code=404, detail="Video not found")

    if not force:
        existing = load_inference_metadata(video_id)
        if existing is not None:
            return InferenceResponse(
                success=True,
                prediction=PredictionMetadata(**existing),
            )

    video_path = get_video_path(video_id)
    if video_path is None:
        raise HTTPException(status_code=404, detail="Video file not found")

    try:
        metadata = run_inference(video_path, video_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return InferenceResponse(
        success=True,
        prediction=PredictionMetadata(**metadata),
    )


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
