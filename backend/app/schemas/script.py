from pydantic import BaseModel, Field

from app.schemas.score import NichePreset
from app.schemas.timeline import TimelineEntry


class ScriptGenerationRequest(BaseModel):
    video_id: str
    hook: str
    transcript: str
    niche: NichePreset = NichePreset.default
    timeline: list[TimelineEntry] = Field(
        ..., min_length=1, description="Per-second neural timeline with classifications"
    )


class ScriptAnnotation(BaseModel):
    original_text: str
    improved_text: str
    target_networks: list[str]
    reason: str


class ScriptGenerationResponse(BaseModel):
    improved_script: str
    annotations: list[ScriptAnnotation]
