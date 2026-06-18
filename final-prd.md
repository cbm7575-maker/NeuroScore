# Final PRD — NeuroScore

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

## PR Breakdown

Each PR below is a self-contained, shippable unit of work. PRs are ordered by dependency — each builds on the previous.

---

### PR 1 — Project Scaffolding & Video Upload Pipeline

**Goal:** Set up the project structure and implement video upload with validation.

**Scope:**

- Initialize project repo with Python backend (framework TBD) and frontend skeleton.
- Dependency management: `pyproject.toml` or `requirements.txt`.
- Video upload endpoint: accept mp4, mov, webm, avi. No hardcoded duration limit.
- Extract and display metadata (duration, resolution, file size).
- Store uploaded video on local filesystem for later version comparison.
- Basic upload UI: drag-and-drop or file picker, progress indicator, metadata display.
- Error handling for invalid file types and upload failures.

**Infrastructure:**

- Python >= 3.11.
- Frontend: WebGL-capable browser assumed. Framework TBD.
- Local file storage for videos.

**Acceptance Criteria:**

- User can upload a supported video file.
- Metadata is extracted and displayed.
- Invalid files are rejected with a clear error.
- Video is persisted to disk for downstream processing.

---

### PR 2 — TRIBE v2 Model Integration & Neural Inference

**Goal:** Run TRIBE v2 inference on uploaded videos and produce the raw prediction matrix.

**Scope:**

- Install TRIBE v2: `pip install -e .` from `facebookresearch/tribev2`. Plotting extras: `pip install -e ".[plotting]"` (nibabel, nilearn, pyvista, matplotlib, scipy).
- PyTorch >= 2.5.1, < 2.7. torchvision >= 0.20, < 0.22.
- Load model from HuggingFace: `facebook/tribev2`. Text encoder uses LLaMA 3.2-3B (gated, requires HuggingFace token with Meta license accepted).
- HuggingFace token configuration (`HF_TOKEN` env var).
- Inference pipeline: accept uploaded video path, run TRIBE v2, output prediction matrix.
- **Output:** Matrix of shape `(T, 20484)` — predicted BOLD fMRI signal intensity per cortical vertex per second. Predictions offset by 5 seconds for hemodynamic delay.
- Queue/background processing so the upload endpoint returns immediately.
- Progress indicator on frontend during inference.

**Infrastructure:**

- Local GPU with sufficient VRAM.
- HuggingFace account with Meta LLaMA 3.2 license accepted.

**Acceptance Criteria:**

- TRIBE v2 loads and runs inference on an uploaded video.
- Raw `(T, 20484)` matrix is produced and stored.
- Frontend shows processing status.
- Errors (missing token, GPU OOM, unsupported video) are handled gracefully.

---

### PR 3 — ICA Network Aggregation & Scoring Engine

**Goal:** Reduce raw vertex data into five network signals, compute scores, and detect spikes/drop-offs.

**Scope:**

**ICA Network Aggregation:**

- Map each of the 20,484 vertices to one of five ICA-derived functional networks:
  1. **Visual** — Visual cortex. How visually stimulating the content is.
  2. **Primary auditory** — Auditory cortex. How the audio track engages auditory processing.
  3. **Language** — Language network. How spoken words, captions, or narrative engage linguistic processing.
  4. **Motion** — Motor cortex. Physical movement, action sequences, kinesthetic response.
  5. **Default mode** — Self-referential thinking, narrative processing, memory encoding. The memorability and personal connection signal.
- Average activation within each network per timestep. Output: `(T, 5)`.

**Baseline Scoring:**

- Compute mean activation per network across full video duration.
- Compare against baseline means; express as a multiplier (e.g., "2.4x baseline").
- Convert to 0–100 scale where 50 = baseline activation. Above 50 = stronger engagement; below 50 = weaker.
- Compute composite score as weighted average of five network scores (default: 20% each).
- Niche presets:
  - Comedy: auditory 25%, language 25%, visual 20%, default mode 20%, motion 10%.
  - Education: language 30%, default mode 25%, visual 20%, auditory 15%, motion 10%.
  - Fitness/dance: motion 30%, visual 25%, auditory 25%, default mode 10%, language 10%.
- Custom weight adjustment available.
- Store all scores for version comparison.

**Timeline Analysis:**

- Output activation levels for all five networks per second.
- **Spikes:** activation exceeds 1.5 standard deviations above the video's own mean.
- **Drop-offs:** activation falls below 0.5 standard deviations below mean, sustained for 2+ consecutive seconds.
- Output structured timeline: timestamp, activation values per network, spike/drop-off classification, and which networks are affected.
- Thresholds are tunable during development.

