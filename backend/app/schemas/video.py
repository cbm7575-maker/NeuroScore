from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VideoMetadata(BaseModel):
    id: UUID
    original_filename: str
    duration_seconds: float
    width: int
    height: int
    fps: float
    file_size_bytes: int
    format: str
    created_at: datetime


class UploadResponse(BaseModel):
    success: bool
    video: VideoMetadata
