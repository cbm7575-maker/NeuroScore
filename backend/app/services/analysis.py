import json
import logging
from uuid import UUID

import numpy as np

from app.config import settings
from app.schemas.analysis import (
    AnalysisOutput,
    ComparisonFixedIssue,
    ComparisonNetworkDelta,
    ComparisonOutput,
    ComparisonPersistentIssue,
    DropOffDetail,
    DropOffEvent,
    NetworkInterpretation,
    NetworkScore,
    SpikeEvent,
    StrengthHighlight,
    Suggestion,
    TimelinePoint,
)
from app.services import llm_client
from app.services.inference import NUM_VERTICES, load_prediction

logger = logging.getLogger(__name__)

NETWORK_RANGES: dict[str, tuple[int, int]] = {
    "Visual": (0, 4096),
    "Auditory": (4097, 8192),
    "Attention": (8193, 12288),
    "Salience": (12289, 16384),
    "Default Mode": (16385, NUM_VERTICES - 1),
}

SCORE_LABELS = [
    (80, "Very Strong"),
    (60, "Strong"),
    (40, "Moderate"),
    (20, "Weak"),
    (0, "Very Weak"),
]


def _score_label(score: float) -> str:
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "Very Weak"


def compute_network_scores(predictions: np.ndarray) -> list[NetworkScore]:
    scores = []
    for name, (start, end) in NETWORK_RANGES.items():
        region = predictions[:, start : end + 1]
        raw = float(np.mean(region))
        normalized = float(np.clip(raw * 100, 0, 100))
        scores.append(
            NetworkScore(name=name, score=round(normalized, 1), label=_score_label(normalized))
        )
    return scores


def compute_timeline(predictions: np.ndarray) -> list[TimelinePoint]:
    points = []
    for t in range(predictions.shape[0]):
        scores = {}
        for name, (start, end) in NETWORK_RANGES.items():
            raw = float(np.mean(predictions[t, start : end + 1]))
            scores[name] = round(float(np.clip(raw * 100, 0, 100)), 1)
        points.append(TimelinePoint(timestamp=float(t), scores=scores))
    return points


def detect_spikes(timeline: list[TimelinePoint], threshold: float = 75.0) -> list[SpikeEvent]:
    spikes = []
    if not timeline:
        return spikes
    networks = list(timeline[0].scores.keys())
    for net in networks:
        scores = [p.scores[net] for p in timeline]
        for i in range(1, len(scores) - 1):
            if scores[i] > threshold and scores[i] > scores[i - 1] and scores[i] > scores[i + 1]:
                spikes.append(
                    SpikeEvent(timestamp=timeline[i].timestamp, network=net, score=scores[i])
                )
    return sorted(spikes, key=lambda s: s.timestamp)


def detect_drop_offs(
    timeline: list[TimelinePoint], threshold: float = 25.0, min_duration: float = 2.0
) -> list[DropOffEvent]:
    drop_offs = []
    if not timeline:
        return drop_offs
    networks = list(timeline[0].scores.keys())
    for net in networks:
        scores = [p.scores[net] for p in timeline]
        in_drop = False
        start_idx = 0
        for i, score in enumerate(scores):
            if score < threshold:
                if not in_drop:
                    in_drop = True
                    start_idx = i
            else:
                if in_drop:
                    duration = float(i - start_idx)
                    if duration >= min_duration:
                        min_score = min(scores[start_idx:i])
                        drop_offs.append(
                            DropOffEvent(
                                timestamp=timeline[start_idx].timestamp,
                                network=net,
                                score=min_score,
                                duration=duration,
                            )
                        )
                    in_drop = False
        if in_drop:
            duration = float(len(scores) - start_idx)
            if duration >= min_duration:
                min_score = min(scores[start_idx:])
                drop_offs.append(
                    DropOffEvent(
                        timestamp=timeline[start_idx].timestamp,
                        network=net,
                        score=min_score,
                        duration=duration,
                    )
                )
    return sorted(drop_offs, key=lambda d: d.timestamp)


