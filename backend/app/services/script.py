import json

import anthropic

from app.config import settings
from app.schemas.script import (
    ScriptAnnotation,
    ScriptGenerationRequest,
    ScriptGenerationResponse,
)
from app.schemas.timeline import Classification


NETWORK_DESCRIPTIONS = {
    "visual": "Visual cortex — responds to scene changes, color contrast, on-screen movement",
    "auditory": "Auditory cortex — responds to vocal variety, sound effects, music shifts",
    "language": "Language network — responds to storytelling, wordplay, rhetorical devices",
    "motion": "Motion areas — responds to physical movement, gestures, dynamic camera work",
    "default_mode": "Default mode network — responds to personal relevance, self-reflection, emotional resonance",
}


def _build_drop_off_summary(request: ScriptGenerationRequest) -> str:
    drop_offs: list[dict] = []
    current: dict | None = None

    for entry in request.timeline:
        networks_dropping = [
            name
            for name, cls in entry.classifications.model_dump().items()
            if cls == Classification.drop_off
        ]
        if networks_dropping:
            if current and entry.timestamp - current["end"] <= 1.0:
                current["end"] = entry.timestamp
                for n in networks_dropping:
                    current["networks"].add(n)
            else:
                if current:
                    drop_offs.append(current)
                current = {
                    "start": entry.timestamp,
                    "end": entry.timestamp,
                    "networks": set(networks_dropping),
                }
        else:
            if current:
                drop_offs.append(current)
                current = None

    if current:
        drop_offs.append(current)

    if not drop_offs:
        return "No significant drop-off zones detected."

    lines = []
    for d in drop_offs:
        nets = ", ".join(sorted(d["networks"]))
        lines.append(f"- {d['start']:.0f}s–{d['end']:.0f}s: drop-off in {nets}")
    return "\n".join(lines)


def _build_prompt(request: ScriptGenerationRequest) -> str:
    drop_off_summary = _build_drop_off_summary(request)

    network_info = "\n".join(
        f"- {name}: {desc}" for name, desc in NETWORK_DESCRIPTIONS.items()
    )

    return f"""You are a script optimization expert for short-form video content.

A creator's video has been analyzed with neural engagement prediction. You must rewrite their script to fix sections where viewer brain engagement drops off, while preserving their core message and style.

## Neural Networks
{network_info}

## Content Niche
{request.niche.value}

## Selected Hook (opening line)
{request.hook}

## Drop-off Zones (timestamps where neural engagement fell)
{drop_off_summary}

## Original Transcript
{request.transcript}

## Your Task
1. Start the script with the selected hook.
2. Rewrite sections that overlap with drop-off zones to re-engage the specific neural networks that dropped.
3. Preserve the creator's core message, facts, and personal style.
4. Keep the script roughly the same length.

## Response Format
Respond with valid JSON only, no markdown fences. Use this exact structure:
{{
  "improved_script": "The full rewritten script as a single string.",
  "annotations": [
    {{
      "original_text": "The original text segment that was changed",
      "improved_text": "The replacement text",
      "target_networks": ["network_name1", "network_name2"],
      "reason": "Brief explanation of why this change re-engages the target networks"
    }}
  ]
}}

Include an annotation for every meaningful change you made. If a section had no drop-offs, keep it as-is and do not annotate it."""


async def generate_script(request: ScriptGenerationRequest) -> ScriptGenerationResponse:
    if not settings.anthropic_api_key:
        raise ValueError(
            "NEUROSCORE_ANTHROPIC_API_KEY environment variable is not set"
        )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = _build_prompt(request)

    message = await client.messages.create(
        model=settings.script_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    parsed = json.loads(raw)

    annotations = [ScriptAnnotation(**a) for a in parsed["annotations"]]
    return ScriptGenerationResponse(
        improved_script=parsed["improved_script"],
        annotations=annotations,
    )
