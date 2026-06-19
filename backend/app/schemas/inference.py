from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PredictionMetadata(BaseModel):
    video_id: UUID
    model_id: str
    duration_seconds: float
    num_timepoints: int
    num_vertices: int
    hemodynamic_delay_seconds: int
    created_at: datetime


class InferenceResponse(BaseModel):
    success: bool
    prediction: PredictionMetadata
