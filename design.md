# Design: Vibe-Driven Live Visual Rendering Tool

## 1. Project Overview

This project is a browser-native creative coding environment where users can transform live video or webcam input using abstract natural-language prompts.

Instead of asking users to manually tune technical parameters like edge thresholds, motion blur, particle density, or color curves, the system lets them type prompts such as:

> make it feel like a memory decaying  
> make the scene lonely and underwater  
> turn this into anxious static  
> make the silhouettes feel sacred and slow

An LLM translates these abstract prompts into structured visual configuration JSON. The frontend applies that configuration to a live rendering pipeline using webcam/video input, computer vision analysis, and real-time canvas/WebGL effects.

The goal is to make an AI-native creative coding tool where the LLM acts as an art director and the rendering engine remains deterministic, inspectable, and editable.

---

## 2. Core Idea

The system separates meaning from execution.

The LLM does not directly generate pixels. Instead, it translates vibes into renderer parameters.

```txt
abstract user prompt
        ↓
LLM interprets mood / atmosphere / visual direction
        ↓
structured JSON config
        ↓
config interpolator
        ↓
live visual renderer
        ↓
webcam/video transformed in real time
```

For example:

```txt
"make it feel like a memory decaying"
```

might become:

```json
{
  "palette": {
    "tint": [180, 150, 110],
    "saturation": 0.35,
    "contrast": 0.45
  },
  "motion": {
    "speed": 0.25,
    "trailLength": 0.9,
    "blur": 0.75
  },
  "edges": {
    "enabled": true,
    "threshold": 0.25,
    "glow": 0.25
  },
  "particles": {
    "enabled": true,
    "density": 0.3,
    "drift": 0.2,
    "jitter": 0.5
  },
  "distortion": {
    "wave": 0.15,
    "noise": 0.65,
    "pixelation": 0.35
  }
}
```

The renderer only needs to understand parameters. The LLM provides the mapping from abstract language to those parameters.

---

## 3. Goals

### Primary Goals

- Enable live webcam or video-based visual transformation.
- Let users control visuals through abstract natural-language prompts.
- Keep the system fully browser-native when possible.
- Make the visual engine modular, inspectable, and configurable.
- Support live performance-style interaction.
- Allow prompt refinement during playback.

### Secondary Goals

- Map computer vision signals to audio using Tone.js.
- Support saving and remixing prompt-generated visual states.
- Allow users to manually tweak the generated configuration.
- Support multiple visual layers, presets, and transitions.
- Eventually support timeline-based editing for video/music composition.

---

## 4. Non-Goals

For the MVP, this project will not focus on:

- Full professional video editing.
- High-accuracy depth estimation.
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
- Zustand or another lightweight store for config/state management

### Computer Vision

- OpenCV.js running in-browser via WebAssembly
- Frame analysis from hidden canvas
- Possible features:
  - Edge detection
  - Contour detection
  - Frame differencing
  - Motion intensity
  - Brightness maps
  - Optical-flow-like approximations
  - Segmentation approximation through thresholding

### Audio

- Tone.js
- Audio reacts to live visual signals:
  - edge density → hi-hat rate
  - motion intensity → distortion amount
  - brightness → synth pitch
  - contour size → bass rhythm
  - scene stability → reverb/decay

### LLM Layer

- Claude API, OpenAI API, or another model through a lightweight backend proxy
- Converts abstract prompts into structured JSON
- Must return only valid configuration objects
- Should not generate executable code in the live path

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

```txt
┌────────────────────┐
│ User Prompt Input  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Backend LLM Proxy  │
│ - prompt template  │
│ - schema validation│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Target Config JSON │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Config Interpolator│
│ smooth transitions │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Live Render Engine │
│ canvas / WebGL     │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Output Visuals     │
└────────────────────┘
```

The video-processing path runs continuously:

