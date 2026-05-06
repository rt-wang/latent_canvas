# Design: Geometry-Driven Live Visual Rendering Tool

## 1. Project Overview

This project is a browser-native creative coding environment where users can transform live video or webcam input through a hybrid workflow:

- the user manually chooses which computer vision structures to extract
- the app immediately shows the source video with those geometry mappings overlaid
- an LLM interprets the vibe and styles those structures

Instead of forcing the user to only type prompts or only tune low-level parameters, the system splits control into two layers:

- analysis control: choose detectors such as Canny edges, contour extraction, `createFastLineDetector()`, motion masks, and depth-like layers
- style control: use prompts like "make it feel like a memory decaying" or "make the silhouettes feel sacred and slow" to set color, contrast, glow, density, softness, and chaoticness

The goal is to make an AI-native creative coding tool where:

- the human decides what geometry the system pays attention to
- the human can inspect that geometry before asking AI to style it
- the LLM acts as an art director for how that geometry should feel
- the rendering engine remains deterministic, inspectable, and editable

---

## 2. Core Idea

The system separates meaning, structure, and execution.

The LLM does not directly generate pixels, and it should not be solely responsible for choosing every analysis primitive. Instead, the pipeline looks like this:

```txt
manual analysis choices           abstract user prompt
        |                                  |
        v                                  v
   AnalysisConfig                    LLM art director
        |                                  |
        v                                  v
  OpenCV.js worker                    StyleConfig
        |                                  |
        +------------> GeometryFrame <-----+
                         + signals
                               |
                               v
                      config interpolation
                               |
                               v
                        live visual renderer
                               |
                               v
                         output visuals/audio
```

The renderer should understand structured geometry and style parameters. The LLM provides the atmospheric mapping from language to style, while OpenCV provides the structural substrate. Geometry should be visible in a neutral preview state even before the first prompt.

---

## 3. Goals

### Primary Goals

- Enable live webcam or video-based visual transformation.
- Let users manually choose the active computer vision detectors.
- Let users preview geometry mappings before any AI styling is applied.
- Let users control style through abstract natural-language prompts.
- Keep the visual engine modular, inspectable, and configurable.
- Support live performance-style interaction.
- Allow prompt refinement during playback without resetting analysis.
- Expose geometry layers so users can see what the CV system is extracting.

### Secondary Goals

- Map computer vision signals to audio using Tone.js.
- Support saving and remixing prompt-generated style states.
- Allow users to manually tweak both analysis and style settings.
- Support multiple geometry layers, presets, and transitions.
- Eventually support timeline-based editing for video/music composition.

---

## 4. Non-Goals

For the MVP, this project will not focus on:

- Full professional video editing.
- High-accuracy semantic scene understanding.
- Production-grade monocular depth estimation.
- Full node-based visual programming.
- Multi-user collaboration.
- Exporting long rendered videos.
- Training custom vision models.
- Giving the LLM direct access to arbitrary code execution.

The MVP should prioritize a smooth live interaction loop over feature completeness.

---

## 5. Core Stack

### Frontend

- React or vanilla TypeScript
- HTML `<video>` for webcam/video playback
- HTML `<canvas>` for frame capture and 2D effects
- WebGL or Three.js for more advanced shader-based rendering
- Zustand or another lightweight store for UI state and interpolated config

### Computer Vision

- OpenCV.js running in-browser via WebAssembly
- Prefer a worker-based analysis pipeline
- Prefer a custom OpenCV.js build if `createFastLineDetector()` or other contrib APIs are required
- Frame analysis from a hidden low-resolution canvas
- Possible features:
  - Canny edge detection
  - Contour detection
  - Fast line detection
  - Frame differencing
  - Motion intensity
  - Motion masks
  - Brightness maps
  - Optical-flow-like approximations
  - Segmentation approximation through thresholding
  - Pseudo-depth estimation

### Audio

- Tone.js
- Audio reacts to live visual signals:
  - edge density -> hi-hat rate
  - motion intensity -> distortion amount
  - brightness -> synth pitch
  - contour count -> percussion density
  - line density -> rhythmic subdivision
  - scene stability -> reverb/decay

