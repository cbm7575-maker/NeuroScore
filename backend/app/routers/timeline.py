from uuid import UUID

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from typing import Annotated

from app.config import settings
from app.schemas.timeline import TimelineResult, TimelineThresholds
from app.services.timeline import analyze_timeline
from app.services.video import load_metadata

router = APIRouter(prefix="/api/videos", tags=["timeline"])


@router.get("/{video_id}/timeline", response_model=TimelineResult)
async def get_timeline(
    video_id: UUID,
    spike_sd_above: Annotated[float, Query(gt=0, description="SD above mean to flag a spike")] = 1.5,
    drop_sd_below: Annotated[float, Query(gt=0, description="SD below mean to flag a drop-off candidate")] = 0.5,
    drop_min_duration_seconds: Annotated[int, Query(ge=1, description="Minimum consecutive seconds to confirm a drop-off")] = 2,
):
    metadata = load_metadata(video_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Video not found")

    activations_path = settings.upload_dir / str(video_id) / "activations.npy"
    if not activations_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Network activations not yet computed for this video. Run the TRIBE inference pipeline first.",
        )

    activations = np.load(str(activations_path))
    thresholds = TimelineThresholds(
        spike_sd_above=spike_sd_above,
        drop_sd_below=drop_sd_below,
        drop_min_duration_seconds=drop_min_duration_seconds,
    )

    try:
        result = analyze_timeline(activations, thresholds, video_id=str(video_id))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result
