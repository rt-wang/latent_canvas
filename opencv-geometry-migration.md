# OpenCV Geometry Migration Plan

## Purpose

This document translates the geometry-driven design vision into concrete changes for the current codebase in this repository.

The target workflow is:

1. user manually selects analysis functions such as edges, fast lines, contours, motion masks, and depth-like layers
2. the OpenCV worker extracts geometry from the video
3. the renderer immediately shows the source video with neutral geometry overlays
4. the LLM interprets vibe prompts into styling for those active layers
5. the renderer draws geometry with color, contrast, chaoticness, glow, and distortion

---

## Current Baseline

The current app is Phase-1 shaped:

- [public/opencv-worker.js](/Users/k0an/Code/uchi/creative/latent_canvas/public/opencv-worker.js) returns only:
  - `signals`
  - one `alphaBuffer` for edges
- [src/render/renderer.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/render/renderer.ts) renders:
  - source video
  - palette
  - edge overlay
  - noise
  - pixelation
- [src/llm/schema.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/llm/schema.ts) defines a single `VibeConfig`
- [server/index.ts](/Users/k0an/Code/uchi/creative/latent_canvas/server/index.ts) treats the LLM as both vibe translator and indirect effect chooser
- [src/components/ConfigInspector.tsx](/Users/k0an/Code/uchi/creative/latent_canvas/src/components/ConfigInspector.tsx) exposes palette, motion, edges, and distortion controls
- [src/state/useConfigStore.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/state/useConfigStore.ts) stores only one current/target config pair plus three scalar signals

That is a good base, but it cannot yet support manual detector selection plus geometry-aware styling.

---

## Target Architecture

We want to move to:

```txt
video frame
  ->
analysis worker
  ->
GeometryFrame + VisualSignals
  ->
renderer layers
  ->
styled output
```

with two independent control surfaces:

- `AnalysisConfig`: manual CV choices
- `StyleConfig`: AI-directed vibe and appearance

and two visual states:

- `geometry-preview`: source video plus neutral geometry overlay before prompting
- `styled`: AI-directed appearance after prompting

---

## Data Model Changes

### 1. Split config into analysis and style

Replace the single `VibeConfig` shape with:

```ts
type AnalysisConfig = {
  mode: "manual" | "auto-suggest";
  edges: { enabled: boolean; threshold: number; blur: number };
  lines: { enabled: boolean; detector: "fast"; threshold: number; minLength: number };
  contours: { enabled: boolean; minArea: number; simplify: number };
  motion: { enabled: boolean; persistence: number };
  depth: { enabled: boolean; mode: "pseudo" | "ml"; strength: number };
};

type StyleConfig = {
  palette: { tint: [number, number, number]; saturation: number; contrast: number; brightness: number };
  motion: { trailLength: number; blur: number };
  vibe: { chaoticness: number; softness: number; density: number };
  layers: {
    sourceOpacity: number;
    edgeGlow: number;
    lineWeight: number;
    lineGlow: number;
    contourStroke: number;
    contourFill: number;
    depthFog: number;
  };
  distortion: { noise: number; pixelation: number; wave: number; displacement: number };
  composition: { blendMode: "normal" | "screen" | "multiply" | "difference" | "overlay"; opacity: number; symmetry: number; vignette: number };
};
```

### 2. Add a worker payload type

Introduce a geometry contract, either in a new file such as `src/cv/geometry.ts` or alongside the worker protocol:

```ts
type GeometryFrame = {
  signals: VisualSignals;
  edgeMask?: Uint8ClampedArray;
  lineSegments?: Float32Array;
  contours?: Float32Array;
  motionMask?: Uint8ClampedArray;
  depthMap?: Uint8ClampedArray;
};
```

### 3. Keep geometry out of Zustand

Do not put full geometry payloads into [src/state/useConfigStore.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/state/useConfigStore.ts). Keep them in refs inside the render loop or adjacent worker state. Zustand should only hold:

- current and target style config
- current analysis config
- render mode or prompt-state metadata
- scalar signals
- UI state

---

## File-by-File Plan

## A. OpenCV runtime and worker

### [public/opencv-worker.js](/Users/k0an/Code/uchi/creative/latent_canvas/public/opencv-worker.js)

Change this file first. It is the narrowest bottleneck and the cleanest place to centralize detector logic.

Required changes:

