import json
import logging
from uuid import UUID

from app.config import settings
from app.schemas.analysis import HookOption
from app.services import llm_client
from app.services.analysis import (
    compute_network_scores,
    compute_timeline,
    detect_drop_offs,
    detect_spikes,
)
from app.services.inference import load_prediction

logger = logging.getLogger(__name__)

HOOKS_SYSTEM_PROMPT = (
    "You are NeuroScore Hook Generator, an expert at writing short-form video hooks "
    "(opening lines / first 3 seconds of a video) that maximize neural engagement.\n"
    "\n"
    "You analyze brain activation data to identify neural weaknesses in a video's opening, "
    "then craft hooks designed to activate the underperforming brain networks.\n"
    "\n"
    "Five cortical networks you optimize for:\n"
    "- Visual: scene complexity, color, motion, faces, visual novelty\n"
    "- Auditory: speech patterns, music, sound effects, audio dynamics\n"
    "- Attention: pacing, information density, cognitive load\n"
    "- Salience: surprise, humor, controversy, urgency, emotional punch\n"
    "- Default Mode: personal relevance, storytelling, empathy, self-reflection\n"
    "\n"
    "Each hook you generate must be a concrete, speakable opening line or action description "
    "that a creator can immediately use. Be specific, not generic. "
    "Always respond with valid JSON only."
)


def _build_hooks_prompt(
    network_scores: list,
    timeline: list,
    drop_offs: list,
    spikes: list,
    niche: str,
    current_hook: str | None = None,
) -> str:
    scores_text = "\n".join(
        f"  - {s.name}: {s.score}/100 ({s.label})" for s in network_scores
    )

    opening_seconds = min(5, len(timeline))
    opening_data = timeline[:opening_seconds]
    opening_text = "\n".join(
        f"  t={int(p.timestamp)}s: " + ", ".join(f"{k}={v}" for k, v in p.scores.items())
        for p in opening_data
    )

    opening_scores = {}
    if opening_data:
        networks = list(opening_data[0].scores.keys())
        for net in networks:
            vals = [p.scores[net] for p in opening_data]
            opening_scores[net] = round(sum(vals) / len(vals), 1)

    weaknesses = [
        net for net, score in opening_scores.items() if score < 50
    ]
    strengths = [
        net for net, score in opening_scores.items() if score >= 60
    ]

    return f"""Generate 5 alternative video hooks for a "{niche}" niche video.

## Overall Network Scores
{scores_text}

## Opening Seconds Data (first {opening_seconds}s)
{opening_text}

## Opening Network Averages
{json.dumps(opening_scores, indent=2)}

## Neural Weaknesses in Opening (score < 50)
{', '.join(weaknesses) if weaknesses else 'None - all networks performing adequately'}

## Neural Strengths in Opening (score >= 60)
{', '.join(strengths) if strengths else 'None identified'}

{"## Current Hook (user's starting point)\n" + current_hook + "\n\nGenerate 5 improved alternatives that address the neural weaknesses better than this current hook." if current_hook else ""}

Generate exactly 5 hook options. Each hook should be a different creative approach to fixing the neural weaknesses while preserving the strengths.

Respond with a JSON object containing exactly these keys:

1. "hooks": An array of exactly 5 objects, each with:
   - "hook_text": The actual hook text (1-3 sentences, speakable, specific)
   - "target_networks": Array of network names this hook aims to activate
   - "neural_weaknesses_addressed": Array of specific weaknesses this hook fixes
   - "preserved_elements": Array of strengths this hook keeps intact
   - "explanation": 1 sentence explaining why this hook works neurally

2. "opening_scores": The opening network averages as a dict
3. "neural_weaknesses": Array of weak network names
4. "neural_strengths": Array of strong network names

Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON."""


def _parse_hooks_response(response_text: str) -> dict:
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    data = json.loads(text)

    hooks = [HookOption(**h) for h in data.get("hooks", [])]

    return {
        "hooks": hooks,
        "opening_scores": data.get("opening_scores", {}),
        "neural_weaknesses": data.get("neural_weaknesses", []),
        "neural_strengths": data.get("neural_strengths", []),
    }


async def generate_hooks(video_id: UUID, niche: str = "general", current_hook: str | None = None) -> dict | None:
    predictions = load_prediction(video_id)
    if predictions is None:
        return None

    network_scores = compute_network_scores(predictions)
    timeline = compute_timeline(predictions)
    drop_offs = detect_drop_offs(timeline)
    spikes = detect_spikes(timeline)

    prompt = _build_hooks_prompt(network_scores, timeline, drop_offs, spikes, niche, current_hook)
    logger.info("Calling LLM for hook generation for video %s", video_id)

    response_text = await llm_client.generate(prompt, system=HOOKS_SYSTEM_PROMPT)
    result = _parse_hooks_response(response_text)

    output_dir = settings.upload_dir / str(video_id)
    hooks_path = output_dir / "hooks.json"
    hooks_path.write_text(
        json.dumps(
            {
                "video_id": str(video_id),
                "niche": niche,
                "hooks": [h.model_dump() for h in result["hooks"]],
                "opening_scores": result["opening_scores"],
                "neural_weaknesses": result["neural_weaknesses"],
                "neural_strengths": result["neural_strengths"],
            },
            indent=2,
        )
    )

    logger.info("Hook generation complete for video %s", video_id)
    return result


def load_hooks(video_id: UUID) -> dict | None:
    hooks_path = settings.upload_dir / str(video_id) / "hooks.json"
    if not hooks_path.exists():
        return None
    return json.loads(hooks_path.read_text())
