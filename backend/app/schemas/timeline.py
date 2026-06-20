from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field

# Column order matches network.py NETWORK_NAMES: 0=visual, 1=auditory, 2=language, 3=motion, 4=default_mode
NETWORK_COLUMN_ORDER = ("visual", "auditory", "language", "motion", "default_mode")


class Classification(str, Enum):
    normal = "normal"
    spike = "spike"
    drop_off = "drop_off"


class NetworkActivations(BaseModel):
    visual: float
    auditory: float
    language: float
    motion: float
    default_mode: float


class NetworkClassifications(BaseModel):
    visual: Classification
    auditory: Classification
    language: Classification
    motion: Classification
    default_mode: Classification


class TimelineEntry(BaseModel):
    timestamp: float
    activations: NetworkActivations
    classifications: NetworkClassifications
    affected_networks: list[str]


class TimelineThresholds(BaseModel):
    spike_sd_above: Annotated[float, Field(gt=0)] = 1.5
    drop_sd_below: Annotated[float, Field(gt=0)] = 0.5
    drop_min_duration_seconds: Annotated[int, Field(ge=1)] = 2


class TimelineResult(BaseModel):
    video_id: str
    duration_seconds: float
    thresholds: TimelineThresholds
    timeline: list[TimelineEntry]
