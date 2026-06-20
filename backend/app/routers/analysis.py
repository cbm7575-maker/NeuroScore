import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.exceptions import LLMAuthenticationError, LLMError, LLMRateLimitError, LLMTimeoutError
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisOutput,
    ComparisonOutput,
    ComparisonResponse,
    DropOffEvent,
    NetworkScore,
    SpikeEvent,
    TimelinePoint,
)
from app.services.analysis import generate_analysis, generate_comparison, load_analysis, load_comparison
from app.services.inference import load_inference_metadata
from app.services.video import load_metadata

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/{video_id}", response_model=AnalysisResponse)
async def run_analysis(video_id: UUID, request: AnalysisRequest | None = None):
    metadata = load_inference_metadata(video_id)
    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail="No inference results found. Run inference first.",
        )

    niche = request.niche if request else "general"

    try:
        result = await generate_analysis(video_id, niche)
    except LLMAuthenticationError as exc:
        logger.error("LLM auth failed for %s: %s", video_id, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except LLMRateLimitError as exc:
        logger.warning("LLM rate limit for %s: %s", video_id, exc)
        raise HTTPException(status_code=429, detail=str(exc))
    except LLMTimeoutError as exc:
        logger.warning("LLM timeout for %s: %s", video_id, exc)
        raise HTTPException(status_code=504, detail=str(exc))
    except LLMError as exc:
        logger.error("LLM error for %s: %s", video_id, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during analysis for %s", video_id)
        raise HTTPException(
            status_code=500,
            detail="Analysis generation failed. Please try again later.",
        )

    if result is None:
        raise HTTPException(status_code=404, detail="Prediction data not found")

    return AnalysisResponse(
        success=True,
        video_id=str(video_id),
        network_scores=result["network_scores"],
        analysis=result["analysis"],
        timeline=result["timeline"],
        spikes=result["spikes"],
        drop_offs=result["drop_offs"],
    )


@router.get("/{video_id}", response_model=AnalysisResponse)
async def get_analysis(video_id: UUID):
    data = load_analysis(video_id)
    if data is None:
        raise HTTPException(
            status_code=404, detail="No analysis found for this video"
        )

    return AnalysisResponse(
        success=True,
        video_id=data["video_id"],
        network_scores=[NetworkScore(**s) for s in data["network_scores"]],
        analysis=AnalysisOutput(**data["analysis"]),
        timeline=[TimelinePoint(**t) for t in data.get("timeline", [])],
        spikes=[SpikeEvent(**s) for s in data.get("spikes", [])],
        drop_offs=[DropOffEvent(**d) for d in data.get("drop_offs", [])],
    )


@router.post("/{video_id}/comparison", response_model=ComparisonResponse)
async def run_comparison(video_id: UUID):
    meta = load_metadata(video_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Video not found")
    if meta.original_video_id is None:
        raise HTTPException(
            status_code=400, detail="This video has no original version to compare against"
        )

    v2_analysis = load_analysis(video_id)
    v1_analysis = load_analysis(meta.original_video_id)
    if v2_analysis is None or v1_analysis is None:
        raise HTTPException(
            status_code=404,
            detail="Both v1 and v2 must have analysis results before comparison",
        )

    try:
        comparison = await generate_comparison(video_id, meta.original_video_id)
    except LLMAuthenticationError as exc:
        logger.error("LLM auth failed for comparison %s: %s", video_id, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except LLMRateLimitError as exc:
        logger.warning("LLM rate limit for comparison %s: %s", video_id, exc)
        raise HTTPException(status_code=429, detail=str(exc))
    except LLMTimeoutError as exc:
        logger.warning("LLM timeout for comparison %s: %s", video_id, exc)
        raise HTTPException(status_code=504, detail=str(exc))
    except LLMError as exc:
        logger.error("LLM error for comparison %s: %s", video_id, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during comparison for %s", video_id)
        raise HTTPException(
            status_code=500,
            detail="Comparison generation failed. Please try again later.",
        )

    if comparison is None:
        raise HTTPException(status_code=404, detail="Analysis data not found")

    return ComparisonResponse(
        success=True,
        video_id=str(video_id),
        original_video_id=str(meta.original_video_id),
        comparison=comparison,
    )


@router.get("/{video_id}/comparison", response_model=ComparisonResponse)
async def get_comparison(video_id: UUID):
    data = load_comparison(video_id)
    if data is None:
        raise HTTPException(
            status_code=404, detail="No comparison found for this video"
        )

    return ComparisonResponse(
        success=True,
        video_id=data["video_id"],
        original_video_id=data["original_video_id"],
        comparison=ComparisonOutput(**data["comparison"]),
    )