**Acceptance Criteria:**

- Raw `(T, 20484)` matrix is reduced to `(T, 5)` network signals.
- Five network scores (0–100) and composite score are computed.
- Timeline with spike/drop-off annotations is produced.
- Niche presets and custom weights work correctly.

**Open Questions for this PR:**

- ICA vertex-to-network mapping must be extracted from the model or reproduced via ICA on model weights.
- Exact mapping from raw activation multipliers to 0–100 scale needs calibration with real output data.

---

### PR 4 — LLM Interpretation Layer

**Goal:** Connect an LLM to translate neural data into actionable analysis, and power the content improvement suggestions.

**Scope:**

**LLM Integration:**

- API integration with selected provider (Claude API, OpenAI API, or Kimi K2.5 — TBD).
- API key configuration.
- System prompt engineering for neural data interpretation.

**Network-to-Fix Mapping:**

- **Visual drops** — Visuals became stale. Fix: change angle, add cut/transition, text overlay, visual contrast.
- **Auditory drops** — Audio lost grip. Fix: change music energy, add sound effect, vary vocal tone, strategic pause.
- **Language drops** — Spoken/written content disengaged. Fix: rewrite lines, add question, simplify, add captions.
- **Motion drops** — Movement stalled. Fix: add gestures, walking, motion transitions, action B-roll.
- **Default mode drops** — Viewer stopped relating. Fix: personal story, "you" language, relatable scenario, emotional beat.

**Analysis Output:**

- Overall assessment.
- Per-network interpretation.
- Drop-off analysis with timestamps.
- Improvement suggestions tied to network data.
- Strength highlights.

**Inputs to LLM:** Five network scores, full timeline data with spikes/drop-offs, user's content niche, system prompt guidelines.

**Acceptance Criteria:**

- LLM receives structured neural data and returns actionable analysis.
- Suggestions are organized by timestamp with network data alongside.
- Network-to-fix mapping is correctly applied.
- API errors are handled gracefully.

**Open Questions for this PR:**

- LLM API selection: Claude, OpenAI, or Kimi K2.5. Deferred to development.

---

### PR 5 — 3D Brain Visualization

**Goal:** Render an interactive 3D brain model that displays predicted cortical activation in real-time as the video plays.

**Scope:**

**Mesh Setup:**

- Export fsaverage5 cortical surface mesh (~20,484 vertices) to a web-friendly format (glTF, OBJ, or raw arrays for Three.js).
- fsaverage5 is a FreeSurfer standard template sourced via Nilearn.
- Load mesh as a static frontend asset.

**Real-Time Vertex Coloring:**

- At each second of playback, update vertex colors from the `(T, 20484)` prediction matrix.
- High activation: warm colors (reds, oranges, yellows). Low activation: cool colors (blues, grays).
- As the video plays, the brain heatmap shifts in real-time across the cortical surface.

**Interactivity:**

- Rotate, zoom, pan the brain model.
- Both hemispheres displayed.
- Color scale legend alongside the brain.
- Current timestamp displayed and updating.

**Technical Implementation:**

- Browser rendering via WebGL (Three.js or equivalent).
- Load fsaverage5 as geometry with dynamic vertex colors.
- Backend pre-computes the full prediction matrix; frontend updates vertex colors per timestep.

**Acceptance Criteria:**

- 3D brain renders in the browser with both hemispheres.
- Vertex colors update per second based on prediction data.
- User can rotate, zoom, and pan.
- Color scale legend and timestamp are visible.
- Performance is smooth at 1 Hz update rate.

**Open Questions for this PR:**

- Brain mesh delivery format (glTF, OBJ, or raw arrays) needs benchmarking.

---

### PR 6 — Analysis Tab UI

**Goal:** Build the complete Analysis tab that displays all results and serves as the entry point to the improvement funnel.

**Scope:**

**Display Elements:**

- Composite overall score displayed prominently.
- Five individual network scores with labels.
- 3D brain visualization (integrated from PR 5) synced to video playback.
- Timeline displayed as multi-line chart (one line per network) with highlighted spike/drop-off zones.
- LLM suggestions (from PR 4) organized by timestamp with network data alongside.

**Video-Brain Sync:**

- Brain visualization and video player are synced. Play, pause, scrub, and seek controls update both in lockstep.

**Funnel Entry:**

- **"Generate hooks"** button at the bottom to enter the improvement funnel (navigates to Hooks tab).

**Re-upload Action:**

- **"Re-upload improved version"** action for version comparison (feeds into PR 9).

**Niche Selection:**

