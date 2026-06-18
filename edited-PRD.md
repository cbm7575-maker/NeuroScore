# Product Requirements Document — NeuroScore (Edited)

## Overview

NeuroScore is a personal video optimization tool for social media creators. It uses Meta's open-source TRIBE v2 model to predict how the human brain neurally responds to uploaded video content, then uses an LLM to translate those predictions into actionable scores, timeline analysis, and improvement suggestions. Every feature exists to help the creator improve their video's neural engagement before publishing.

Creators upload a video, receive a neural breakdown with a real-time 3D brain visualization showing cortical activation as the video plays, then move through a linear improvement funnel: generate improved hooks, select and edit one, generate an improved script, edit the script, re-shoot, re-upload, and compare against the original.

This is a non-commercial, personal-use tool. TRIBE v2 is licensed CC-BY-NC 4.0.

---

## Target User

Social media creators (TikTok, Instagram Reels, YouTube Shorts) who want to understand why their content works or doesn't at a neurological level and improve it before publishing.

---

## Core Concept

The fundamental problem in content creation is that feedback comes after publishing. NeuroScore inverts this: predict neural engagement before publishing, identify exactly which seconds lose the audience, improve the content with neural data as the creative brief, and iterate until the video triggers the strongest possible brain response.

TRIBE v2 predicts whole-brain fMRI responses to video input, trained on 1,100+ hours of real fMRI recordings from 720+ subjects. It outputs predicted cortical activation at 20,484 surface vertices at 1 Hz. These predictions are aggregated into five discovered functional networks, scored against a baseline, and used to drive an improvement funnel.

---

## Product Structure — Tab-Based Linear Funnel

Three tabs. The user moves through them in order. Each tab's output feeds the next.

### Tab 1 — Analysis

The user uploads their video, TRIBE v2 processes it, and results are displayed: a 3D brain visualization synced to video playback, five network scores, a second-by-second timeline with spikes and drop-offs, and the LLM's interpretation. At the bottom: a single **"Generate hooks"** button to enter the improvement funnel.

### Tab 2 — Hooks

Accessible only after clicking "Generate hooks." The LLM analyzes the first 3–5 seconds of neural data along with the existing hook and generates multiple improved options targeting specific neural weaknesses in the opening.

1. AI generates multiple hook options.
2. User selects one.
3. Selected hook opens in an editable text field.
4. User clicks **"Generate script"** to proceed.

### Tab 3 — Script

Accessible only after selecting and editing a hook. The LLM takes the selected hook, full neural timeline data, and the existing transcript to generate a surgically improved script that fixes drop-off sections while preserving core content.

1. AI generates the improved script alongside the original transcript.
2. Changes are highlighted and annotated with which network each fix targets.
3. The full script is editable.
4. User takes the script, re-shoots, and returns to the Analysis tab to re-upload for comparison.

---

## System Architecture

### Pipeline Stages

#### Stage 1 — Onboarding

**Purpose:** Set up user profile and establish neural baselines.

- Collect the user's content niche (comedy, education, lifestyle, fitness, finance, etc.).
- Run pre-selected baseline calibration videos through TRIBE v2. These are short, neutral clips that establish low-engagement activation across all five networks.
- Store baseline activation averages per network as the reference for all future scoring.
- Calibration runs once and does not repeat unless manually triggered.

#### Stage 2 — Video Upload (Analysis Tab)

**Purpose:** Accept and validate the creator's video.

- Accept uploads: mp4, mov, webm, avi. No hardcoded duration limit.
- Extract and display metadata (duration, resolution, file size).
- Queue for TRIBE v2 processing.
- Store the uploaded video for later version comparison.

#### Stage 3 — TRIBE v2 Inference

**Purpose:** Generate predicted neural activation data.

