import json
from uuid import uuid4

import numpy as np
import pytest

from app.schemas.analysis import (
    AnalysisOutput,
    DropOffDetail,
    NetworkInterpretation,
    NetworkScore,
    StrengthHighlight,
    Suggestion,
    TimelinePoint,
)
from app.services.analysis import (
    NETWORK_RANGES,
    _score_label,
    build_analysis_prompt,
    compute_network_scores,
    compute_timeline,
    detect_drop_offs,
    detect_spikes,
    load_analysis,
    parse_analysis_response,
)
from app.services.inference import NUM_VERTICES


class TestScoreLabel:
    def test_very_strong(self):
        assert _score_label(90) == "Very Strong"

    def test_strong(self):
        assert _score_label(65) == "Strong"

    def test_moderate(self):
        assert _score_label(45) == "Moderate"

    def test_weak(self):
        assert _score_label(25) == "Weak"

    def test_very_weak(self):
        assert _score_label(10) == "Very Weak"

    def test_boundary_80(self):
        assert _score_label(80) == "Very Strong"

    def test_zero(self):
        assert _score_label(0) == "Very Weak"


class TestComputeNetworkScores:
    def test_returns_five_networks(self):
        preds = np.random.rand(10, NUM_VERTICES).astype(np.float32)
        scores = compute_network_scores(preds)
        assert len(scores) == 5

    def test_network_names(self):
        preds = np.random.rand(10, NUM_VERTICES).astype(np.float32)
        scores = compute_network_scores(preds)
        names = {s.name for s in scores}
        assert names == {"Visual", "Auditory", "Attention", "Salience", "Default Mode"}

    def test_scores_between_0_and_100(self):
        preds = np.random.rand(10, NUM_VERTICES).astype(np.float32)
        scores = compute_network_scores(preds)
        for s in scores:
            assert 0 <= s.score <= 100

    def test_labels_assigned(self):
        preds = np.random.rand(10, NUM_VERTICES).astype(np.float32)
        scores = compute_network_scores(preds)
        valid_labels = {"Very Strong", "Strong", "Moderate", "Weak", "Very Weak"}
        for s in scores:
            assert s.label in valid_labels

    def test_zero_predictions_give_zero_scores(self):
        preds = np.zeros((10, NUM_VERTICES))
        scores = compute_network_scores(preds)
        for s in scores:
            assert s.score == 0.0

    def test_high_predictions_clamp_at_100(self):
        preds = np.full((10, NUM_VERTICES), 5.0)
        scores = compute_network_scores(preds)
        for s in scores:
            assert s.score == 100.0


class TestComputeTimeline:
    def test_length_matches_timepoints(self):
        preds = np.random.rand(15, NUM_VERTICES).astype(np.float32)
        timeline = compute_timeline(preds)
        assert len(timeline) == 15

    def test_timestamps_sequential(self):
        preds = np.random.rand(5, NUM_VERTICES).astype(np.float32)
        timeline = compute_timeline(preds)
        for i, point in enumerate(timeline):
            assert point.timestamp == float(i)

    def test_scores_contain_all_networks(self):
        preds = np.random.rand(3, NUM_VERTICES).astype(np.float32)
        timeline = compute_timeline(preds)
        for point in timeline:
            assert set(point.scores.keys()) == set(NETWORK_RANGES.keys())


class TestDetectSpikes:
    def test_detects_spike(self):
        points = [
            TimelinePoint(timestamp=float(i), scores={"Visual": s, "Auditory": 50})
            for i, s in enumerate([50, 60, 90, 60, 50])
        ]
        spikes = detect_spikes(points, threshold=75.0)
        assert len(spikes) == 1
        assert spikes[0].timestamp == 2.0
        assert spikes[0].network == "Visual"

    def test_no_spikes_below_threshold(self):
        points = [
            TimelinePoint(timestamp=float(i), scores={"Visual": 50})
            for i in range(5)
        ]
        spikes = detect_spikes(points, threshold=75.0)
        assert len(spikes) == 0

    def test_flat_high_values_no_spike(self):
        points = [
            TimelinePoint(timestamp=float(i), scores={"Visual": 80})
            for i in range(5)
        ]
        spikes = detect_spikes(points, threshold=75.0)
        assert len(spikes) == 0


class TestDetectDropOffs:
    def test_detects_drop_off(self):
        scores = [50, 50, 10, 10, 10, 50, 50]
        points = [
            TimelinePoint(timestamp=float(i), scores={"Visual": s})
            for i, s in enumerate(scores)
        ]
        drops = detect_drop_offs(points, threshold=25.0, min_duration=2.0)
        assert len(drops) == 1
        assert drops[0].timestamp == 2.0
        assert drops[0].duration == 3.0
        assert drops[0].network == "Visual"

    def test_short_drop_off_ignored(self):
        scores = [50, 10, 50, 50]
        points = [
            TimelinePoint(timestamp=float(i), scores={"Visual": s})
            for i, s in enumerate(scores)
        ]
        drops = detect_drop_offs(points, threshold=25.0, min_duration=2.0)
        assert len(drops) == 0

    def test_drop_off_at_end(self):
        scores = [50, 50, 10, 10, 10]
        points = [
            TimelinePoint(timestamp=float(i), scores={"Visual": s})
            for i, s in enumerate(scores)
        ]
        drops = detect_drop_offs(points, threshold=25.0, min_duration=2.0)
        assert len(drops) == 1
        assert drops[0].duration == 3.0


