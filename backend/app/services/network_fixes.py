"""Network-to-fix mapping for TRIBE v2 neural networks.

Maps each brain network's attention drop to actionable fix categories
that the LLM uses when generating content improvement suggestions.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FixCategory:
    name: str
    description: str
    examples: list[str] = field(default_factory=list)


NETWORK_FIX_MAP: dict[str, list[FixCategory]] = {
    "visual": [
        FixCategory(
            name="change_angle",
            description="Switch camera angle or perspective to re-engage the visual cortex",
            examples=["Cut to a close-up", "Switch to an over-the-shoulder shot", "Use a top-down angle"],
        ),
        FixCategory(
            name="add_cut_or_transition",
            description="Insert a cut, jump-cut, or visual transition to break monotony",
            examples=["Add a jump cut", "Insert a swipe transition", "Use a match cut"],
        ),
        FixCategory(
            name="text_overlay",
            description="Add on-screen text, titles, or graphics to provide a visual anchor",
            examples=["Show a key stat as text", "Add a lower-third title", "Display a keyword callout"],
        ),
        FixCategory(
            name="visual_contrast",
            description="Introduce a visual contrast change such as color grading, lighting, or scene shift",
            examples=["Shift to a warmer color grade", "Cut to a brighter scene", "Use a B-roll with different lighting"],
        ),
    ],
    "auditory": [
        FixCategory(
            name="change_music_energy",
            description="Shift the background music energy level to match or contrast the moment",
            examples=["Drop the beat for emphasis", "Build energy with faster tempo", "Switch to a different track"],
        ),
        FixCategory(
            name="add_sound_effect",
            description="Insert a sound effect to punctuate a moment or transition",
            examples=["Add a whoosh on the transition", "Use a subtle notification ding", "Insert a bass drop hit"],
        ),
        FixCategory(
            name="vary_vocal_tone",
            description="Change vocal delivery — pace, pitch, or volume — to recapture auditory attention",
            examples=["Slow down and lower your voice", "Increase energy and speak faster", "Whisper for emphasis"],
        ),
        FixCategory(
            name="strategic_pause",
            description="Insert a deliberate pause or silence to create anticipation",
            examples=["Pause for 1-2 seconds before the key point", "Let the music fill a beat of silence", "Stop mid-sentence for effect"],
        ),
    ],
    "language": [
        FixCategory(
            name="rewrite_lines",
            description="Rewrite the script at this point to be clearer, punchier, or more engaging",
            examples=["Replace jargon with plain language", "Shorten the sentence to under 10 words", "Lead with the payoff"],
        ),
        FixCategory(
            name="add_question",
            description="Insert a direct or rhetorical question to activate language processing",
            examples=["Ask 'But what does that actually mean?'", "Pose 'Have you ever noticed...?'", "Use 'Want to know the secret?'"],
        ),
        FixCategory(
            name="simplify",
            description="Reduce complexity — fewer clauses, shorter words, one idea per sentence",
            examples=["Break the compound sentence in two", "Replace the technical term with an analogy", "Cut filler words"],
        ),
        FixCategory(
            name="add_captions",
            description="Add or improve on-screen captions to reinforce the spoken words",
            examples=["Add keyword captions that highlight the main point", "Use animated captions for emphasis", "Show captions in sync with speech"],
        ),
    ],
    "motion": [
        FixCategory(
            name="add_gestures",
            description="Incorporate hand gestures or body language to stimulate the motion network",
            examples=["Use hand gestures to illustrate the point", "Count off items on your fingers", "Point at the camera for emphasis"],
        ),
        FixCategory(
            name="walking_or_movement",
            description="Introduce physical movement — walking, shifting position, or changing location",
            examples=["Walk toward the camera", "Shift from sitting to standing", "Move to a different part of the set"],
        ),
        FixCategory(
            name="motion_transitions",
            description="Use motion-based transitions like zooms, pans, or tracking shots",
            examples=["Add a smooth zoom-in", "Use a pan transition to the next scene", "Insert a dolly push-in"],
        ),
        FixCategory(
            name="action_broll",
            description="Cut to B-roll footage that contains physical action or movement",
            examples=["Show hands-on demonstration footage", "Cut to someone using the product", "Insert action-oriented stock footage"],
        ),
    ],
    "default_mode": [
        FixCategory(
            name="personal_story",
            description="Share a personal anecdote or story to activate the default mode network",
            examples=["Tell a quick personal failure story", "Share a relatable behind-the-scenes moment", "Recall a specific memory tied to the topic"],
        ),
        FixCategory(
            name="you_language",
            description="Switch to second-person ('you') language to make the viewer self-reflect",
            examples=["Say 'Imagine you're in this situation'", "Ask 'How would you handle this?'", "Use 'This is what happens to you when...'"],
        ),
        FixCategory(
            name="relatable_scenario",
            description="Present a hypothetical or common scenario the viewer can see themselves in",
            examples=["Describe a common frustration the audience faces", "Paint a 'day in the life' picture", "Set up a 'what if' scenario"],
        ),
        FixCategory(
            name="emotional_beat",
            description="Insert an emotional moment — humor, surprise, vulnerability — to deepen engagement",
            examples=["Add a self-deprecating joke", "Reveal something unexpected", "Show genuine vulnerability or excitement"],
        ),
    ],
}

NETWORK_LABELS: dict[str, str] = {
    "visual": "Visual Network",
    "auditory": "Auditory Network",
    "language": "Language Network",
    "motion": "Motion Network",
    "default_mode": "Default Mode Network",
}


def get_fix_categories(network: str) -> list[FixCategory]:
    key = network.lower().replace(" ", "_")
    if key not in NETWORK_FIX_MAP:
        raise ValueError(
            f"Unknown network '{network}'. "
            f"Valid networks: {', '.join(NETWORK_FIX_MAP)}"
        )
    return NETWORK_FIX_MAP[key]


def build_prompt_context(drops: dict[str, list[float]] | None = None) -> str:
    """Build a prompt fragment that maps each network to its fix categories.

    Args:
        drops: Optional dict mapping network keys to lists of timestamps (in
            seconds) where attention dropped. When provided, only networks with
            drops are included and the timestamps are listed.

    Returns:
        A formatted string ready to be injected into an LLM prompt.
    """
    networks = drops.keys() if drops else NETWORK_FIX_MAP.keys()
    sections: list[str] = []

    for network in networks:
        key = network.lower().replace(" ", "_")
        if key not in NETWORK_FIX_MAP:
            continue

        label = NETWORK_LABELS[key]
        fixes = NETWORK_FIX_MAP[key]

        header = f"### {label}"
        if drops and network in drops:
            timestamps = ", ".join(f"{t:.1f}s" for t in drops[network])
            header += f" (drops at: {timestamps})"

        fix_lines = []
        for fix in fixes:
            examples_str = "; ".join(fix.examples)
            fix_lines.append(f"- **{fix.name}**: {fix.description} (e.g., {examples_str})")

        sections.append(header + "\n" + "\n".join(fix_lines))

    preamble = (
        "## Network-to-Fix Mapping\n"
        "When a viewer's attention drops in a specific brain network, suggest fixes "
        "from the corresponding category below. Each fix targets the neural pathway "
        "that disengaged.\n"
    )
    return preamble + "\n\n".join(sections)