```txt
webcam/video frame
        ↓
draw to hidden canvas
        ↓
OpenCV.js analysis
        ↓
extract signals
        ↓
render visual effects
        ↓
update audio mappings
        ↓
next animation frame
```

---

## 7. Live Rendering Pipeline

### Step 1: Capture Input

The user can provide:

- Webcam stream
- Uploaded video
- Sample/default video

The input is rendered into a hidden canvas every animation frame.

```js
ctx.drawImage(video, 0, 0, width, height);
const frame = ctx.getImageData(0, 0, width, height);
```

### Step 2: Analyze Frame

The system extracts useful live signals.

Possible signals:

```ts
type VisualSignals = {
  edgeDensity: number;
  motionAmount: number;
  averageBrightness: number;
  averageSaturation: number;
  contourCount: number;
  dominantRegionSize: number;
};
```

These signals are normalized between `0` and `1`.

### Step 3: Apply Visual Effects

Effects are controlled by the current interpolated config.

Possible modules:

- Palette tint
- Saturation adjustment
- Contrast adjustment
- Edge glow
- Motion trails
- Frame delay/echo
- Noise overlay
- Pixelation
- Wave distortion
- Particle fields
- Silhouette overlays

### Step 4: Update Audio

Tone.js receives signal values from the video analysis.

Example mappings:

```ts
edgeDensity -> hiHatRate
motionAmount -> distortionAmount
averageBrightness -> synthPitch
contourCount -> percussionDensity
```

Audio should be optional for the MVP but architecturally supported.

### Step 5: Loop

```js
function renderLoop() {
  captureFrame();
  const signals = analyzeFrame();
  updateVisuals(signals, currentConfig);
  updateAudio(signals, currentConfig.audioMapping);
  requestAnimationFrame(renderLoop);
}
```

---

## 8. Configuration Schema

The LLM should only output JSON that matches this schema.

```ts
type VibeConfig = {
  palette: {
    tint: [number, number, number];
    saturation: number;
    contrast: number;
    brightness: number;
  };

  motion: {
    speed: number;
    trailLength: number;
    blur: number;
    echo: number;
  };

  edges: {
    enabled: boolean;
    threshold: number;
    glow: number;
    thickness: number;
  };

  particles: {
    enabled: boolean;
    density: number;
    drift: number;
    jitter: number;
    size: number;
  };

  distortion: {
    wave: number;
    noise: number;
    pixelation: number;
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
  };
};
```

All numeric values should be clamped between `0` and `1`, except RGB values, which should be integers between `0` and `255`.

---

## 9. Prompt-to-Config Layer

The LLM receives:

1. The user's abstract prompt.
2. The current visual config.
3. The available renderer controls.
4. Optional current visual signals.
5. A strict instruction to return valid JSON only.

### Example System Prompt

```txt
You are a visual art direction engine.

Translate abstract mood, vibe, and aesthetic prompts into a structured JSON configuration for a live video renderer.

Do not generate code.
Do not explain your choices.
Return only valid JSON.

All numeric values must be between 0 and 1 unless otherwise specified.

Available controls:

palette:
- tint: RGB array
- saturation: 0 to 1
- contrast: 0 to 1
- brightness: 0 to 1

motion:
- speed: 0 to 1
- trailLength: 0 to 1
- blur: 0 to 1
- echo: 0 to 1

edges:
- enabled: boolean
- threshold: 0 to 1
- glow: 0 to 1
- thickness: 0 to 1

particles:
- enabled: boolean
- density: 0 to 1
- drift: 0 to 1
- jitter: 0 to 1
- size: 0 to 1

distortion:
- wave: 0 to 1
- noise: 0 to 1
- pixelation: 0 to 1
- displacement: 0 to 1

composition:
- blendMode: normal, screen, multiply, difference, overlay
- opacity: 0 to 1
- symmetry: 0 to 1
- vignette: 0 to 1
```

### Example User Prompt

```txt
make it feel like the room is dissolving into anxious static
```