def build_analysis_prompt(
    network_scores: list[NetworkScore],
    timeline: list[TimelinePoint],
    spikes: list[SpikeEvent],
    drop_offs: list[DropOffEvent],
    niche: str,
) -> str:
    scores_text = "\n".join(
        f"  - {s.name}: {s.score}/100 ({s.label})" for s in network_scores
    )

    sampled = timeline
    if len(timeline) > 30:
        step = max(1, len(timeline) // 30)
        sampled = timeline[::step]
    timeline_text = "\n".join(
        f"  t={int(p.timestamp)}s: " + ", ".join(f"{k}={v}" for k, v in p.scores.items())
        for p in sampled
    )

    spikes_text = "None detected"
    if spikes:
        spikes_text = "\n".join(
            f"  - t={int(s.timestamp)}s: {s.network} peaked at {s.score}"
            for s in spikes[:15]
        )

    drops_text = "None detected"
    if drop_offs:
        drops_text = "\n".join(
            f"  - t={int(d.timestamp)}s: {d.network} dropped to {d.score} for {d.duration}s"
            for d in drop_offs[:15]
        )

    return f"""Analyze the following brain-response data from a video in the "{niche}" niche.

## Network Scores (overall averages, 0-100 scale)
{scores_text}

## Timeline Data (per-second network activation)
{timeline_text}

## Spike Events (high-engagement peaks)
{spikes_text}

## Drop-Off Events (low-engagement periods)
{drops_text}

Respond with a JSON object containing exactly these five keys:

1. "overall_assessment": A 2-3 sentence summary of the video's neural performance across all networks.

2. "network_interpretations": An array of objects, one per network, each with:
   - "network": network name
   - "score": the score
   - "label": the label
   - "interpretation": 1-2 sentences explaining what this score means for content in the "{niche}" niche

3. "drop_off_analysis": An array of objects for each significant drop-off, each with:
   - "timestamp": the second where the drop-off starts
   - "duration": how long it lasts
   - "network": which network dropped
   - "description": 1 sentence explaining the likely cause and impact

4. "suggestions": An array of objects with improvement recommendations, each with:
   - "timestamp": the second to target (null if general)
   - "network": which network to improve (null if general)
   - "suggestion": 1-2 sentences with a specific, actionable recommendation

5. "strength_highlights": An array of objects identifying what works well, each with:
   - "timestamp": the second where this strength appears (null if general)
   - "network": which network shows strength (null if general)
   - "description": 1 sentence describing the strength

Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON."""


def parse_analysis_response(response_text: str) -> AnalysisOutput:
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    data = json.loads(text)

    network_interpretations = [
        NetworkInterpretation(**item) for item in data.get("network_interpretations", [])
    ]
    drop_off_analysis = [
        DropOffDetail(**item) for item in data.get("drop_off_analysis", [])
    ]
    suggestions = [Suggestion(**item) for item in data.get("suggestions", [])]
    strength_highlights = [
        StrengthHighlight(**item) for item in data.get("strength_highlights", [])
    ]

    return AnalysisOutput(
        overall_assessment=data.get("overall_assessment", ""),
        network_interpretations=network_interpretations,
        drop_off_analysis=drop_off_analysis,
        suggestions=suggestions,
        strength_highlights=strength_highlights,
    )


async def generate_analysis(video_id: UUID, niche: str = "general") -> dict:
    predictions = load_prediction(video_id)
    if predictions is None:
        return None

    network_scores = compute_network_scores(predictions)
    timeline = compute_timeline(predictions)
    spikes = detect_spikes(timeline)
    drop_offs = detect_drop_offs(timeline)

    prompt = build_analysis_prompt(network_scores, timeline, spikes, drop_offs, niche)
    logger.info("Calling LLM for analysis of video %s", video_id)

    response_text = await llm_client.generate(prompt)
    analysis = parse_analysis_response(response_text)

    output_dir = settings.upload_dir / str(video_id)
    analysis_path = output_dir / "analysis.json"
    analysis_path.write_text(
        json.dumps(
            {
                "video_id": str(video_id),
                "niche": niche,
                "network_scores": [s.model_dump() for s in network_scores],
                "analysis": analysis.model_dump(),
                "timeline": [t.model_dump() for t in timeline],
                "spikes": [s.model_dump() for s in spikes],
                "drop_offs": [d.model_dump() for d in drop_offs],
            },
            indent=2,
        )
    )

    logger.info("Analysis complete for video %s", video_id)
    return {
        "network_scores": network_scores,
        "analysis": analysis,
        "timeline": timeline,
        "spikes": spikes,
        "drop_offs": drop_offs,
    }


def load_analysis(video_id: UUID) -> dict | None:
    analysis_path = settings.upload_dir / str(video_id) / "analysis.json"
    if not analysis_path.exists():
        return None
    return json.loads(analysis_path.read_text())


def build_comparison_prompt(
    v1_scores: list[dict],
    v2_scores: list[dict],
    v1_drop_offs: list[dict],
    v2_drop_offs: list[dict],
) -> str:
    v1_text = "\n".join(
        f"  - {s['name']}: {s['score']}/100 ({s['label']})" for s in v1_scores
    )
    v2_text = "\n".join(
        f"  - {s['name']}: {s['score']}/100 ({s['label']})" for s in v2_scores
    )
    delta_text = "\n".join(
        f"  - {s2['name']}: {s1['score']} → {s2['score']} ({'+' if s2['score'] - s1['score'] > 0 else ''}{round(s2['score'] - s1['score'], 1)})"
        for s1, s2 in zip(v1_scores, v2_scores)
    )

    v1_drops_text = "None"
    if v1_drop_offs:
        v1_drops_text = "\n".join(
            f"  - t={int(d['timestamp'])}s: {d['network']} dropped to {d['score']} for {d['duration']}s"
            for d in v1_drop_offs[:15]
        )

    v2_drops_text = "None"
    if v2_drop_offs:
        v2_drops_text = "\n".join(
            f"  - t={int(d['timestamp'])}s: {d['network']} dropped to {d['score']} for {d['duration']}s"
            for d in v2_drop_offs[:15]
        )

    return f"""Compare the neural engagement between the original video (v1) and the re-uploaded improved version (v2).

## V1 Network Scores
{v1_text}

## V2 Network Scores
{v2_text}

## Score Deltas (v1 → v2)
{delta_text}

## V1 Drop-Off Events
{v1_drops_text}

## V2 Drop-Off Events
{v2_drops_text}

Respond with a JSON object containing exactly these keys:

1. "summary": A 2-3 sentence overall comparison summarizing what changed between versions and whether the re-shoot improved neural engagement.

2. "improvements": An array of objects for each network that improved (delta > 0), each with:
   - "network": network name
   - "v1_score": original score
   - "v2_score": new score
   - "delta": the change (positive number)
   - "commentary": 1-2 sentences explaining what likely improved and why

3. "regressions": An array of objects for each network that regressed (delta < 0), same schema as improvements but delta is negative. Include commentary on what may have caused the regression.

4. "fixed_issues": An array of objects for v1 drop-offs that no longer appear in v2, each with:
   - "timestamp": the original drop-off timestamp
   - "network": which network
   - "description": 1 sentence on what was fixed

5. "persistent_issues": An array of objects for v1 drop-offs that still appear in v2 (overlapping time and network), each with:
   - "timestamp": the drop-off timestamp
   - "network": which network
   - "description": 1 sentence on why this may persist and what to try

6. "recommendations": An array of 2-4 strings, each a specific actionable recommendation for the next iteration based on the comparison.

Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON."""


def parse_comparison_response(response_text: str) -> ComparisonOutput:
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    data = json.loads(text)

    return ComparisonOutput(
        summary=data.get("summary", ""),
        improvements=[
            ComparisonNetworkDelta(**item) for item in data.get("improvements", [])
        ],
        regressions=[
            ComparisonNetworkDelta(**item) for item in data.get("regressions", [])
        ],
        fixed_issues=[
            ComparisonFixedIssue(**item) for item in data.get("fixed_issues", [])
        ],
        persistent_issues=[
            ComparisonPersistentIssue(**item)
            for item in data.get("persistent_issues", [])
        ],
        recommendations=data.get("recommendations", []),
    )


async def generate_comparison(video_id: UUID, original_video_id: UUID) -> ComparisonOutput | None:
    v2_data = load_analysis(video_id)
    v1_data = load_analysis(original_video_id)
    if v2_data is None or v1_data is None:
        return None

    prompt = build_comparison_prompt(
        v1_scores=v1_data["network_scores"],
        v2_scores=v2_data["network_scores"],
        v1_drop_offs=v1_data.get("drop_offs", []),
        v2_drop_offs=v2_data.get("drop_offs", []),
    )

    logger.info("Calling LLM for comparison of video %s vs %s", video_id, original_video_id)
    response_text = await llm_client.generate(prompt)
    comparison = parse_comparison_response(response_text)

    output_dir = settings.upload_dir / str(video_id)
    comparison_path = output_dir / "comparison.json"
    comparison_path.write_text(
        json.dumps(
            {
                "video_id": str(video_id),
                "original_video_id": str(original_video_id),
                "comparison": comparison.model_dump(),
            },
            indent=2,
        )
    )

    logger.info("Comparison complete for video %s", video_id)
    return comparison


def load_comparison(video_id: UUID) -> dict | None:
    comparison_path = settings.upload_dir / str(video_id) / "comparison.json"
    if not comparison_path.exists():
        return None
    return json.loads(comparison_path.read_text())