### LLM Layer

- Claude API, OpenAI API, or another model through a lightweight backend proxy
- Converts abstract prompts into structured style JSON
- Must return only valid configuration objects
- Should not generate executable code in the live path
- Should treat analysis selection as manual by default, with optional auto-suggestion later

### Backend

Minimal backend for:

- Securing API keys
- Calling LLM APIs
- Validating model output
- Returning safe JSON to the frontend

Possible options:

- Express
- Next.js API routes
- Cloudflare Workers
- Vercel serverless functions

---

## 6. System Architecture

Two control loops coexist:

- a manual analysis loop for detector choice and geometry extraction
- a prompt loop for AI-directed styling

```txt
┌────────────────────┐      ┌────────────────────┐
│ Analysis Panel     │      │ Prompt Input       │
│ - edges            │      │ - vibe / mood      │
│ - fast lines       │      │ - refinement       │
│ - contours         │      └─────────┬──────────┘
│ - motion mask      │                │
│ - depth            │                v
└─────────┬──────────┘      ┌────────────────────┐
          │                 │ Backend LLM Proxy  │
          v                 │ - prompt template  │
┌────────────────────┐      │ - schema validation│
│ AnalysisConfig     │      └─────────┬──────────┘
└─────────┬──────────┘                │
          │                           v
          v                 ┌────────────────────┐
┌────────────────────┐      │ StyleConfig JSON   │
│ OpenCV.js Worker   │      └─────────┬──────────┘
│ - detector pipeline│                │
└─────────┬──────────┘                │
          v                           │
┌────────────────────┐                │
│ GeometryFrame      │<---------------+
│ + VisualSignals    │
└─────────┬──────────┘
          v
┌────────────────────┐
│ Geometry Preview   │
│ source + neutral   │
│ geometry overlay   │
└─────────┬──────────┘
          v
┌────────────────────┐
│ Interpolator       │
│ + layer composer   │
└─────────┬──────────┘
          v
┌────────────────────┐
│ Live Render Engine │
│ canvas / WebGL     │
└─────────┬──────────┘
          v
┌────────────────────┐
│ Output Visuals     │
│ + optional audio   │
└────────────────────┘
```

The video-processing path runs continuously:

```txt
webcam/video frame
        ->
draw to hidden analysis canvas
        ->
OpenCV.js worker
        ->
extract geometry layers
        ->
derive normalized signals
        ->
render source video + neutral geometry preview
        ->
render styled geometry + source video
        ->
update audio mappings
        ->
next animation frame
```

---

## 7. Live Rendering Pipeline

### Step 1: Capture Input

The user can provide:

- Webcam stream
- Uploaded video
- Sample/default video

The input is rendered into a hidden analysis canvas every animation frame.

```js
ctx.drawImage(video, 0, 0, width, height);
const frame = ctx.getImageData(0, 0, width, height);
```

### Step 2: Analyze Frame

The worker runs the enabled detectors from `AnalysisConfig`.

Examples:

- Canny for edge masks
- `createFastLineDetector()` for line segments
- contour extraction for polygonal regions
- frame differencing for motion amount and motion masks
- pseudo-depth from brightness/blur/vertical heuristics

### Step 3: Build GeometryFrame

The system should extract both reusable geometry layers and normalized signals.

```ts
type VisualSignals = {
  edgeDensity: number;
  motionAmount: number;
  averageBrightness: number;
  lineCount: number;
  contourCount: number;
  depthMean: number;
  sceneStability: number;
};

type GeometryFrame = {
  edgeMask?: Uint8ClampedArray;
  lineSegments?: Float32Array;
  contours?: Float32Array;
  motionMask?: Uint8ClampedArray;
  depthMap?: Uint8ClampedArray;
  signals: VisualSignals;
};
```

These signals are normalized between `0` and `1`. Geometry payloads stay in memory-efficient typed arrays and should not be generated by the LLM.

