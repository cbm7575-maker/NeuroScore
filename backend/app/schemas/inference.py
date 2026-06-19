from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PredictionMetadata(BaseModel):
    video_id: UUID
    model_id: str
    duration_seconds: float
    num_timepoints: int
    num_vertices: int
    hemodynamic_delay_seconds: int
    created_at: datetime


class InferenceJob(BaseModel):
    job_id: str
    video_id: UUID
    status: JobStatus
    error: str | None = None
    prediction: PredictionMetadata | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class InferenceResponse(BaseModel):
    success: bool
    prediction: PredictionMetadata
