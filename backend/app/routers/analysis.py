import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.exceptions import LLMAuthenticationError, LLMError, LLMRateLimitError, LLMTimeoutError
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, AnalysisOutput, NetworkScore
from app.services.analysis import generate_analysis, load_analysis
from app.services.inference import load_inference_metadata

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
    )