### Step 4: Preview Geometry

As soon as the user enables a detector, the renderer should show a geometry preview without waiting for a prompt.

This preview should:

- keep the source video visible
- overlay the active geometry in a neutral debug-art style
- help the user decide whether edges, lines, contours, or depth are the right substrate

The neutral preview is not meant to be the final artwork. It is a structural inspection layer that still feels legible and attractive.

### Step 5: Apply Style

Effects are controlled by the current interpolated `StyleConfig`.

Possible styled layers:

- Source video base
- Palette tint
- Saturation/contrast/brightness adjustment
- Edge glow
- Line drawing
- Contour fill/stroke
- Depth haze/fog
- Motion trails
- Noise overlay
- Pixelation
- Wave or displacement distortion
- Particle fields driven by geometry

### Step 6: Update Audio

Tone.js receives signal values from the analysis layer.

Example mappings:

```ts
edgeDensity -> hiHatRate
motionAmount -> distortionAmount
averageBrightness -> synthPitch
contourCount -> percussionDensity
lineCount -> rhythmicSubdivision
```

Audio should be optional for the MVP but architecturally supported.

### Step 7: Loop

```js
function renderLoop() {
  captureFrame();
  const geometry = analyzeFrame(activeAnalysisConfig);
  const style = interpolateStyle(currentStyle, targetStyle);
  const activeStyle =
    renderMode === "geometry-preview" ? defaultPreviewStyle : style;
  updateVisuals(geometry, activeStyle);
  updateAudio(geometry.signals, activeStyle.audioMapping);
  requestAnimationFrame(renderLoop);
}
```

---

## 8. Configuration Schema

The live system should separate manual analysis configuration from AI-generated style configuration.

```ts
type AnalysisConfig = {
  mode: "manual" | "auto-suggest";

  edges: {
    enabled: boolean;
    threshold: number;
    blur: number;
  };

  lines: {
    enabled: boolean;
    detector: "fast";
    threshold: number;
    minLength: number;
  };

  contours: {
    enabled: boolean;
    minArea: number;
    simplify: number;
  };

  motion: {
    enabled: boolean;
    persistence: number;
  };

  depth: {
    enabled: boolean;
    mode: "pseudo" | "ml";
    strength: number;
  };
};

type StyleConfig = {
  palette: {
    tint: [number, number, number];
    saturation: number;
    contrast: number;
    brightness: number;
  };

  motion: {
    trailLength: number;
    blur: number;
  };

  vibe: {
    chaoticness: number;
    softness: number;
    density: number;
  };

  layers: {
    sourceOpacity: number;
    edgeGlow: number;
    lineWeight: number;
    lineGlow: number;
    contourStroke: number;
    contourFill: number;
    depthFog: number;
  };

  distortion: {
    noise: number;
    pixelation: number;
    wave: number;
    displacement: number;
  };

  composition: {
    blendMode: "normal" | "screen" | "multiply" | "difference" | "overlay";
    opacity: number;
    symmetry: number;
    vignette: number;
  };

  audioMapping?: {
    edgeDensity?: string;
    motionAmount?: string;
    brightness?: string;
    contourCount?: string;
    lineCount?: string;
  };
};

type SessionConfig = {
  analysis: AnalysisConfig;
  style: StyleConfig;
  renderMode: "geometry-preview" | "styled";
};
```

All numeric values should be clamped between `0` and `1`, except RGB values, which should be integers between `0` and `255`.

The LLM should normally return `StyleConfig` only. `AnalysisConfig` is primarily user-authored, with optional auto-suggestion later. Before the first successful prompt, the app can remain in `geometry-preview` mode and use a neutral preview style.

---

## 9. Prompt-to-Config Layer

The LLM receives:

1. The user's abstract prompt.
2. The current style config.
3. The active analysis layers and their summaries.
4. Optional current visual signals.
5. A strict instruction to return valid style JSON only.

### Example System Prompt

