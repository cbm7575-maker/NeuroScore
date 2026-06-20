import json
from pathlib import Path
from uuid import uuid4

import numpy as np
import pytest

from app.schemas.score import NetworkScores, NichePreset, NicheWeights
from app.services.score import (
    _NETWORK_COLUMNS,
    _compute_scores_from_activations,
    _mock_network_scores,
    _multiplier_to_score,
    calculate_composite,
    get_network_scores,
    load_baseline,
    save_baseline,
)


# ---------------------------------------------------------------------------
# _multiplier_to_score
# ---------------------------------------------------------------------------

def test_baseline_multiplier_yields_fifty():
    assert _multiplier_to_score(1.0) == 50.0


def test_double_baseline_yields_hundred():
    assert _multiplier_to_score(2.0) == 100.0


def test_zero_activation_yields_zero():
    assert _multiplier_to_score(0.0) == 0.0


def test_above_double_is_clamped():
    assert _multiplier_to_score(5.0) == 100.0


def test_below_zero_is_clamped():
    assert _multiplier_to_score(-1.0) == 0.0


def test_half_baseline_yields_twenty_five():
    assert _multiplier_to_score(0.5) == 25.0


# ---------------------------------------------------------------------------
# _compute_scores_from_activations — column mapping
# ---------------------------------------------------------------------------

def _activation_matrix(value: float, T: int = 10) -> np.ndarray:
    """All networks set to the same value for T timesteps."""
    return np.full((T, 5), value, dtype=np.float64)