- TRIBE v2 runs locally on the user's GPU.
- Model loaded from HuggingFace: `facebook/tribev2`. Text encoder uses LLaMA 3.2-3B (gated, requires HuggingFace token with Meta license accepted).
- See [TRIBE v2 documentation](https://github.com/facebookresearch/tribev2) for inference code and API usage.
- **Output:** Matrix of shape `(T, 20484)` — predicted BOLD fMRI signal intensity per cortical vertex per second. Predictions offset by 5 seconds for hemodynamic delay.

#### Stage 4 — ICA Network Aggregation

**Purpose:** Reduce 20,484-vertex output into five interpretable network signals per timestep.

ICA applied to TRIBE v2's final layer discovers five functional networks:

1. **Visual** — Visual cortex. How visually stimulating the content is.
2. **Primary auditory** — Auditory cortex. How the audio track engages auditory processing.
3. **Language** — Language network. How spoken words, captions, or narrative engage linguistic processing.
4. **Motion** — Motor cortex. Physical movement, action sequences, kinesthetic response.
5. **Default mode** — Self-referential thinking, narrative processing, memory encoding. The memorability and personal connection signal.

**Aggregation:** Map each vertex to its ICA-derived network, average within each network per timestep. Output: `(T, 5)`.

#### Stage 5a — Baseline Scoring

**Purpose:** Grade each network's activation against the onboarding baseline.

- Compute mean activation per network across full video duration.
- Compare against baseline means; express as a multiplier (e.g., "2.4x baseline").
- Convert to 0–100 scale where 50 = baseline activation.
- Compute composite score as weighted average of five network scores (default: equal 20% weights, adjustable per niche).
- Store all scores for version comparison.

#### Stage 5b — Timeline Analysis

**Purpose:** Map second-by-second activation to identify spikes and drop-offs.

- Output activation levels for all five networks per second.
- **Spikes:** activation exceeds 1.5 standard deviations above the video's own mean.
- **Drop-offs:** activation falls below 0.5 standard deviations below mean, sustained for 2+ consecutive seconds.
- Output structured timeline: timestamp, activation values per network, spike/drop-off classification, and which networks are affected.
- Drop-off data is the primary input for the LLM and the improvement funnel.

#### Stage 6 — LLM Interpretation Layer

**Purpose:** Translate raw scores and timeline data into actionable analysis and power the improvement funnel.

**Inputs:** Five network scores, full timeline data with spikes/drop-offs, user's content niche, system prompt guidelines.

**Network-to-Fix Mapping:**

- **Visual drops** — Visuals became stale. Fix: change angle, add cut/transition, text overlay, visual contrast.
- **Auditory drops** — Audio lost grip. Fix: change music energy, add sound effect, vary vocal tone, strategic pause.
- **Language drops** — Spoken/written content disengaged. Fix: rewrite lines, add question, simplify, add captions.
- **Motion drops** — Movement stalled. Fix: add gestures, walking, motion transitions, action B-roll.
- **Default mode drops** — Viewer stopped relating. Fix: personal story, "you" language, relatable scenario, emotional beat.

**Analysis tab output:** Overall assessment, per-network interpretation, drop-off analysis with timestamps, improvement suggestions tied to network data, strength highlights.

**Hooks tab:** LLM receives first 3–5 seconds of neural data, existing hook, full analysis context, and niche. Generates multiple improved hooks preserving neurally strong elements and rewriting weak ones.

**Script tab:** LLM receives selected/edited hook, full timeline with drop-offs, existing transcript, and niche. Generates improved script displayed alongside original with annotated changes.

**LLM API:** TBD. Candidates: Claude API, OpenAI API, Kimi K2.5.

#### Stage 7 — Results Output (Analysis Tab Display)

- Display composite overall score prominently.
- Display five network scores with labels.
- Display 3D brain visualization (see section below).
- Display timeline as multi-line chart (one line per network) with highlighted spike/drop-off zones.
- Display LLM suggestions organized by timestamp with network data alongside.
- **"Generate hooks"** button to enter the funnel.
- **"Re-upload improved version"** action for version comparison.

#### Stage 8 — Version Comparison

- Accept re-uploaded video, run through full pipeline.
- Side-by-side display: overall score delta, per-network score deltas, timeline overlay with v1 drop-off zones highlighted, LLM comparison commentary.
- Pairwise comparison only: current vs. previous. System holds exactly two versions at a time.

---

## 3D Brain Visualization

### Overview

An interactive 3D brain model on the Analysis tab visualizes predicted cortical activation in real-time as the video plays. This is the actual fsaverage5 cortical surface mesh (~20,484 vertices) colored by predicted activation intensity at each second.

### How It Works

- At each second of playback, vertex colors update from the `(T, 20484)` prediction matrix.
- High activation: warm colors (reds, oranges, yellows). Low activation: cool colors (blues, grays).
- As the video plays, the brain heatmap shifts in real-time across the cortical surface.

### Sync with Video Playback

- Brain visualization and video player are synced. Play, pause, scrub, and seek controls update both in lockstep.

### Display Requirements

- Interactive: rotate, zoom, pan.
- Both hemispheres displayed.
- Color scale legend alongside the brain.
- Current timestamp displayed and updating.

### Technical Implementation

- fsaverage5 mesh geometry is a static asset (FreeSurfer standard template via Nilearn).
- Backend pre-computes the full prediction matrix; frontend updates vertex colors per timestep.
- Browser rendering via WebGL (Three.js or equivalent) loading fsaverage5 as geometry with dynamic vertex colors.

### Version Comparison

- Side-by-side v1 and v2 brains, synced to same timestamp, for visual comparison of cortical activation patterns.

---

## Infrastructure

- **GPU:** Local machine with sufficient VRAM for TRIBE v2 inference.
- **Python:** >= 3.11
- **TRIBE v2:** `pip install -e .` from `facebookresearch/tribev2` repo. Plotting extras: `pip install -e ".[plotting]"` (nibabel, nilearn, pyvista, matplotlib, scipy).
- **PyTorch:** >= 2.5.1, < 2.7. torchvision >= 0.20, < 0.22.
- **HuggingFace:** Account with Meta LLaMA 3.2 license accepted. Token set as `HF_TOKEN`.
- **LLM API key:** Provider TBD.
- **Frontend:** WebGL-capable browser, Three.js or equivalent for fsaverage5 mesh rendering.
- **Tech stack:** Backend is Python (non-negotiable). Frontend framework and architecture TBD.

---

## Scoring System

### Per-Network Scores

- 0–100 scale. 50 = baseline activation. Above 50 = stronger engagement; below 50 = weaker.

### Composite Score

- Weighted average of five network scores. Default: 20% each.
- Niche presets:
  - Comedy: auditory 25%, language 25%, visual 20%, default mode 20%, motion 10%.
  - Education: language 30%, default mode 25%, visual 20%, auditory 15%, motion 10%.
  - Fitness/dance: motion 30%, visual 25%, auditory 25%, default mode 10%, language 10%.
- Custom weight adjustment available.

### Drop-Off Thresholds

- Drop-off: < 0.5 SD below video mean, sustained 2+ seconds.
- Spike: > 1.5 SD above video mean.
- Thresholds are tunable during development.

---

## Open Questions

1. **Baseline calibration videos:** Which neutral clips for baseline? Need 3–5 standardized clips (visually bland, no narrative, minimal audio, no emotional content).
2. **ICA network mapping:** Vertex-to-network mapping must be extracted from the model or reproduced via ICA on model weights.
3. **LLM API selection:** Claude, OpenAI, or Kimi K2.5. Deferred to development.
4. **Scoring normalization:** Exact mapping from raw activation multipliers to 0–100 scale needs calibration with real output data.
5. **Tech stack:** Frontend framework, database, and deployment architecture TBD.
6. **Processing time:** TRIBE v2 inference time on consumer GPUs needs benchmarking for UX decisions.
7. **Brain mesh delivery:** fsaverage5 mesh needs export to web-friendly format (glTF, OBJ, or raw arrays for Three.js).

---

## License and Legal

- TRIBE v2: CC-BY-NC 4.0. Personal, non-commercial use only.
- LLaMA 3.2-3B: Requires separate license acceptance via Meta's HuggingFace page.
- fsaverage5: FreeSurfer standard template, free for research and non-commercial use.
- No raw video data transmitted externally for TRIBE v2 (runs locally). LLM API calls transmit neural activation data only.