```txt
You are a visual art direction engine.

Translate abstract mood, vibe, and aesthetic prompts into a structured StyleConfig for a live video renderer.

Do not generate code.
Do not explain your choices.
Return only valid JSON.

The user has already chosen which geometry layers exist.
Do not change the analysis pipeline unless explicitly asked for auto-analysis suggestions.

All numeric values must be between 0 and 1 unless otherwise specified.

Available style controls:

palette:
- tint: RGB array
- saturation: 0 to 1
- contrast: 0 to 1
- brightness: 0 to 1

motion:
- trailLength: 0 to 1
- blur: 0 to 1

vibe:
- chaoticness: 0 to 1
- softness: 0 to 1
- density: 0 to 1

layers:
- sourceOpacity: 0 to 1
- edgeGlow: 0 to 1
- lineWeight: 0 to 1
- lineGlow: 0 to 1
- contourStroke: 0 to 1
- contourFill: 0 to 1
- depthFog: 0 to 1

distortion:
- noise: 0 to 1
- pixelation: 0 to 1
- wave: 0 to 1
- displacement: 0 to 1
```

### Example User Prompt

```txt
make the fast lines feel like sacred circuitry dissolving into fog
```

### Example Model Output

```json
{
  "palette": {
    "tint": [212, 188, 126],
    "saturation": 0.38,
    "contrast": 0.58,
    "brightness": 0.52
  },
  "motion": {
    "trailLength": 0.18,
    "blur": 0.22
  },
  "vibe": {
    "chaoticness": 0.22,
    "softness": 0.72,
    "density": 0.34
  },
  "layers": {
    "sourceOpacity": 0.18,
    "edgeGlow": 0.14,
    "lineWeight": 0.48,
    "lineGlow": 0.66,
    "contourStroke": 0.16,
    "contourFill": 0.08,
    "depthFog": 0.62
  },
  "distortion": {
    "noise": 0.08,
    "pixelation": 0.03,
    "wave": 0.12,
    "displacement": 0.18
  },
  "composition": {
    "blendMode": "screen",
    "opacity": 0.88,
    "symmetry": 0.06,
    "vignette": 0.34
  }
}
```

---

## 10. Config Interpolation

Prompt changes should not instantly snap the visual state. Instead, the current style config should gradually move toward the target style config.

```ts
function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}
```

Example:

```ts
current.layers.lineGlow = lerp(
  current.layers.lineGlow,
  target.layers.lineGlow,
  0.05
);
```

This makes the system feel like live direction instead of preset switching.

Different parameter groups can have different interpolation speeds.

For example:

- Color changes: medium speed
- Motion changes: slow speed
- Noise/chaos changes: fast speed
- Layer opacity changes: medium speed

Analysis changes behave differently:

- detector parameter tweaks can update immediately
- layer enable/disable can snap or crossfade briefly
- detector swaps may require worker re-initialization

---

## 11. Suggested File Structure

```txt
vibe-renderer/
  src/
    app/
      App.tsx
      main.tsx

    components/
      PromptBox.tsx
      VideoInput.tsx
      AnalysisPanel.tsx
      CanvasRenderer.tsx
      ConfigInspector.tsx

    cv/
      opencvLoader.ts
      workerProtocol.ts
      geometry.ts
      analyzers/
        edges.ts
        fastLines.ts
        contours.ts
        motion.ts
        pseudoDepth.ts

    render/
      renderer.ts
      layers/
        source.ts
        edges.ts
        lines.ts
        contours.ts
        depth.ts
        distortion.ts
        composition.ts

    audio/
      toneEngine.ts
      signalMappings.ts

    llm/
      requestConfig.ts
      schema.ts
      validateConfig.ts

    state/
      useConfigStore.ts
      defaultConfig.ts

    utils/
      lerp.ts
      clamp.ts
      color.ts
```

---

## 12. Main Modules

### `PromptBox`

Allows users to type abstract visual prompts.

Responsibilities:

- Submit prompt to backend
- Show loading state
- Allow iterative refinement
- Assume geometry preview is already visible
- Request style changes without blowing away manual analysis choices