### Example Model Output

```json
{
  "palette": {
    "tint": [120, 130, 145],
    "saturation": 0.25,
    "contrast": 0.75,
    "brightness": 0.45
  },
  "motion": {
    "speed": 0.8,
    "trailLength": 0.35,
    "blur": 0.25,
    "echo": 0.4
  },
  "edges": {
    "enabled": true,
    "threshold": 0.65,
    "glow": 0.35,
    "thickness": 0.3
  },
  "particles": {
    "enabled": true,
    "density": 0.8,
    "drift": 0.2,
    "jitter": 0.9,
    "size": 0.25
  },
  "distortion": {
    "wave": 0.2,
    "noise": 0.85,
    "pixelation": 0.45,
    "displacement": 0.55
  },
  "composition": {
    "blendMode": "difference",
    "opacity": 0.85,
    "symmetry": 0.1,
    "vignette": 0.6
  }
}
```

---

## 10. Config Interpolation

Prompt changes should not instantly snap the visual state. Instead, the current config should gradually move toward the target config.

```ts
function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}
```

Example:

```ts
current.motion.blur = lerp(
  current.motion.blur,
  target.motion.blur,
  0.05
);
```

This makes the system feel like live direction instead of preset switching.

Different parameters can have different interpolation speeds.

For example:

- Color changes: medium speed
- Motion changes: slow speed
- Noise changes: fast speed
- Particle density: medium-slow speed

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
      ControlPanel.tsx
      CanvasRenderer.tsx
      ConfigInspector.tsx

    cv/
      opencvLoader.ts
      frameAnalyzer.ts
      edgeDetection.ts
      motionDetection.ts
      signalNormalizer.ts

    render/
      renderer.ts
      effects/
        palette.ts
        edges.ts
        trails.ts
        particles.ts
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
- Optionally show prompt history

### `VideoInput`

Handles webcam or video upload.

Responsibilities:

- Request webcam permission
- Load video files
- Expose video element reference to renderer
- Handle play/pause

### `CanvasRenderer`

Owns the live rendering loop.

Responsibilities:

- Capture frames
- Run CV analysis
- Apply effects
- Render final output
- Send signals to audio engine

### `frameAnalyzer`

Extracts normalized signals from video frames.

Responsibilities:

- Edge density
- Motion amount
- Brightness
- Saturation
- Contour count

### `renderer`

Composes all visual effects.

Responsibilities:

- Apply effects in order
- Blend layers
- Maintain frame history for trails/echo
- Use config values to control output

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

- Send user prompt and current config
- Receive target config
- Validate JSON
- Update target config in global state

---

## 13. MVP Feature Set

### MVP 1: Live Visual Prompting

- Webcam input
- Hidden canvas frame capture
- Basic OpenCV.js edge detection
- Motion detection using frame differencing
- Visual effects:
  - tint
  - saturation
  - edge glow
  - noise
  - pixelation
  - trails
- Prompt-to-config LLM endpoint
- Smooth config interpolation
- JSON config inspector

### MVP 2: Audio Reactivity

- Add Tone.js
- Map visual signals to simple synth/percussion engine
- Allow LLM to configure audio mappings
- Add mute/start audio controls

### MVP 3: Performance Mode

- Preset prompt buttons
- Prompt history
- Crossfade between prompts
- Save/load vibe states
- Fullscreen visual output

### MVP 4: Timeline Mode

- Add time-based prompt regions
- Let users drag prompt bars over a video timeline
- Interpolate between vibe states over time
- Export configuration timeline as JSON

---

## 14. Visual Vocabulary

The system should define a limited but expressive vocabulary of visual controls.

### Mood to Parameter Examples

