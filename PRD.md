# Product Requirements Document — NeuroScore

## Overview

NeuroScore is a personal video optimization tool for social media creators. It uses Meta's open-source TRIBE v2 (TRImodal Brain Encoder) model to predict how the human brain neurally responds to uploaded video content, then uses an LLM to translate those raw neural predictions into actionable scores, timeline analysis, and improvement suggestions. The product's sole purpose is to make existing content stronger — not to generate new content from scratch. Every feature exists to help the creator improve their video's neural engagement so it triggers stronger responses across the brain's functional networks.

Creators upload a video, receive a full neural breakdown with a real-time 3D brain visualization showing cortical activation as the video plays, then move through a linear improvement funnel: generate improved hooks, select and edit one, generate an improved script based on that hook, edit the script, re-shoot, re-upload, and compare the new version against the original to verify the improvements worked neurally.

This is a non-commercial, personal-use tool. TRIBE v2 is licensed CC-BY-NC 4.0.

---

## Target User

General social media creators (TikTok, Instagram Reels, YouTube Shorts) who want to understand why their content works or doesn't work at a neurological level and improve it before publishing.

---

## Core Concept

The fundamental problem in content creation is that feedback comes after publishing. Creators publish, measure what performed, and try to reverse-engineer why. NeuroScore inverts this loop: predict neural engagement before publishing, identify exactly which seconds lose the audience, improve the content with neural data as the creative brief, and iterate until the video triggers the strongest possible brain response.

TRIBE v2 makes this possible by predicting whole-brain fMRI responses to video input, trained on 1,100+ hours of real fMRI recordings from 720+ subjects. It outputs predicted cortical activation at the resolution of 20,484 surface vertices at 1 Hz (one prediction per second of video). These raw predictions are aggregated into TRIBE v2's own five discovered functional networks, scored against a baseline, and used to drive an improvement funnel that helps the creator fix their hook, fix their script, and re-shoot a stronger version.

---

## Product Structure — Tab-Based Linear Funnel

The product is organized as a linear funnel across three tabs. The user moves through them in order. You cannot skip ahead — each tab's output feeds the next.

### Tab 1 — Analysis

The entry point. The user uploads their video, TRIBE v2 processes it, and the results are displayed: a 3D brain visualization synced to video playback, five network scores, a second-by-second timeline with spikes and drop-offs, and the LLM's interpretation of what's working and what isn't. At the bottom of the analysis results, there is a single button: **"Generate hooks."** This is the only path forward into the improvement funnel.

### Tab 2 — Hooks

Accessible only after clicking "Generate hooks" from the Analysis tab. The LLM analyzes the first 3–5 seconds of the video's neural data along with the existing hook (what the video currently opens with) and generates multiple improved hook options. These improved hooks are designed to fix the specific neural weaknesses in the opening — if the visual network was strong but default mode was flat, the hooks keep the visuals and add a personal/relatable element.

**Interaction pattern:**
1. The AI generates multiple hook options.
2. The user reads through them and selects the one they like by clicking on it.
3. The selected hook opens in an editable text field. The user can modify the wording, adjust phrasing, or keep it as-is.
4. Once the user is satisfied with the edited hook, they click **"Generate script"** — the single button that moves them to the next tab.

### Tab 3 — Script

Accessible only after selecting and editing a hook on the Hooks tab. The LLM takes three inputs: the selected/edited hook from Tab 2, the full neural timeline data (all spikes and drop-offs across the entire video), and the existing video's transcript. It generates an improved version of the full script — not a new script from scratch, but a surgical improvement of the existing one that fixes the drop-off sections while keeping the core content and structure intact.

**Interaction pattern:**
1. The AI generates the improved script, displayed alongside the original transcript for comparison.
2. Changes are highlighted and annotated with why each change was made (which network it targets, what drop-off it fixes).
3. The full script is editable. The user can modify any section.
4. Once the user is satisfied, they take the script, re-shoot the video, and return to the Analysis tab to re-upload the improved version for comparison.

### Standard Interaction Pattern Across All Tabs

Every tab in the improvement funnel follows the same pattern. This pattern applies to the current Hooks and Script tabs and to any future tabs added to the funnel:

