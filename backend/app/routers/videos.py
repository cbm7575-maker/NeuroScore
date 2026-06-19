from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.schemas.video import UploadResponse
from app.services.video import (
    extract_metadata,
    get_video_path,
    load_metadata,
    save_upload,
    validate_extension,
)

router = APIRouter(prefix="/api/videos", tags=["videos"])

MIME_MAP = {
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
    "avi": "video/x-msvideo",
}


@router.post("/upload", response_model=UploadResponse)
async def upload_video(file: UploadFile):
    if not file.filename or validate_extension(file.filename) is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed formats: mp4, mov, webm, avi",
        )

    try:
        video_path, video_id, ext = await save_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        metadata = extract_metadata(video_path, video_id, file.filename, ext)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return UploadResponse(success=True, video=metadata)


@router.get("/{video_id}")
async def get_metadata(video_id: UUID):
    metadata = load_metadata(video_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return metadata


@router.get("/{video_id}/file")
async def get_video_file(video_id: UUID):
    path = get_video_path(video_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Video file not found")
    ext = path.suffix.lstrip(".")
    return FileResponse(path, media_type=MIME_MAP.get(ext, "application/octet-stream"))
