import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.exceptions import LLMAuthenticationError, LLMError, LLMRateLimitError, LLMTimeoutError
from app.schemas.analysis import (
    HookGenerationRequest,
    HookGenerationResponse,
    HookOption,
)
from app.services.hook_generation import generate_hooks, load_hooks
from app.services.inference import load_inference_metadata

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hooks", tags=["hooks"])


@router.post("/{video_id}", response_model=HookGenerationResponse)
async def create_hooks(video_id: UUID, request: HookGenerationRequest | None = None):
    metadata = load_inference_metadata(video_id)
    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail="No inference results found. Run inference first.",
        )

    niche = request.niche if request else "general"
    current_hook = request.current_hook if request else None

    try:
        result = await generate_hooks(video_id, niche, current_hook)
    except LLMAuthenticationError as exc:
        logger.error("LLM auth failed for hooks %s: %s", video_id, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except LLMRateLimitError as exc:
        logger.warning("LLM rate limit for hooks %s: %s", video_id, exc)
        raise HTTPException(status_code=429, detail=str(exc))
    except LLMTimeoutError as exc:
        logger.warning("LLM timeout for hooks %s: %s", video_id, exc)
        raise HTTPException(status_code=504, detail=str(exc))
    except LLMError as exc:
        logger.error("LLM error for hooks %s: %s", video_id, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during hook generation for %s", video_id)
        raise HTTPException(
            status_code=500,
            detail="Hook generation failed. Please try again later.",
        )

    if result is None:
        raise HTTPException(status_code=404, detail="Prediction data not found")

    return HookGenerationResponse(
        success=True,
        video_id=str(video_id),
        hooks=result["hooks"],
        opening_scores=result["opening_scores"],
        neural_weaknesses=result["neural_weaknesses"],
        neural_strengths=result["neural_strengths"],
    )


@router.get("/{video_id}", response_model=HookGenerationResponse)
async def get_hooks(video_id: UUID):
    data = load_hooks(video_id)
    if data is None:
        raise HTTPException(
            status_code=404, detail="No hooks found for this video"
        )

    return HookGenerationResponse(
        success=True,
        video_id=data["video_id"],
        hooks=[HookOption(**h) for h in data["hooks"]],
        opening_scores=data["opening_scores"],
        neural_weaknesses=data["neural_weaknesses"],
        neural_strengths=data["neural_strengths"],
    )
