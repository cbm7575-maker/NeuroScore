import numpy as np
import pytest

from app.schemas.timeline import Classification, TimelineThresholds
from app.services.timeline import _classify_network, analyze_timeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _flat_activations(T: int, value: float = 1.0) -> np.ndarray:
    """All networks at a constant value — std is 0, so no spikes or drops."""
    return np.full((T, 5), value, dtype=np.float64)


def _activations_with_spike(T: int, spike_t: int, spike_col: int, spike_value: float) -> np.ndarray:
    mat = _flat_activations(T, value=1.0)
    mat[spike_t, spike_col] = spike_value
    return mat


# ---------------------------------------------------------------------------
# _classify_network — unit tests
# ---------------------------------------------------------------------------

class TestClassifyNetwork:
    def _thresholds(self, spike_sd=1.5, drop_sd=0.5, min_dur=2):
        return TimelineThresholds(
            spike_sd_above=spike_sd,
            drop_sd_below=drop_sd,
            drop_min_duration_seconds=min_dur,
        )

    def test_all_normal_when_constant(self):
        values = np.ones(10)
        result = _classify_network(values, mean=1.0, std=0.0, thresholds=self._thresholds())
        assert all(c == Classification.normal for c in result)

    def test_spike_detected_above_threshold(self):
        values = np.array([1.0, 1.0, 5.0, 1.0, 1.0], dtype=float)
        mean, std = float(values.mean()), float(values.std())
        result = _classify_network(values, mean=mean, std=std, thresholds=self._thresholds())
        assert result[2] == Classification.spike

    def test_single_second_drop_not_confirmed(self):
        """One second below threshold should NOT be classified as drop_off (min_dur=2)."""
        values = np.array([1.0, 1.0, -5.0, 1.0, 1.0], dtype=float)
        mean, std = float(values.mean()), float(values.std())
        result = _classify_network(values, mean=mean, std=std, thresholds=self._thresholds(min_dur=2))
        assert result[2] != Classification.drop_off

    def test_two_consecutive_seconds_confirm_drop(self):
        values = np.array([1.0, 1.0, -5.0, -5.0, 1.0], dtype=float)
        mean, std = float(values.mean()), float(values.std())
        result = _classify_network(values, mean=mean, std=std, thresholds=self._thresholds(min_dur=2))
        assert result[2] == Classification.drop_off
        assert result[3] == Classification.drop_off

    def test_drop_before_spike_priority(self):
        """A confirmed drop-off takes priority over spike when std is near-zero."""
        # If both conditions could fire (not typical in practice), drop wins because
        # confirmed_drop check runs first.
        values = np.array([-10.0, -10.0, -10.0], dtype=float)
        mean, std = 0.0, 1.0
        result = _classify_network(values, mean=mean, std=std, thresholds=self._thresholds())
        assert all(c == Classification.drop_off for c in result)

    def test_output_length_matches_input(self):
        values = np.linspace(0, 1, 20)
        result = _classify_network(values, mean=float(values.mean()), std=float(values.std()), thresholds=self._thresholds())
        assert len(result) == 20

    def test_min_duration_1_allows_single_second_drop(self):
        values = np.array([1.0, -10.0, 1.0], dtype=float)
        mean, std = float(values.mean()), float(values.std())
        result = _classify_network(values, mean=mean, std=std, thresholds=self._thresholds(min_dur=1))
        assert result[1] == Classification.drop_off


# ---------------------------------------------------------------------------
# analyze_timeline — shape and structure
# ---------------------------------------------------------------------------