### `AnalysisPanel`

Allows users to choose geometry sources manually.

Responsibilities:

- Toggle detectors on/off
- Expose per-detector parameters
- Show which layers are active
- Update the geometry preview immediately as controls change
- Support future auto-analysis suggestions

### `CanvasRenderer`

Owns the live rendering loop.

Responsibilities:

- Capture frames
- Run CV analysis through the worker
- Show source video + geometry preview before the first prompt
- Render source + geometry layers
- Apply style
- Send signals to audio engine

### `OpenCVWorker`

Extracts reusable geometry and normalized signals from video frames.

Responsibilities:

- Run enabled detectors
- Reuse Mats across frames
- Return typed-array geometry payloads
- Avoid per-frame allocations when possible

### `renderer`

Composes all visual effects.

Responsibilities:

- Apply layers in order
- Blend geometry with source video
- Maintain frame history for trails
- Use style values to control output

### `toneEngine`

Optional audio engine.

Responsibilities:

- Initialize Tone.js
- Start/stop audio
- Map visual signals to sound parameters
- Smooth audio transitions

### `requestConfig`

Calls backend LLM route.

Responsibilities:

- Send user prompt, current style config, and active analysis summary
- Receive target style config
- Validate JSON
- Update target style config in global state

---

## 13. MVP Feature Set

### MVP 1: Geometry-Driven Live Prompting

- Webcam or uploaded video input
- Hidden canvas frame capture
- Worker-based OpenCV.js analysis
- Geometry preview mode before prompting
- Manual detector selection:
  - Canny edges
  - contour extraction
  - fast line detection
  - motion mask
  - pseudo-depth
- Visual effects:
  - tint
  - saturation
  - contrast
  - line glow
  - contour fill/stroke
  - edge glow
  - depth haze
  - noise
  - pixelation
  - trails
- Prompt-to-style LLM endpoint
- Smooth style interpolation
- Geometry and style inspector

### MVP 2: Audio Reactivity

- Add Tone.js
- Map visual signals to simple synth/percussion engine
- Allow LLM to configure audio mappings
- Add mute/start audio controls

### MVP 3: Analysis Assist

- Auto-suggest detector combinations from prompts
- Save/load analysis presets
- Crossfade between style states
- Save/load full session states

### MVP 4: Timeline Mode

- Add time-based prompt regions
- Let users drag prompt bars over a video timeline
- Interpolate between style states over time
- Export session timeline as JSON

---

## 14. Visual Vocabulary

The system should define a limited but expressive vocabulary of style controls that can act on the active geometry.

### Mood to Parameter Examples

| Mood | Likely Style Behavior |
|---|---|
| lonely | low saturation, cool tint, sparse lines, soft depth haze |
| anxious | high chaoticness, high noise, hard contrast, jittery contours |
| nostalgic | warm tint, low contrast, long trails, soft contour fill |
| sacred | gold tint, low motion, glowing lines, diffuse fog |
| violent | high contrast, red tint, sharp edges, aggressive displacement |
| underwater | blue tint, soft blur, low contrast, drifting depth haze |
| glitchy | pixelation, noise, difference blend, broken line emphasis |
| dreamlike | soft blur, pastel tint, trails, low-density depth wash |
| mechanical | high edge clarity, cool palette, precise lines, low softness |

This vocabulary should be encoded in the LLM system prompt and also represented in the default presets.

---

## 15. Safety and Reliability

The LLM should not control arbitrary code.

It should only output constrained style JSON.

Validation steps:

1. Parse JSON.
2. Check required fields.
3. Clamp numeric values.
4. Reject unknown blend modes.
5. Fill missing fields with current or default values.
6. Never evaluate strings as code.

Analysis safety steps:

1. Allow only supported detector names.
2. Clamp detector parameters.
3. Fall back gracefully if a detector is unavailable in the current OpenCV build.
4. Never let prompts directly invoke arbitrary worker functions.

If the model returns invalid output, the frontend should keep the current style config and show a small error message.

---