def test_scores_at_baseline_all_fifty(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    save_baseline({name: 1.0 for name in _NETWORK_COLUMNS})
    activations = _activation_matrix(1.0)
    scores, multipliers = _compute_scores_from_activations(activations)
    for name in _NETWORK_COLUMNS:
        assert getattr(scores, name) == 50.0, f"{name} score should be 50"
        assert abs(getattr(multipliers, name) - 1.0) < 1e-6, f"{name} multiplier should be 1.0"


def test_scores_at_double_baseline_all_hundred(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    save_baseline({name: 1.0 for name in _NETWORK_COLUMNS})
    activations = _activation_matrix(2.0)
    scores, multipliers = _compute_scores_from_activations(activations)
    for name in _NETWORK_COLUMNS:
        assert getattr(scores, name) == 100.0


def test_scores_clamped_above_hundred(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    save_baseline({name: 1.0 for name in _NETWORK_COLUMNS})
    activations = _activation_matrix(10.0)
    scores, _ = _compute_scores_from_activations(activations)
    for name in _NETWORK_COLUMNS:
        assert getattr(scores, name) == 100.0


def test_scores_per_network_column_independently(tmp_path, monkeypatch):
    """Each column in the activations matrix maps to the correct network name."""
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    save_baseline({name: 1.0 for name in _NETWORK_COLUMNS})

    activations = np.zeros((5, 5), dtype=np.float64)
    # Set column i to (i+1) * 0.5 so each network gets a distinct multiplier
    for col in range(5):
        activations[:, col] = (col + 1) * 0.5

    scores, multipliers = _compute_scores_from_activations(activations)
    for col, name in enumerate(_NETWORK_COLUMNS):
        expected_multiplier = (col + 1) * 0.5
        expected_score = min(100.0, 50.0 * expected_multiplier)
        assert abs(getattr(multipliers, name) - expected_multiplier) < 1e-5, name
        assert abs(getattr(scores, name) - expected_score) < 1e-3, name


def test_mean_is_taken_across_timesteps(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    save_baseline({name: 1.0 for name in _NETWORK_COLUMNS})

    activations = np.zeros((2, 5), dtype=np.float64)
    activations[0, :] = 0.0
    activations[1, :] = 2.0  # mean = 1.0 → multiplier 1.0 → score 50
    scores, _ = _compute_scores_from_activations(activations)
    for name in _NETWORK_COLUMNS:
        assert abs(getattr(scores, name) - 50.0) < 1e-3, name


# ---------------------------------------------------------------------------
# save_baseline / load_baseline
# ---------------------------------------------------------------------------

def test_save_and_load_baseline(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    means = {name: float(i + 1) for i, name in enumerate(_NETWORK_COLUMNS)}
    save_baseline(means)
    loaded = load_baseline()
    assert loaded == means


def test_load_baseline_defaults_when_missing(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "nonexistent.json")
    loaded = load_baseline()
    assert all(v == 1.0 for v in loaded.values())
    assert set(loaded.keys()) == set(_NETWORK_COLUMNS)


# ---------------------------------------------------------------------------
# get_network_scores — loading priority
# ---------------------------------------------------------------------------

def test_get_scores_from_activations_npy(tmp_path, monkeypatch):
    """activations.npy takes priority; scores are persisted to scores.json."""
    monkeypatch.setattr("app.services.score._BASELINE_PATH", tmp_path / "baseline.json")
    monkeypatch.setattr("app.services.score.settings", type("S", (), {"upload_dir": tmp_path})())

    video_id = uuid4()
    video_dir = tmp_path / str(video_id)
    video_dir.mkdir()

    activations = _activation_matrix(1.0)
    np.save(str(video_dir / "activations.npy"), activations)
    save_baseline({name: 1.0 for name in _NETWORK_COLUMNS})

    scores, multipliers = get_network_scores(video_id)
    assert multipliers is not None
    for name in _NETWORK_COLUMNS:
        assert abs(getattr(scores, name) - 50.0) < 1e-3
    assert (video_dir / "scores.json").exists()


def test_get_scores_from_scores_json(tmp_path, monkeypatch):
    """scores.json is used when activations.npy is absent."""
    monkeypatch.setattr("app.services.score.settings", type("S", (), {"upload_dir": tmp_path})())

    video_id = uuid4()
    video_dir = tmp_path / str(video_id)
    video_dir.mkdir()

    stored = {
        "network_scores": {n: 60.0 for n in _NETWORK_COLUMNS},
        "baseline_multipliers": {n: 1.2 for n in _NETWORK_COLUMNS},
    }
    (video_dir / "scores.json").write_text(json.dumps(stored))

    scores, multipliers = get_network_scores(video_id)
    assert multipliers is not None
    assert getattr(scores, "visual") == 60.0


def test_get_scores_mock_fallback(tmp_path, monkeypatch):
    """When no files exist, deterministic mock scores are returned without multipliers."""
    monkeypatch.setattr("app.services.score.settings", type("S", (), {"upload_dir": tmp_path})())

    video_id = uuid4()
    (tmp_path / str(video_id)).mkdir()

    scores, multipliers = get_network_scores(video_id)
    assert multipliers is None
    for name in _NETWORK_COLUMNS:
        assert 0.0 <= getattr(scores, name) <= 100.0


def test_mock_scores_are_deterministic():
    video_id = uuid4()
    s1 = _mock_network_scores(video_id)
    s2 = _mock_network_scores(video_id)
    assert s1 == s2


# ---------------------------------------------------------------------------
# calculate_composite
# ---------------------------------------------------------------------------

def test_composite_default_weights_is_mean():
    scores = NetworkScores(auditory=60.0, language=70.0, visual=80.0, default_mode=50.0, motion=40.0)
    weights = NicheWeights(auditory=0.2, language=0.2, visual=0.2, default_mode=0.2, motion=0.2)
    assert calculate_composite(scores, weights) == round((60 + 70 + 80 + 50 + 40) / 5, 2)


def test_composite_single_network_weight():
    scores = NetworkScores(auditory=100.0, language=0.0, visual=0.0, default_mode=0.0, motion=0.0)
    weights = NicheWeights(auditory=1.0, language=0.0, visual=0.0, default_mode=0.0, motion=0.0)
    assert calculate_composite(scores, weights) == 100.0


def test_composite_preset_weights_sum_to_valid():
    from app.services.score import PRESET_WEIGHTS
    for preset, weights in PRESET_WEIGHTS.items():
        total = weights.auditory + weights.language + weights.visual + weights.default_mode + weights.motion
        assert abs(total - 1.0) < 1e-6, f"{preset} weights don't sum to 1"
