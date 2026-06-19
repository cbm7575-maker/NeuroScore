import hashlib
import json
from pathlib import Path
from uuid import UUID

import numpy as np

from app.config import settings
from app.schemas.score import (
    CompositeScoreResponse,
    NetworkScores,
    NichePreset,
    NicheWeights,
)

PRESET_WEIGHTS: dict[NichePreset, NicheWeights] = {
    NichePreset.default: NicheWeights(auditory=0.20, language=0.20, visual=0.20, default_mode=0.20, motion=0.20),
    NichePreset.comedy: NicheWeights(auditory=0.25, language=0.25, visual=0.20, default_mode=0.20, motion=0.10),
    NichePreset.education: NicheWeights(auditory=0.15, language=0.30, visual=0.20, default_mode=0.25, motion=0.10),
    NichePreset.fitness: NicheWeights(auditory=0.25, language=0.10, visual=0.25, default_mode=0.10, motion=0.30),
}

# Column order of the (T, 5) activations.npy matrix, matching services/network.py
_NETWORK_COLUMNS = ["visual", "auditory", "language", "motion", "default_mode"]

# Baseline file sits beside the uploads directory so it survives across uploads.
_BASELINE_PATH: Path = settings.upload_dir.parent / "baseline.json"

# Default unit baseline — replaced by save_baseline() once real TRIBE output
# is available and a calibrated baseline has been computed.
_DEFAULT_BASELINE: dict[str, float] = {
    "visual": 1.0,
    "auditory": 1.0,
    "language": 1.0,
    "motion": 1.0,
    "default_mode": 1.0,
}


def load_baseline() -> dict[str, float]:
    if _BASELINE_PATH.exists():
        return json.loads(_BASELINE_PATH.read_text())
    return dict(_DEFAULT_BASELINE)


def save_baseline(means: dict[str, float]) -> None:
    _BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _BASELINE_PATH.write_text(json.dumps(means, indent=2))


def _multiplier_to_score(multiplier: float) -> float:
    """Map a baseline multiplier to the 0–100 scale. 1.0× → 50, 2.0× → 100, 0.0× → 0."""
    return max(0.0, min(100.0, 50.0 * multiplier))


def _compute_scores_from_activations(activations: np.ndarray) -> tuple[NetworkScores, NetworkScores]:
    """Return (network_scores, baseline_multipliers) from a (T, 5) matrix."""
    means = activations.mean(axis=0)  # shape (5,)
    baseline = load_baseline()

    multipliers: dict[str, float] = {}
    scores: dict[str, float] = {}
    for col_idx, name in enumerate(_NETWORK_COLUMNS):
        b = baseline.get(name, 1.0)
        m = float(means[col_idx]) / b if b != 0 else 0.0
        multipliers[name] = round(m, 6)
        scores[name] = round(_multiplier_to_score(m), 2)

    return NetworkScores(**scores), NetworkScores(**multipliers)


def _mock_network_scores(video_id: UUID) -> NetworkScores:
    """Deterministic mock scores from the video ID until real ML is wired up."""
    digest = hashlib.sha256(str(video_id).encode()).digest()

    def byte_to_score(b: int) -> float:
        return round(40.0 + (b / 255.0) * 55.0, 1)

    return NetworkScores(
        auditory=byte_to_score(digest[0]),
        language=byte_to_score(digest[1]),
        visual=byte_to_score(digest[2]),
        default_mode=byte_to_score(digest[3]),
        motion=byte_to_score(digest[4]),
    )


def get_network_scores(video_id: UUID) -> tuple[NetworkScores, NetworkScores | None]:
    """Return (scores, baseline_multipliers).

    Priority:
    1. activations.npy  → real baseline-comparison scoring, persisted to scores.json
    2. scores.json      → previously computed real scores
    3. network_scores.json → legacy or mock scores (no multipliers)
    4. mock             → deterministic hash-based fallback
    """
    video_dir = settings.upload_dir / str(video_id)
    activations_path = video_dir / "activations.npy"
    scores_path = video_dir / "scores.json"
    legacy_path = video_dir / "network_scores.json"

    if activations_path.exists():
        activations = np.load(str(activations_path))
        scores, multipliers = _compute_scores_from_activations(activations)
        _persist_scores(scores_path, scores, multipliers)
        return scores, multipliers

    if scores_path.exists():
        data = json.loads(scores_path.read_text())
        scores = NetworkScores(**data["network_scores"])
        multipliers = NetworkScores(**data["baseline_multipliers"]) if data.get("baseline_multipliers") else None
        return scores, multipliers

    if legacy_path.exists():
        return NetworkScores(**json.loads(legacy_path.read_text())), None

    scores = _mock_network_scores(video_id)
    legacy_path.parent.mkdir(parents=True, exist_ok=True)
    legacy_path.write_text(json.dumps(scores.model_dump(), indent=2))
    return scores, None


def _persist_scores(path: Path, scores: NetworkScores, multipliers: NetworkScores) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(
        {"network_scores": scores.model_dump(), "baseline_multipliers": multipliers.model_dump()},
        indent=2,
    ))


def calculate_composite(network_scores: NetworkScores, weights: NicheWeights) -> float:
    total = (
        network_scores.auditory * weights.auditory
        + network_scores.language * weights.language
        + network_scores.visual * weights.visual
        + network_scores.default_mode * weights.default_mode
        + network_scores.motion * weights.motion
    )
    return round(total, 2)


def compute_composite_score(
    video_id: UUID,
    preset: NichePreset,
    custom_weights: NicheWeights | None,
) -> CompositeScoreResponse:
    network_scores, multipliers = get_network_scores(video_id)
    weights = custom_weights if preset == NichePreset.custom else PRESET_WEIGHTS[preset]
    composite = calculate_composite(network_scores, weights)
    return CompositeScoreResponse(
        composite_score=composite,
        network_scores=network_scores,
        weights_used=weights,
        preset=preset,
        baseline_multipliers=multipliers,
    )
