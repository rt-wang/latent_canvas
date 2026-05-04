# Phase 1 Implementation Guide — MVP 1: Live Visual Prompting

## Scope
Get a single user to type an abstract prompt and see their webcam feed transformed in real time. No audio, no presets, no timeline.

**Definition of done:** webcam → hidden canvas → CV signals → effects controlled by interpolated config that the LLM produces from prompts.

⏺ The objective of Phase 1 is to prove the core loop end-to-end: type an abstract prompt → see your webcam
  transformed in real time.

  Concretely, by the end of Phase 1 you should have:

  - Webcam feed running through a hidden analysis canvas at 320×180.
  - A handful of working effects (tint, saturation, trails, edge glow, noise, pixelation) applied to the visible
   canvas.
  - A backend endpoint that turns prompts into validated VibeConfig JSON.
  - Smooth lerp between current and target config so transitions feel directed, not snapped.

  Everything else from design.md — audio, presets, timeline, particles, WebGL — is deferred. Phase 1 is the
  smallest thing that demonstrates "language becomes live image."

---

## Step 0 — Project Setup

- Vite + React + TypeScript (`npm create vite@latest`).
- Add Zustand, `opencv.ts` or `@techstark/opencv-js` (WASM build), Zod for schema validation.
- Backend: a single Vercel/Next.js API route (`/api/config`) — keeps the Anthropic key server-side.
- `.env.local`: `ANTHROPIC_API_KEY=...`.

Scaffold the file tree from §11 of design.md but only create the files Phase 1 needs:

```
src/
  app/{App.tsx, main.tsx}
  components/{PromptBox, VideoInput, CanvasRenderer, ConfigInspector}.tsx
  cv/{opencvLoader, frameAnalyzer}.ts
  render/{renderer.ts, effects/{palette,edges,trails,distortion}.ts}
  llm/{requestConfig, schema, validateConfig}.ts
  state/{useConfigStore, defaultConfig}.ts
  utils/{lerp, clamp}.ts
api/config.ts
```

---

## Step 1 — State + Schema

1. `llm/schema.ts`: Zod schema mirroring `VibeConfig` from §8, but Phase 1 only needs `palette`, `motion.{trailLength,blur}`, `edges`, `distortion.{noise,pixelation}`. Clamp numbers to [0,1], RGB to [0,255].
2. `state/defaultConfig.ts`: a neutral config (no tint, full saturation, edges off, no noise).
3. `state/useConfigStore.ts`: Zustand store holding `current: VibeConfig`, `target: VibeConfig`, plus `setTarget(cfg)`. The render loop reads `current`; the LLM writes `target`.

---

## Step 2 — Video Input (`VideoInput.tsx`)

- Request `getUserMedia({ video: true })`, attach to a hidden `<video autoplay muted playsinline>`.
- Lift the `videoRef` up via context or a prop so `CanvasRenderer` can read frames.
- Show a fallback button if permission is denied; defer file upload to Phase 2.

---

## Step 3 — Hidden Frame Capture + CV (`cv/`)

- `opencvLoader.ts`: load OpenCV.js once, expose a `whenReady()` promise. Show a "loading" state until it resolves.
- Maintain two offscreen canvases:
  - **analysis canvas** at 320×180 (per §16)
  - **display canvas** at the visible size
- `frameAnalyzer.ts`: every frame, draw video to the analysis canvas, then compute:
  - **edgeDensity** — Canny edges, count nonzero / total pixels.
  - **motionAmount** — abs-diff between current and previous grayscale frame, mean / 255.
  - **averageBrightness** — mean of grayscale.
- Return all three normalized to [0,1]. This is the `VisualSignals` type from §7.

---

## Step 4 — Renderer (`render/renderer.ts`)

Single `requestAnimationFrame` loop:

```
captureFrame() → analyze() → interpolate(current, target) → drawEffects() → loop
```

Phase 1 effects (2D canvas only, no WebGL yet):