- UI for selecting content niche (comedy, education, fitness/dance, custom).
- Niche selection adjusts composite score weights and LLM context.

**Acceptance Criteria:**

- All scores, timeline, brain visualization, and LLM suggestions render correctly.
- Video and brain visualization are synced during playback.
- "Generate hooks" button navigates to Hooks tab.
- Niche selection updates scores in real-time.

---

### PR 7 — Hooks Tab (Improvement Funnel Part 1)

**Goal:** Generate, select, and edit improved video hooks based on neural data from the opening seconds.

**Scope:**

**Tab Access Control:**

- Hooks tab is accessible only after clicking "Generate hooks" on the Analysis tab.

**Hook Generation:**

- LLM receives first 3–5 seconds of neural data, existing hook (from transcript), full analysis context, and niche.
- Generates multiple improved hook options.
- Each hook targets specific neural weaknesses identified in the opening seconds.
- Hooks preserve neurally strong elements and rewrite weak ones.

**Selection & Editing:**

- Display all generated hooks for user selection.
- User selects one hook.
- Selected hook opens in an editable text field for manual refinement.

**Funnel Progression:**

- **"Generate script"** button to proceed to the Script tab.
- Button is enabled only after a hook is selected.

**Acceptance Criteria:**

- Multiple hook options are generated and displayed.
- User can select a hook and edit it.
- "Generate script" button proceeds to Script tab with selected hook data.
- Tab is inaccessible without first completing analysis.

---

### PR 8 — Script Tab (Improvement Funnel Part 2)

**Goal:** Generate an improved full script based on the selected hook and neural timeline data.

**Scope:**

**Tab Access Control:**

- Script tab is accessible only after selecting and editing a hook on the Hooks tab.

**Script Generation:**

- LLM receives: selected/edited hook, full timeline with drop-offs, existing transcript, and niche.
- Generates a surgically improved script that fixes drop-off sections while preserving core content.

**Display:**

- Improved script displayed alongside the original transcript.
- Changes are highlighted and annotated with which network each fix targets.
- The full script is editable.

**Post-Script Flow:**

- User takes the script, re-shoots, and returns to the Analysis tab to re-upload for comparison.
- Clear instructions/UI guiding the user back to Analysis tab for re-upload.

**Acceptance Criteria:**

- Improved script is generated from hook + neural data + transcript.
- Side-by-side display shows original vs. improved with highlighted changes.
- Network annotations are visible on each change.
- Script is fully editable.
- Tab is inaccessible without first selecting a hook.

---

### PR 9 — Version Comparison

**Goal:** Allow the creator to re-upload an improved video and compare neural performance against the original.

**Scope:**

**Re-upload Flow:**

- Accept re-uploaded video from the Analysis tab.
- Run through the full pipeline (TRIBE v2 inference, ICA aggregation, scoring, LLM interpretation).

**Comparison Display:**

- Side-by-side display:
  - Overall score delta.
  - Per-network score deltas.
  - Timeline overlay with v1 drop-off zones highlighted on v2 timeline.
  - LLM comparison commentary.

**Brain Visualization Comparison:**

- Side-by-side v1 and v2 3D brains, synced to the same timestamp, for visual comparison of cortical activation patterns.

**Constraints:**

- Pairwise comparison only: current vs. previous.
- System holds exactly two versions at a time.

**Acceptance Criteria:**

- Re-uploaded video runs through the full pipeline.
- Side-by-side scores, timelines, and brain visualizations render correctly.
- LLM provides meaningful comparison commentary.
- Only two versions are held; re-uploading replaces the older version.

---

## License and Legal

- TRIBE v2: CC-BY-NC 4.0. Personal, non-commercial use only.
- LLaMA 3.2-3B: Requires separate license acceptance via Meta's HuggingFace page.
- fsaverage5: FreeSurfer standard template, free for research and non-commercial use.
- No raw video data transmitted externally for TRIBE v2 (runs locally). LLM API calls transmit neural activation data only.

---

## Open Questions (Global)

1. **ICA network mapping:** Vertex-to-network mapping must be extracted from the model or reproduced via ICA on model weights.
2. **LLM API selection:** Claude, OpenAI, or Kimi K2.5. Deferred to development.
3. **Scoring normalization:** Exact mapping from raw activation multipliers to 0–100 scale needs calibration with real output data.
4. **Tech stack:** Frontend framework, database, and deployment architecture TBD.
5. **Processing time:** TRIBE v2 inference time on consumer GPUs needs benchmarking for UX decisions.
6. **Brain mesh delivery:** fsaverage5 mesh needs export to web-friendly format (glTF, OBJ, or raw arrays for Three.js).