## 16. Performance Considerations

Live rendering can become expensive quickly.

Recommended strategies:

- Process CV at lower resolution than display resolution.
- Run OpenCV in a worker.
- Keep OpenCV Mats and detector instances alive across frames.
- Emit compact geometry payloads instead of full debug images when possible.
- Keep high-frequency geometry data out of Zustand.
- Analyze every second or third frame if needed.
- Use WebGL shaders for heavy pixel effects.
- Keep OpenCV.js operations minimal.
- Avoid running large ML models per frame in the browser for MVP.
- Use pseudo-depth before trying true depth.
- Keep audio mappings lightweight.
- Debounce prompt submissions.

Suggested target:

- 30 FPS minimum on modern laptops
- 60 FPS ideal for simple effects
- CV analysis resolution around 320x180 or 480x270

---

## 17. Depth Strategy

True monocular depth estimation is outside the MVP.

Possible approaches:

### Option 1: Pseudo-Depth

Use brightness, blur, edge falloff, motion separation, and vertical position as artistic depth heuristics.

Pros:

- Fast
- Browser-native
- Good enough for abstract effects
- Works naturally as a render layer

Cons:

- Not semantically accurate

### Option 2: In-Browser ONNX Depth Model

Run a lightweight model with ONNX Runtime Web.

Pros:

- More realistic depth maps
- Still browser-based

Cons:

- Heavier setup
- Performance may suffer
- Becomes a separate ML path, not just an OpenCV function

### Option 3: Server-Side Depth

Send frames to a backend model.

Pros:

- Best quality

Cons:

- Expensive
- Latency issues
- Privacy concerns
- Not ideal for live performance

Recommendation: start with pseudo-depth for the MVP and treat it as an expressive geometry layer rather than a claim of physical accuracy.

---

## 18. Example User Flow

1. User opens the website.
2. User enables webcam or uploads a video.
3. The live video appears on screen.
4. User enables:
   - fast lines
   - contours
   - pseudo-depth
5. The analysis panel shows those layers becoming active.
6. The renderer immediately shows the source video with those geometry overlays in a neutral preview style.
7. User types:

```txt
make the fast lines feel like a ghost trying to remember itself
```

8. Backend sends the prompt, current style config, and active analysis summary to the LLM.
9. LLM returns a target style config.
10. Renderer smoothly transitions from geometry preview into:
   - low saturation
   - pale blue/gray tint
   - soft line glow
   - thin contour presence
   - drifting depth haze
   - subtle distortion
11. User tweaks line threshold manually without changing the vibe.
12. User types:

```txt
make it more violent and digital
```

13. LLM updates only the style config.
14. Renderer transitions into:
    - harsher contrast
    - more pixelation
    - stronger noise
    - sharper line emphasis
    - more chaotic layering

---

## 19. Future Directions

### Timeline-Based Creative Editing

Users could create prompt regions over time, similar to video editing tracks.

```txt
0:00 - 0:20     lonely underwater
0:20 - 0:45     anxious static
0:45 - 1:10     sacred circuitry
```

Each region stores a style config and optionally an analysis preset. The renderer interpolates between them.

### Prompt Branching

Users can generate multiple versions of the same prompt:

- softer
- darker
- more chaotic
- more cinematic
- more minimal

### Remixable Presets

Every prompt-generated style config can become a reusable preset. Detector setups can also become analysis presets.

### AI-Assisted Analysis Suggestions

The system can optionally suggest detector setups such as:

```txt
For this prompt, try fast lines + pseudo-depth and reduce contour fill.
```

This should remain advisory unless the user turns on auto-analysis mode.

### Agentic Creative Assistant

An AI assistant could help build a full visual performance:

- suggest prompt sequences
- create transitions
- map audio to visual signals
- propose geometry presets
- organize scenes into a timeline

---

## 20. Key Design Principle

The user should choose structure.

The user should see that structure before styling.

The LLM should choose atmosphere.

The renderer should stay deterministic.

```txt
geometry becomes structure
language becomes direction
```