- **palette** (`effects/palette.ts`): draw video frame, then a tinted rect with `globalCompositeOperation = 'multiply'` for tint; apply CSS-style `filter: saturate() contrast() brightness()` on the canvas context.
- **trails** (`effects/trails.ts`): before drawing the new frame, fill the display canvas with `rgba(0,0,0, 1 - trailLength)` instead of clearing — gives motion blur / echo.
- **edges** (`effects/edges.ts`): if `edges.enabled`, run Canny on the analysis canvas, upscale, draw with `globalCompositeOperation = 'screen'` and an alpha = `glow`.
- **distortion** (`effects/distortion.ts`): for `pixelation`, downscale then upscale with `imageSmoothingEnabled = false`. For `noise`, generate a small random ImageData and composite with `screen` at low alpha.

Order matters: trails fill → video draw → palette → edges → noise → pixelation.

---

## Step 5 — Interpolation (`utils/lerp.ts`)

In the render loop, before drawing, walk every numeric leaf of `current` and lerp toward `target`. Per §10 use different rates per group:

```ts
palette:    0.05
motion:     0.02
edges:      0.05
distortion: 0.08
```

RGB tints lerp per channel, then round. Booleans (e.g., `edges.enabled`) snap once `target` differs and the alpha-controlled value is non-trivial.

---

## Step 6 — LLM Endpoint (`api/config.ts`)

Server route:

1. Accept `{ prompt, currentConfig }`.
2. Call Anthropic `claude-opus-4-7` (or `claude-sonnet-4-6` for cost) with the system prompt from §9. Use `tool_use` with a single tool whose `input_schema` *is* the Zod schema converted to JSON Schema — guarantees structured output.
3. Validate the tool input against Zod again on the server. On failure, return HTTP 422 with `{ error }`.
4. Add prompt caching on the system prompt (it's static and large — meaningful savings).
5. Return the validated config as JSON.

**Use the `claude-api` skill** when you write this route — it'll wire up caching and the SDK correctly.

---

## Step 7 — `PromptBox.tsx`

- Controlled `<textarea>` + Submit button (also Cmd+Enter).
- On submit: POST `/api/config`, debounce 300ms, show a small spinner.
- On success: `setTarget(returnedConfig)` — interpolation handles the rest.
- On 422: keep current config, show the error text under the box (per §15).

---

## Step 8 — `ConfigInspector.tsx`

- Subscribe to `current` from the store.
- Render as collapsible `<pre>{JSON.stringify(current, null, 2)}</pre>`.
- Useful for debugging the lerp; throw it behind a "Show JSON" toggle.

---

## Step 9 — Wire-up in `App.tsx`

```
<App>
  <VideoInput />            // hidden video element
  <CanvasRenderer />        // visible canvas, owns the RAF loop
  <PromptBox />
  <ConfigInspector />
</App>
```

`CanvasRenderer` mounts after OpenCV is ready and after the video has dimensions; otherwise display a loading state.

---

## Step 10 — Manual Test Pass

Per CLAUDE.md guidance for UI work — actually open the browser and try:

1. Webcam permission prompt → allow.
2. Type "make it feel like a memory decaying" → expect warm tint, low saturation, long trails, soft noise. Should *fade in*, not snap.
3. Type "anxious static" → high noise, contrast, pixelation; transition is visible.
4. Open the JSON inspector and confirm values lerp toward the target over ~1–2s.
5. Refresh, deny webcam → fallback message renders.
6. Submit invalid input (e.g., a single emoji) → endpoint either returns reasonable JSON or 422 with no crash.

---

## Out-of-Scope (Phase 2+ reminders)

Tone.js, presets, prompt history, fullscreen, WebGL shaders, particles, contour signals, file upload, save/load — all wait. If a Phase 1 effect needs a shader for performance, port it later; canvas 2D is enough at 320×180 analysis res.

---

## Risks to Watch

- **OpenCV.js bundle size** (~8MB) — load async, show a splash. Consider hosting it yourself for caching control.
- **getUserMedia on Safari** — needs HTTPS or `localhost`; `playsinline` is required.
- **Canvas filter perf** — `ctx.filter` is slow on Firefox; if FPS drops below 30 measure it before optimizing.
- **LLM latency** — 1–3s round-trip is fine because interpolation hides it; don't try to stream tokens for Phase 1.
