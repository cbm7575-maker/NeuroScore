from fastapi import APIRouter, HTTPException

from app.schemas.script import ScriptGenerationRequest, ScriptGenerationResponse
from app.services.script import generate_script

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/generate", response_model=ScriptGenerationResponse)
async def post_generate_script(request: ScriptGenerationRequest):
    try:
        return await generate_script(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Script generation failed: {e}")