class TestAnalyzeTimeline:
    def test_output_length_matches_timesteps(self):
        result = analyze_timeline(_flat_activations(30))
        assert len(result.timeline) == 30

    def test_duration_seconds_matches_timesteps(self):
        result = analyze_timeline(_flat_activations(15))
        assert result.duration_seconds == 15.0

    def test_timestamps_are_sequential(self):
        result = analyze_timeline(_flat_activations(5))
        timestamps = [e.timestamp for e in result.timeline]
        assert timestamps == [0.0, 1.0, 2.0, 3.0, 4.0]

    def test_constant_input_all_normal(self):
        result = analyze_timeline(_flat_activations(10))
        for entry in result.timeline:
            for cls in entry.classifications.model_dump().values():
                assert cls == Classification.normal
            assert entry.affected_networks == []

    def test_spike_appears_in_timeline(self):
        mat = _flat_activations(10)
        # Make visual at t=5 a clear spike
        mat[5, 0] = 100.0
        result = analyze_timeline(mat)
        entry = result.timeline[5]
        assert entry.classifications.visual == Classification.spike
        assert "visual" in entry.affected_networks

    def test_drop_off_sustained_2s(self):
        mat = _flat_activations(10)
        mat[3, 2] = -100.0  # language column
        mat[4, 2] = -100.0
        result = analyze_timeline(mat)
        assert result.timeline[3].classifications.language == Classification.drop_off
        assert result.timeline[4].classifications.language == Classification.drop_off
        assert "language" in result.timeline[3].affected_networks

    def test_drop_off_single_second_not_confirmed(self):
        mat = _flat_activations(10)
        mat[5, 3] = -100.0  # motion column, only 1 second
        result = analyze_timeline(mat)
        assert result.timeline[5].classifications.motion != Classification.drop_off

    def test_video_id_propagated(self):
        result = analyze_timeline(_flat_activations(5), video_id="abc-123")
        assert result.video_id == "abc-123"

    def test_thresholds_propagated(self):
        thresholds = TimelineThresholds(spike_sd_above=2.0, drop_sd_below=1.0, drop_min_duration_seconds=3)
        result = analyze_timeline(_flat_activations(5), thresholds=thresholds)
        assert result.thresholds.spike_sd_above == 2.0
        assert result.thresholds.drop_sd_below == 1.0
        assert result.thresholds.drop_min_duration_seconds == 3

    def test_activation_values_preserved(self):
        mat = np.arange(10, dtype=float).reshape(2, 5)
        result = analyze_timeline(mat)
        row0 = result.timeline[0].activations
        assert row0.visual == 0.0
        assert row0.auditory == 1.0
        assert row0.language == 2.0
        assert row0.motion == 3.0
        assert row0.default_mode == 4.0

    def test_wrong_shape_raises(self):
        with pytest.raises(ValueError, match="shape"):
            analyze_timeline(np.ones((10, 3)))

    def test_1d_input_raises(self):
        with pytest.raises(ValueError):
            analyze_timeline(np.ones(10))

    def test_default_thresholds_used_when_none(self):
        result = analyze_timeline(_flat_activations(5))
        assert result.thresholds.spike_sd_above == 1.5
        assert result.thresholds.drop_sd_below == 0.5
        assert result.thresholds.drop_min_duration_seconds == 2

    def test_multiple_networks_spike_simultaneously(self):
        mat = _flat_activations(10)
        mat[7, 0] = 200.0  # visual spike
        mat[7, 1] = 200.0  # auditory spike
        result = analyze_timeline(mat)
        entry = result.timeline[7]
        assert "visual" in entry.affected_networks
        assert "auditory" in entry.affected_networks

    def test_tunable_spike_threshold_changes_detection(self):
        mat = _flat_activations(10)
        mat[5, 0] = 3.0  # mild spike relative to baseline of 1.0

        tight = TimelineThresholds(spike_sd_above=0.5)
        loose = TimelineThresholds(spike_sd_above=5.0)

        result_tight = analyze_timeline(mat, thresholds=tight)
        result_loose = analyze_timeline(mat, thresholds=loose)

        assert result_tight.timeline[5].classifications.visual == Classification.spike
        assert result_loose.timeline[5].classifications.visual != Classification.spike
