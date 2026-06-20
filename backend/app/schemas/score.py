from enum import Enum

from pydantic import BaseModel, model_validator


class NichePreset(str, Enum):
    default = "default"
    comedy = "comedy"
    education = "education"
    fitness = "fitness"
    custom = "custom"


class NetworkScores(BaseModel):
    auditory: float
    language: float
    visual: float
    default_mode: float
    motion: float


class NicheWeights(BaseModel):
    auditory: float
    language: float
    visual: float
    default_mode: float
    motion: float

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "NicheWeights":
        total = round(self.auditory + self.language + self.visual + self.default_mode + self.motion, 6)
        if abs(total - 1.0) > 1e-4:
            raise ValueError(f"Weights must sum to 1.0 (got {total:.4f})")
        return self


class CompositeScoreRequest(BaseModel):
    preset: NichePreset = NichePreset.default
    custom_weights: NicheWeights | None = None

    @model_validator(mode="after")
    def custom_requires_weights(self) -> "CompositeScoreRequest":
        if self.preset == NichePreset.custom and self.custom_weights is None:
            raise ValueError("custom_weights is required when preset is 'custom'")
        return self


class CompositeScoreResponse(BaseModel):
    composite_score: float
    network_scores: NetworkScores
    weights_used: NicheWeights
    preset: NichePreset
    # Per-network multiplier vs. baseline (e.g. 1.0 = at baseline). None when
    # scores were derived from mock data (no activations.npy available yet).
    baseline_multipliers: NetworkScores | None = None
