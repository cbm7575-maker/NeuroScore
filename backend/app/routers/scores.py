from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.schemas.score import (
    CompositeScoreRequest,
    CompositeScoreResponse,
    NichePreset,
    NicheWeights,
    NetworkScores,
)
from app.services.score import (
    PRESET_WEIGHTS,
    compute_composite_score,
    load_baseline,
    save_baseline,
    get_network_scores,
    calculate_composite,
)
from app.services.video import load_metadata

router = APIRouter(prefix="/api/scores", tags=["scores"])


@router.get("/presets")
async def list_presets() -> dict[str, NicheWeights]:
    return {preset.value: weights for preset, weights in PRESET_WEIGHTS.items()}


@router.get("/baseline")
async def get_baseline() -> dict[str, float]:
    return load_baseline()


@router.post("/baseline", status_code=204)
async def set_baseline(body: NetworkScores) -> None:
    save_baseline(body.model_dump())


@router.get("/{video_id}", response_model=CompositeScoreResponse)
async def get_scores(video_id: UUID, preset: NichePreset = NichePreset.default):
    if load_metadata(video_id) is None:
        raise HTTPException(status_code=404, detail="Video not found")
    network_scores, multipliers = get_network_scores(video_id)
    weights = PRESET_WEIGHTS[preset]
    return CompositeScoreResponse(
        composite_score=calculate_composite(network_scores, weights),
        network_scores=network_scores,
        weights_used=weights,
        preset=preset,
        baseline_multipliers=multipliers,
    )


@router.post("/{video_id}/composite", response_model=CompositeScoreResponse)
async def composite_score(video_id: UUID, body: CompositeScoreRequest):
    if load_metadata(video_id) is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return compute_composite_score(video_id, body.preset, body.custom_weights)