| Mood | Likely Parameters |
|---|---|
| lonely | low saturation, cool tint, slow motion, high blur |
| anxious | high jitter, high noise, sharp contrast, fast motion |
| nostalgic | warm tint, low contrast, long trails, soft blur |
| sacred | symmetry, glow, slow motion, low noise |
| violent | high contrast, red tint, sharp edges, aggressive displacement |
| underwater | blue tint, wave distortion, slow drift, blur |
| glitchy | pixelation, noise, displacement, difference blend |
| dreamlike | soft blur, pastel tint, trails, low edge threshold |
| mechanical | high edge clarity, low saturation, rigid motion, repeated patterns |

This vocabulary should be encoded in the LLM system prompt and also represented in the default presets.

---

## 15. Safety and Reliability

The LLM should not control arbitrary code.

It should only output constrained JSON.

Validation steps:

1. Parse JSON.
2. Check required fields.
3. Clamp numeric values.
4. Reject unknown blend modes.
5. Fill missing fields with current or default values.
6. Never evaluate strings as code.

If the model returns invalid output, the frontend should keep the current config and show a small error message.

---

## 16. Performance Considerations

Live rendering can become expensive quickly.

Recommended strategies:

- Process CV at lower resolution than display resolution.
- Analyze every second or third frame if needed.
- Use WebGL shaders for heavy pixel effects.
- Keep OpenCV.js operations minimal.
- Avoid running large ML models per frame in the browser for MVP.
- Use frame differencing before trying optical flow.
- Keep audio mappings lightweight.
- Debounce prompt submissions.

Suggested target:

- 30 FPS minimum on modern laptops
- 60 FPS ideal for simple effects
- CV analysis resolution around 320x180 or 480x270

---

## 17. Depth Estimation Strategy

True monocular depth estimation is outside the MVP.

Possible approaches:

### Option 1: Fake Depth

Use brightness, blur, size, and vertical position as artistic depth heuristics.

Pros:

- Fast
- Browser-native
- Good enough for abstract effects

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

### Option 3: Server-Side Depth

Send frames to a backend model.

Pros:

- Best quality

Cons:

- Expensive
- Latency issues
- Privacy concerns
- Not ideal for live performance

Recommendation: start with fake depth for the MVP.

---

## 18. Example User Flow

1. User opens the website.
2. User enables webcam.
3. The live video appears on screen.
4. User types:

```txt
make this feel like a ghost trying to remember itself
```

5. Backend sends prompt to LLM.
6. LLM returns target config.
7. Renderer smoothly transitions into:
   - low saturation
   - pale blue/gray tint
   - slow trails
   - soft edge glow
   - drifting particles
   - subtle distortion
8. User types:

```txt
make it more violent and digital
```

9. LLM updates only the necessary config values.
10. Renderer transitions into:
    - harsher contrast
    - more pixelation
    - stronger noise
    - sharper edges
    - more jitter

---

## 19. Future Directions

### Timeline-Based Creative Editing

Users could create prompt regions over time, similar to video editing tracks.

```txt
0:00 - 0:20     lonely underwater
0:20 - 0:45     anxious static
0:45 - 1:10     sacred silhouettes
```

Each region stores a vibe config. The renderer interpolates between them.

### Prompt Branching

Users can generate multiple versions of the same prompt:

- softer
- darker
- more chaotic
- more cinematic
- more minimal

### Remixable Presets

Every prompt-generated config can become a reusable preset.

### AI-Assisted Explanation

The system can explain why certain parameters were chosen:

```txt
I lowered saturation and increased trails to create a slower, more nostalgic feeling.
```

This should be optional and separate from the live rendering loop.

### Agentic Creative Assistant

An AI assistant could help build a full visual performance:

- suggest prompt sequences
- create transitions
- map audio to visual signals
- propose variations
- organize scenes into a timeline

---

## 20. Key Design Principle

The LLM should be expressive but bounded.

The renderer should be powerful but deterministic.

The user should feel like they are directing a living visual instrument through language.

```txt
language becomes direction
direction becomes configuration
configuration becomes live image
live image becomes performance
```