1. **AI generates multiple options** (or a single improved output, depending on the tab).
2. **User selects** the option they prefer.
3. **Selected option becomes editable** — the user can modify it freely.
4. **User clicks forward** via a single button to proceed to the next tab.

The user is never locked into the AI's exact output. The AI proposes, the user chooses, the user refines, then moves forward.

---

## System Architecture

### Pipeline Stages

#### Stage 1 — Onboarding

**Purpose:** Set up the user profile and establish neural baselines for scoring.

**Requirements:**

- Collect the user's content niche (comedy, education, lifestyle, fitness, finance, etc.) so the LLM can tailor improvement suggestions and generated hooks/scripts to their style and audience expectations.
- Run a set of pre-selected "baseline calibration" videos through TRIBE v2 during setup. These are short, neutral clips (flat content with minimal stimulation) that establish what low-engagement neural activation looks like across all five networks.
- Store baseline activation averages per network. These become the reference point for all future video scoring.
- Baseline calibration runs once during onboarding and does not need to be repeated unless the user manually triggers a recalibration.

#### Stage 2 — Video Upload (Analysis Tab)

**Purpose:** Accept and validate the creator's video for processing.

**Requirements:**

- Accept video uploads in standard formats: mp4, mov, webm, avi.
- No hardcoded duration limit. Accept any video length.
- Extract and display basic metadata (duration, resolution, file size) before processing.
- Queue the video for TRIBE v2 processing.
- Store the uploaded video file associated with the user's session for later version comparison.

#### Stage 3 — TRIBE v2 Inference

**Purpose:** Run the uploaded video through Meta's TRIBE v2 model to generate predicted neural activation data.

**Technical details:**