class TestBuildAnalysisPrompt:
    def test_contains_network_scores(self):
        scores = [NetworkScore(name="Visual", score=75.0, label="Strong")]
        timeline = [TimelinePoint(timestamp=0.0, scores={"Visual": 75.0})]
        prompt = build_analysis_prompt(scores, timeline, [], [], "fitness")
        assert "Visual: 75.0/100 (Strong)" in prompt

    def test_contains_niche(self):
        scores = [NetworkScore(name="Visual", score=50.0, label="Moderate")]
        timeline = [TimelinePoint(timestamp=0.0, scores={"Visual": 50.0})]
        prompt = build_analysis_prompt(scores, timeline, [], [], "cooking")
        assert "cooking" in prompt

    def test_contains_json_instruction(self):
        scores = [NetworkScore(name="Visual", score=50.0, label="Moderate")]
        timeline = [TimelinePoint(timestamp=0.0, scores={"Visual": 50.0})]
        prompt = build_analysis_prompt(scores, timeline, [], [], "general")
        assert "JSON" in prompt

    def test_contains_five_output_keys(self):
        scores = [NetworkScore(name="Visual", score=50.0, label="Moderate")]
        timeline = [TimelinePoint(timestamp=0.0, scores={"Visual": 50.0})]
        prompt = build_analysis_prompt(scores, timeline, [], [], "general")
        assert "overall_assessment" in prompt
        assert "network_interpretations" in prompt
        assert "drop_off_analysis" in prompt
        assert "suggestions" in prompt
        assert "strength_highlights" in prompt


class TestParseAnalysisResponse:
    VALID_RESPONSE = json.dumps({
        "overall_assessment": "The video shows strong visual engagement.",
        "network_interpretations": [
            {
                "network": "Visual",
                "score": 82.5,
                "label": "Very Strong",
                "interpretation": "Excellent visual processing throughout.",
            }
        ],
        "drop_off_analysis": [
            {
                "timestamp": 15.0,
                "duration": 4.0,
                "network": "Attention",
                "description": "Attention drops during transition.",
            }
        ],
        "suggestions": [
            {
                "timestamp": 15.0,
                "network": "Attention",
                "suggestion": "Add a visual hook at the 15-second mark.",
            }
        ],
        "strength_highlights": [
            {
                "timestamp": 3.0,
                "network": "Salience",
                "description": "Strong emotional hook in the opening.",
            }
        ],
    })

    def test_parses_valid_json(self):
        result = parse_analysis_response(self.VALID_RESPONSE)
        assert isinstance(result, AnalysisOutput)
        assert "strong visual engagement" in result.overall_assessment

    def test_parses_network_interpretations(self):
        result = parse_analysis_response(self.VALID_RESPONSE)
        assert len(result.network_interpretations) == 1
        assert result.network_interpretations[0].network == "Visual"
        assert result.network_interpretations[0].score == 82.5

    def test_parses_drop_off_analysis(self):
        result = parse_analysis_response(self.VALID_RESPONSE)
        assert len(result.drop_off_analysis) == 1
        assert result.drop_off_analysis[0].timestamp == 15.0

    def test_parses_suggestions(self):
        result = parse_analysis_response(self.VALID_RESPONSE)
        assert len(result.suggestions) == 1
        assert result.suggestions[0].timestamp == 15.0

    def test_parses_strength_highlights(self):
        result = parse_analysis_response(self.VALID_RESPONSE)
        assert len(result.strength_highlights) == 1
        assert result.strength_highlights[0].timestamp == 3.0

    def test_strips_markdown_code_fences(self):
        wrapped = f"```json\n{self.VALID_RESPONSE}\n```"
        result = parse_analysis_response(wrapped)
        assert isinstance(result, AnalysisOutput)

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            parse_analysis_response("not json at all")

    def test_handles_empty_arrays(self):
        response = json.dumps({
            "overall_assessment": "Good video.",
            "network_interpretations": [],
            "drop_off_analysis": [],
            "suggestions": [],
            "strength_highlights": [],
        })
        result = parse_analysis_response(response)
        assert result.overall_assessment == "Good video."
        assert len(result.network_interpretations) == 0

    def test_handles_null_timestamps(self):
        response = json.dumps({
            "overall_assessment": "Good video.",
            "network_interpretations": [],
            "drop_off_analysis": [],
            "suggestions": [
                {"timestamp": None, "network": None, "suggestion": "General tip."}
            ],
            "strength_highlights": [
                {"timestamp": None, "network": None, "description": "Overall good."}
            ],
        })
        result = parse_analysis_response(response)
        assert result.suggestions[0].timestamp is None
        assert result.strength_highlights[0].network is None


class TestLoadAnalysis:
    def test_missing_returns_none(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.analysis.settings.upload_dir", tmp_path)
        assert load_analysis(uuid4()) is None

    def test_roundtrip(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.services.analysis.settings.upload_dir", tmp_path)
        video_id = uuid4()
        video_dir = tmp_path / str(video_id)
        video_dir.mkdir()
        data = {
            "video_id": str(video_id),
            "niche": "fitness",
            "network_scores": [{"name": "Visual", "score": 75.0, "label": "Strong"}],
            "analysis": {
                "overall_assessment": "Good video.",
                "network_interpretations": [],
                "drop_off_analysis": [],
                "suggestions": [],
                "strength_highlights": [],
            },
        }
        (video_dir / "analysis.json").write_text(json.dumps(data))
        loaded = load_analysis(video_id)
        assert loaded["niche"] == "fitness"
        assert loaded["network_scores"][0]["score"] == 75.0
