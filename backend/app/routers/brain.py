from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.services.brain import get_surface_json

router = APIRouter(prefix="/api/brain", tags=["brain"])


@router.get("/surface")
async def brain_surface():
    try:
        data = get_surface_json()
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return JSONResponse(content=data)