- TRIBE v2 runs locally on the user's GPU.
- The model is loaded from HuggingFace: `facebook/tribev2`.
- The text encoder uses LLaMA 3.2-3B (gated model — requires HuggingFace token with Meta's license accepted).
- Python 3.11+ required. Key dependencies: PyTorch >= 2.5.1, torchvision, x_transformers, moviepy, transformers, huggingface_hub.

**Inference code path:**

```python
from tribev2 import TribeModel

model = TribeModel.from_pretrained("facebook/tribev2", cache_folder="./cache")
df = model.get_events_dataframe(video_path="path/to/video.mp4")
preds, segments = model.predict(events=df)
# preds.shape → (T, 20484)
# T = number of seconds, 20484 = cortical surface vertices (fsaverage5)
```

**Output:** A matrix of shape `(T, 20484)` representing predicted BOLD fMRI signal intensity for each cortical vertex at each second of the video. Predictions are offset by 5 seconds to compensate for hemodynamic delay.

- The model can also accept `audio_path` and `text_path` via `get_events_dataframe()`, but the primary input for this tool is video (which includes its own audio track, processed by TRIBE v2's Wav2Vec-BERT audio encoder).

#### Stage 4 — ICA Network Aggregation

**Purpose:** Reduce the raw 20,484-vertex output into five interpretable network-level signals per timestep.

**Technical details:**

When Independent Component Analysis (ICA) is applied to TRIBE v2's final layer, the model naturally discovers five functional networks. These are not externally imposed — they emerge from the data:

1. **Visual** — Visual cortex processing. How visually stimulating and engaging the content is. Driven by the V-JEPA2 video encoder pathway.
2. **Primary auditory** — Auditory cortex processing. How the audio track (music, voice, sound effects) engages auditory processing circuits.
3. **Language** — Language network activation. How spoken words, captions, or narrative structure engage linguistic processing.
4. **Motion** — Motor cortex and motion processing. Physical movement, action sequences, kinesthetic response.
5. **Default mode** — Default mode network. Self-referential thinking, narrative processing, memory encoding. High activation means the viewer is relating the content to their own experience — this is the memorability and personal connection signal.

**Aggregation process:**

- Map each of the 20,484 cortical vertices to its corresponding ICA-derived network.
- Average activation values within each network per timestep.
- Output: a matrix of shape `(T, 5)` — five network activation values per second of video.

#### Stage 5a — Baseline Scoring

**Purpose:** Grade each network's activation against the baseline established during onboarding.

**Requirements:**

- For each of the five networks, compute the mean activation across the full video duration.
- Compare each network mean against the corresponding baseline mean from the calibration videos.
- Express the result as a multiplier (e.g., "2.4x baseline" means activation was 2.4 times stronger than neutral content).
- Convert multipliers into a normalized score. Scoring scale TBD during development, but initial approach: 0–100 scale where 50 represents baseline-level activation.
- Compute a composite overall score as a weighted average of the five network scores. Default weights are equal (20% each) but can be adjusted per content niche during onboarding (e.g., comedy content may weight auditory and language higher).
- Store all scores associated with this video version for later comparison.

#### Stage 5b — Timeline Analysis (Self-Referencing)

**Purpose:** Map second-by-second activation across all five networks to identify spikes and drop-offs within the video.

**Requirements:**

- For each second of the video, output activation levels for all five networks.
- Identify spike points: timestamps where activation in any network exceeds 1.5 standard deviations above the video's own mean for that network.
- Identify drop-off points: timestamps where activation in any network falls below 0.5 standard deviations below the video's own mean for that network.
- Drop-off detection should flag sustained drops (2+ consecutive seconds below threshold), not single-second dips.
- Output a structured timeline object containing: timestamp (second), activation values per network, spike/drop-off classification, and which specific networks are spiking or dropping at that moment.
- Drop-off data is the primary input to the LLM for generating improvement suggestions and for powering the improvement funnel.

#### Stage 6 — LLM Interpretation Layer

**Purpose:** Translate the raw scores and timeline data into actionable, creator-friendly analysis and improvement suggestions. This layer also powers the Hooks and Script tabs in the improvement funnel.

**Inputs to the LLM:**

- The five network scores from Stage 5a (with baseline comparison context).
- The full timeline data from Stage 5b (with spikes and drop-offs flagged).
- The user's content niche from onboarding.
- A set of predefined guidelines (system prompt) that instruct the LLM on how to interpret neural data and what constitutes good/bad patterns for social media content.

**LLM Guidelines (system prompt framework):**

The guidelines should instruct the LLM to:

- Focus specifically on drop-off points. For each drop-off, identify which networks dropped and what that means in creator terms.
- Map network drops to creator-actionable improvement strategies using the network-to-fix mapping defined below.
- Provide specific, timestamp-referenced suggestions. Not "improve your hook" but "between seconds 8–12, default mode and language both drop — the spoken content here isn't connecting. Consider replacing this section with a direct question to the viewer or a personal anecdote."
- Acknowledge what's working. Identify the strongest spike points and explain why they work so the creator can replicate those patterns.
- Keep suggestions within the creator's niche context. A comedy creator gets different advice than an educational creator.

**Network-to-Fix Mapping:**

Each of the five networks responds to different types of content. When a network drops, the fix is specific to that network:

- **Visual network drops** — The visuals became stale. Fixes: change the camera angle, add a cut or transition, introduce a text overlay, shift the background, add visual contrast. If the visual network flatlines for multiple seconds, the frame needs to change.
- **Auditory network drops** — The audio lost its grip. Fixes: change the music energy, add a sound effect, vary vocal tone or pacing, use a strategic pause for contrast, add an audio transition.
- **Language network drops** — The spoken or written content stopped engaging linguistic processing. Fixes: rewrite the spoken lines to be more direct, add a question, simplify complex sentences, add captions or on-screen text, use a callback to something said earlier.
- **Motion network drops** — Physical movement stalled. Fixes: add body movement, hand gestures, walking, transitions with motion, action-oriented B-roll.
- **Default mode network drops** — The most critical. The viewer stopped relating the content to their own life. Fixes: add a personal story, use "you" language, create a relatable scenario, reference a shared experience, add an emotional beat. If default mode is low, the viewer might be watching but they won't remember it and they won't care.

This mapping is used by the LLM across all three tabs: Analysis (for suggestions), Hooks (for generating improved openings), and Script (for rewriting drop-off sections).

**LLM API choice:** To be determined. Candidates include Claude API (Anthropic), OpenAI API, or Kimi K2.5 API. The choice will be made during development based on output quality for this specific interpretation task.

**Analysis tab output structure:**

The LLM should return a structured response containing:

- Overall assessment (2–3 sentences summarizing the video's neural performance).
- Per-network score interpretation (what each score means for this specific video).
- Drop-off analysis (timestamp-referenced explanations of each significant drop-off, which networks dropped, and why that matters).
- Improvement suggestions (specific, actionable recommendations tied to timestamps and network data, using the network-to-fix mapping).
- Strength highlights (what's working well and why, tied to spike data).

**Hooks tab LLM behavior:**

- Input: the first 3–5 seconds of neural timeline data, the existing hook (transcribed from the video's opening), the full analysis context, and the user's niche.
- Output: multiple improved hook options. Each hook preserves what's neurally strong in the opening and rewrites what's weak, targeting the specific networks that underperformed.
- The LLM should explain briefly why each hook option targets specific neural improvements.

**Script tab LLM behavior:**

- Input: the user's selected and edited hook from Tab 2, the full neural timeline data with all drop-offs, the existing video transcript, and the user's niche.
- Output: an improved version of the full script. The improved script keeps the core content and structure but surgically fixes the sections corresponding to neural drop-offs. Changes are annotated with which network each fix targets and what drop-off it addresses.
- The output should be displayed alongside the original transcript so the user can see what changed and why.

#### Stage 7 — Results Output (Analysis Tab Display)

**Purpose:** Present the complete analysis to the user in a clear, scannable format, including a real-time 3D brain visualization synced to video playback.

**Requirements:**

- Display the composite overall score prominently.
- Display individual scores for all five networks with labels: visual, auditory, language, motion, default mode.
- Display the 3D brain visualization (see dedicated section below).
- Display the second-by-second timeline as a multi-line chart (one line per network) with spike and drop-off zones visually highlighted.
- Display the LLM's improvement suggestions, organized by timestamp, with the relevant network data visible alongside each suggestion.
- Include a single **"Generate hooks"** button that enters the improvement funnel (navigates to Tab 2).
- Include a **"Re-upload improved version"** action that initiates the version comparison flow (stays on Tab 1).

#### Stage 8 — Version Comparison (Re-Upload and Compare)

**Purpose:** Allow the creator to re-upload an improved version of the same video and see a direct comparison of neural performance between versions.

**Requirements:**

- Accept a re-uploaded video (same validation rules as Stage 2).
- Run the new video through the full pipeline (Stages 3–6).
- Display v1 and v2 results side by side:
  - Overall score comparison (v1 score → v2 score, with delta).
  - Per-network score comparison (five network scores, each showing v1 → v2 with delta).
  - Timeline overlay: v1 and v2 activation curves on the same timeline, with drop-off zones from v1 highlighted so the user can see whether those specific weak points improved.
  - LLM comparison commentary: the LLM receives both v1 and v2 data and generates a comparison analysis — did the drop-offs improve? Did the suggestions work? Are there new issues introduced in v2?
- Support only pairwise comparison: current version vs. previous version. No multi-version library or historical database.
- Each re-upload replaces the "previous version" slot. The system holds exactly two versions at a time: current and previous.

---

## 3D Brain Visualization

### Overview

The Analysis tab includes an interactive 3D brain model that visualizes predicted cortical activation in real-time as the uploaded video plays. This replicates the visualization approach used by TRIBE v2's own plotting tools (PyVista and Nilearn backends) but rendered in the browser and synced to video playback.

The brain visualization is not a simplified diagram with five labeled zones. It is the actual fsaverage5 cortical surface mesh — the same mesh TRIBE v2 predicts onto — with all ~20,484 vertices colored by their predicted activation intensity at each second of the video.

### How It Works

TRIBE v2's output is a matrix of shape `(T, 20484)` — one activation value per cortical vertex per second. The 3D brain visualization maps this data directly onto the fsaverage5 cortical surface:

- The fsaverage5 mesh is a standardized brain surface template from FreeSurfer containing ~20,484 vertices organized into triangular faces that form the shape of the cortical surface (the outer layer of the brain with all its folds and grooves).
- At each second of video playback, the visualization reads that second's row from the `(T, 20484)` prediction matrix and assigns a color to each of the 20,484 vertices based on the activation value at that vertex.
- High activation vertices glow hot (warm colors — reds, oranges, yellows). Low activation vertices stay cool (blues, grays). The color scale matches TRIBE v2's own plotting conventions.
- As the video plays forward second by second, the brain updates in real-time — the color heatmap shifts across the cortical surface, showing which brain regions are firing and how intensely at each moment.

### Sync with Video Playback

- The 3D brain visualization and the uploaded video player are synced to the same timeline. When the video is at second 14, the brain shows the predicted activation at second 14.
- Play, pause, scrub, and seek controls on the video player update the brain visualization in lockstep.
- The user can watch their video and simultaneously see the predicted brain response — seeing exactly which cortical regions light up during their hook, which regions dim during a weak section, and how the activation pattern shifts across the full duration.

### Display Requirements

- The brain model is interactive: the user can rotate, zoom, and pan the 3D view to inspect activation from different angles (lateral, medial, dorsal, ventral views).
- Both hemispheres are displayed (left and right cortical surfaces).
- The color scale (mapping activation values to colors) is displayed as a legend alongside the brain, so the user can read approximate intensity values.
- The current timestamp is displayed and updates as the video plays.

### Technical Implementation

- The fsaverage5 mesh geometry (vertex positions, triangle faces) is a static asset loaded once. It is a standard FreeSurfer template available via Nilearn or directly from FreeSurfer datasets.
- The activation data (the `(T, 20484)` matrix from TRIBE v2 inference) is loaded and indexed by the current playback timestamp.
- The backend pre-computes and stores the full prediction matrix after TRIBE v2 inference. The frontend requests or receives the per-second activation data and updates vertex colors on the mesh accordingly.
- For browser-based rendering, the cortical mesh can be rendered using a WebGL-based 3D library (such as Three.js) that loads the fsaverage5 mesh as a geometry and dynamically updates vertex colors from the activation data at each timestep.
- The mesh rendering approach mirrors TRIBE v2's own plotting module, which uses PyVista (VTK-based 3D visualization) and Nilearn (neuroimaging surface plots) to render heatmaps on the fsaverage5 surface. The browser implementation achieves the same visual result using WebGL instead of VTK.

### Visualization in Version Comparison

During version comparison (Stage 8), the 3D brain visualization supports side-by-side display:

- v1 brain and v2 brain are shown next to each other, synced to the same timestamp.
- The user can play both simultaneously and visually compare the cortical activation patterns — seeing at a glance whether the improved video triggers stronger or broader neural responses at each moment.

---

## Complete User Flow

```
Onboarding (once)
    ↓
ANALYSIS TAB
    Upload video
    → TRIBE v2 processes on local GPU
    → Raw output: (T, 20484) cortical activation matrix
    → ICA aggregation → (T, 5) network signals
    → Baseline scoring → 5 network scores + composite
    → Timeline analysis → spikes and drop-offs
    → LLM interprets → scores, drop-off analysis, suggestions
    → Results displayed:
       - 3D brain visualization synced to video playback
       - Network scores + composite score
       - Timeline chart with spikes/drop-offs
       - LLM suggestions
    ↓
    User clicks "Generate hooks"
    ↓
HOOKS TAB
    → LLM generates multiple improved hooks based on neural data
    → User selects one hook
    → User edits the selected hook (optional)
    → User clicks "Generate script"
    ↓
SCRIPT TAB
    → LLM generates improved script based on:
       - The selected/edited hook
       - Full neural timeline drop-off data
       - Original video transcript
    → Improved script shown alongside original with annotated changes
    → User edits the script (optional)
    → User takes the script, re-shoots the video
    ↓
ANALYSIS TAB (return)
    → User re-uploads improved video
    → Pipeline reruns
    → v1 vs v2 comparison displayed (including side-by-side 3D brains)
    → Iterate until neural engagement is maximized
```

---

## Infrastructure Requirements

### Hardware

- Local machine with GPU (user's own hardware).
- TRIBE v2 GPU requirements: sufficient VRAM to run the TribeModel inference. Exact VRAM depends on video length; for 90-second videos, expect moderate GPU memory usage given the model processes at 1 Hz with three frozen encoders (V-JEPA2, Wav2Vec-BERT, LLaMA 3.2-3B).

### Software Dependencies

- Python >= 3.11
- tribev2 package (installed from GitHub: `pip install -e .` from the `facebookresearch/tribev2` repo)
- tribev2 plotting extras for brain mesh data: `pip install -e ".[plotting]"` (nibabel, nilearn, pyvista, matplotlib, scipy)
- PyTorch >= 2.5.1, < 2.7
- torchvision >= 0.20, < 0.22
- HuggingFace account with accepted Meta LLaMA 3.2 license (required for the text encoder)
- HuggingFace token set as environment variable (`HF_TOKEN`)
- LLM API key (provider TBD)
- Frontend 3D rendering: WebGL-capable browser, Three.js or equivalent library for rendering the fsaverage5 cortical mesh

### Tech Stack

To be determined. The backend must be Python (TRIBE v2 is Python-native). Frontend framework and architecture decisions will be made after the PRD is finalized, ensuring the stack is chosen to fit the requirements rather than the other way around.

---

## Scoring System

### Per-Network Scores

- Each of the five ICA-derived networks receives a score on a 0–100 scale.
- 50 represents baseline activation (equivalent to neutral/low-engagement content from calibration).
- Scores above 50 indicate stronger-than-baseline neural engagement for that network.
- Scores below 50 indicate weaker-than-baseline engagement.

### Composite Score

- Weighted average of the five network scores.
- Default weights: 20% each (equal weighting).
- Niche-adjusted weights can be configured during onboarding. Example presets:
  - Comedy: auditory 25%, language 25%, visual 20%, default mode 20%, motion 10%.
  - Education: language 30%, default mode 25%, visual 20%, auditory 15%, motion 10%.
  - Fitness/dance: motion 30%, visual 25%, auditory 25%, default mode 10%, language 10%.
- Custom weight adjustment should be available to the user.

### Drop-Off Thresholds

- A drop-off is flagged when any network's activation falls below 0.5 standard deviations below the video's own mean for that network, sustained for 2+ consecutive seconds.
- A spike is flagged when any network's activation exceeds 1.5 standard deviations above the video's own mean for that network.
- These thresholds are initial values and should be tunable during development based on real output testing.

---

## Open Questions

1. **Baseline calibration videos:** Which specific neutral clips should be used for baseline establishment? Criteria: visually bland, no narrative, minimal audio, no emotional content. Need to source or create 3–5 standardized baseline clips.
2. **ICA network mapping:** The ICA decomposition of TRIBE v2's final layer needs to be implemented and validated. The five networks (visual, auditory, language, motion, default mode) were identified in Meta's research, but the vertex-to-network mapping must be extracted from the model or reproduced via ICA on the model weights.
3. **LLM API selection:** Claude, OpenAI, or Kimi K2.5. Decision deferred to development phase based on interpretation quality testing.
4. **Scoring normalization:** The exact mapping from raw activation multipliers to the 0–100 scale needs calibration with real TRIBE v2 output data. The current approach (50 = baseline) is directional.
5. **Tech stack:** Backend is Python (non-negotiable for TRIBE v2). Frontend framework, database, and deployment architecture TBD.
6. **Processing time:** TRIBE v2 inference time per video on consumer GPUs needs benchmarking. This affects UX decisions around loading states and progress indicators.
7. **Future funnel tabs:** The tab-based funnel is designed to be extensible. Additional tabs beyond Hooks and Script may be added later. All future tabs follow the same interaction pattern: AI generates → user selects → user edits → user proceeds.
8. **Brain mesh delivery:** The fsaverage5 mesh (~20,484 vertices, ~40,000 faces) needs to be exported from FreeSurfer/Nilearn format into a web-friendly 3D format (such as glTF, OBJ, or raw vertex/face arrays for Three.js). This is a one-time asset conversion.
9. **Activation data streaming:** For smooth playback sync, determine whether the full `(T, 20484)` matrix is sent to the frontend upfront or streamed per-second. For a 90-second video, the full matrix is ~1.8M float values — likely small enough to send in full as JSON or a binary buffer.

---

## License and Legal

- TRIBE v2 is licensed under CC-BY-NC 4.0 (Creative Commons Attribution-NonCommercial). This tool is for personal, non-commercial use only, which complies with the license terms.
- LLaMA 3.2-3B (used as TRIBE v2's text encoder) requires separate license acceptance through Meta's HuggingFace page.
- The fsaverage5 cortical mesh is a FreeSurfer standard template, freely available for research and non-commercial use.
- No user video data is transmitted externally for TRIBE v2 processing (runs locally). LLM API calls will transmit neural activation data (not raw video) to the selected LLM provider.