- change the `analyze` message to accept `analysisConfig`
- return a `GeometryFrame` instead of only `alphaBuffer`
- keep reusable Mats and detector instances alive across frames
- support these detectors incrementally:
  - edges
  - contours
  - fast lines
  - motion mask
  - pseudo-depth

Recommended message shape:

```ts
{ type: "analyze", id, rgbaBuffer, analysisConfig }
```

Recommended result shape:

```ts
{ type: "result", id, geometry }
```

### [public/opencv.js](/Users/k0an/Code/uchi/creative/latent_canvas/public/opencv.js)

Before building UI around `createFastLineDetector()`, validate that the current bundle exposes it. If it does not, swap to a custom OpenCV.js build that includes the needed contrib module, or temporarily fall back to a different line detector.

This is the biggest dependency risk in the migration.

### [src/cv/frameAnalyzer.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/cv/frameAnalyzer.ts)

This file currently mirrors the old edge-only analysis path but is not driving the live renderer. Decide one of two paths:

- delete it after the worker becomes canonical
- or refactor it into shared detector utilities that the worker owns conceptually

Do not keep two competing analyzer implementations long-term.

### [src/cv/opencvLoader.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/cv/opencvLoader.ts)

Keep this loader if you still want a main-thread fallback, but the live path should treat the worker as authoritative.

---

## B. Renderer and draw pipeline

### [src/render/renderer.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/render/renderer.ts)

Refactor the renderer to consume:

- `styleConfig`
- `geometry`
- source video

instead of:

- `VibeConfig`
- `edges`

New responsibility split:

1. draw source video with configurable opacity and palette treatment
2. support a neutral geometry-preview pass before any AI styling
3. draw geometry layers:
   - edges
   - lines
   - contours
   - depth
4. apply distortion and composition passes

The renderer should no longer assume the edge mask is the main CV output.

### [src/render/effects/edges.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/render/effects/edges.ts)

Keep this file, but treat it as one layer among several.

Add sibling modules over time:

- `lines.ts`
- `contours.ts`
- `depth.ts`

They can stay under `effects/` initially, but `layers/` may be a better name once geometry drawing becomes central.

### [src/render/effects/distortion.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/render/effects/distortion.ts)

Extend distortion so AI style can express "chaoticness" through several downstream controls:

- noise
- pixelation
- displacement
- line jitter or contour instability later

---

## C. State and interpolation

### [src/state/defaultConfig.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/state/defaultConfig.ts)

Split this file into defaults for:

- `defaultAnalysisConfig`
- `defaultStyleConfig`
- `defaultPreviewStyleConfig`

### [src/state/useConfigStore.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/state/useConfigStore.ts)

Replace `current` and `target` with at least:

- `currentStyle`
- `targetStyle`
- `analysis`
- `renderMode`

Keep `signals`, `history`, `fps`, and status, but update history items to store style config and optionally a snapshot of analysis config.

Recommended additions:

- `setAnalysis`
- `setTargetStyle`
- `setCurrentStyle`
- `setRenderMode`

### [src/utils/lerp.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/utils/lerp.ts)

Rename and refactor `lerpConfig` so it interpolates style only.

Detector parameters usually do not need the same interpolation treatment. They can update directly or use a short crossfade at the renderer layer.

---

## D. UI changes

### [src/components/ConfigInspector.tsx](/Users/k0an/Code/uchi/creative/latent_canvas/src/components/ConfigInspector.tsx)

This is the fastest place to introduce the new workflow.

Short-term:

- expand this panel into two sections:
  - `ANALYSIS`
  - `STYLE`

Analysis controls should include:

- edge toggle + threshold
- line toggle + threshold
- contour toggle + min area
- motion mask toggle
- depth toggle + mode

When any analysis layer is enabled, the panel should make it obvious that the user is now looking at a live geometry preview, not a fully styled output.

Style controls should include:

- palette
- line glow/weight
- contour fill/stroke
- depth fog
- distortion
- vibe controls such as chaoticness and softness

Long-term:

- break analysis controls into a dedicated `AnalysisPanel.tsx`

### [src/components/CanvasRenderer.tsx](/Users/k0an/Code/uchi/creative/latent_canvas/src/components/CanvasRenderer.tsx)

This component needs the biggest integration change after the worker.

Required updates:

- send `analysisConfig` to the worker with each analysis request
- receive `geometry`
- keep the latest geometry payload in refs, not state
- call the renderer with `geometry + preview style` before prompting
- call the renderer with `styleConfig + geometry` after prompting
- extend the HUD to show new signals such as:
  - line count
  - contour count
  - depth mean

### [src/components/PromptBox.tsx](/Users/k0an/Code/uchi/creative/latent_canvas/src/components/PromptBox.tsx)

Change the semantics of prompting:

- prompt affects style only by default
- prompt is optional until geometry preview looks right
- prompt submission should send:
  - `prompt`
  - current style config
  - analysis summary
  - optional signals

The copy should also reflect the new interaction model. For example, the placeholder can hint that the user is styling active geometry, not asking the AI to choose all rendering logic.

Suggested copy direction:

- before prompt: "Choose geometry, then describe how it should feel"
- after prompt: "Refine the current style"

### [src/app/App.tsx](/Users/k0an/Code/uchi/creative/latent_canvas/src/app/App.tsx)

Adjust layout once analysis controls grow. The current left-column prompt/history plus right-column inspector layout is workable, but analysis controls may deserve their own panel if the inspector gets crowded.

---

## E. Schema and server changes

### [src/llm/schema.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/llm/schema.ts)

Replace the single `VibeConfigSchema` with:

- `AnalysisConfigSchema`
- `StyleConfigSchema`
- optional `SessionConfigSchema`

For the API response path, validate `StyleConfigSchema` by default.

### [src/llm/requestConfig.ts](/Users/k0an/Code/uchi/creative/latent_canvas/src/llm/requestConfig.ts)

Update request payload shape from:

```ts
{ prompt, currentConfig }
```

to something like:

```ts
{
  prompt,
  currentStyle,
  analysis,
  signals
}
```

### [server/index.ts](/Users/k0an/Code/uchi/creative/latent_canvas/server/index.ts)

Retarget the backend from "generate full renderer config" to "generate style config for active geometry."

Key changes:

- rewrite system prompt around active layers and geometry-aware styling
- validate style config instead of the old phase-1 schema
- update fallback heuristics so they return:
  - palette
  - motion
  - layer styling
  - distortion
  - vibe-level controls

Do not let the prompt directly request arbitrary OpenCV APIs. If you later add auto-analysis suggestions, return them in a separate field or endpoint.

---

## Recommended Rollout Order

### Phase 1: Contracts first

1. Split schema into analysis and style.
2. Update store defaults and actions.
3. Change prompt API payloads and validation.

### Phase 2: Worker and geometry

1. Update the worker protocol.
2. Keep edges working through the new geometry contract.
3. Add contours.
4. Add fast lines.
5. Add motion mask and pseudo-depth.

### Phase 3: Renderer layering

1. Refactor the renderer to accept geometry.
2. Add a neutral geometry-preview mode.
3. Add line drawing.
4. Add contour drawing.
5. Add depth haze/fog.
6. Keep distortion last.

### Phase 4: UI

1. Expand the inspector into analysis + style sections.
2. Add detector-specific controls.
3. Update prompt language and suggestions.
4. Extend the live HUD.

### Phase 5: Tuning and cleanup

1. Remove or repurpose the duplicate analyzer in `src/cv/frameAnalyzer.ts`.
2. Optimize allocations in the worker and renderer.
3. Revisit the layout once the workflow feels real.

---

## Risks and Decisions

### 1. OpenCV build support

`createFastLineDetector()` may not exist in the currently bundled `public/opencv.js`. Confirm this before building UI that depends on it.

### 2. Depth expectations

"Depth map" can mean two different things:

- pseudo-depth used as an artistic layer
- true monocular depth from an ML model

The current migration should target pseudo-depth first.

### 3. Store pressure

Do not push large geometry payloads into Zustand. That will create unnecessary React churn and frame drops.

### 4. Scope creep

Keep the first migration focused on:

- geometry extraction
- geometry-aware drawing
- style prompting

Audio and timeline changes can follow once the geometry path is stable.

---

## Definition of Done

This migration is successful when the app can do all of the following:

1. User enables at least two geometry detectors manually.
2. The worker returns structured geometry, not just an edge alpha mask.
3. The renderer shows source video plus neutral geometry preview before any AI prompt.
4. The renderer can draw at least edges, lines, and one more non-edge layer.
5. Prompt submission changes style without overwriting manual detector choices.
6. The inspector exposes both analysis and style controls.
7. The system remains interactive at a usable frame rate.
