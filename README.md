# Latent Canvas — Phase 1

Live webcam → vibe prompt → real-time visual transformation. See `phase1.md` for scope.

## Setup

```sh
npm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY
```

## Run

```sh
npm run dev
```

This boots two processes via `concurrently`:
- **web** — Vite dev server at http://localhost:5173
- **api** — Express server at http://localhost:3001 (proxied via Vite at `/api/*`)

Open http://localhost:5173, choose a local video file, type a vibe (e.g. *"make it feel like a memory decaying"*) and hit Enter.

## Layout

```
src/
  app/App.tsx            Top-level layout: sidebar | prompt+history | canvas | inspector
  components/
    Sidebar.tsx          Dark navigation rail
    PromptBox.tsx        Prompt input + suggestions
    HistoryPanel.tsx     Recent vibes list
    CanvasRenderer.tsx   RAF loop, FPS/signal HUD, the visible canvas
    VideoInput.tsx       Local video upload + hidden <video>
    ConfigInspector.tsx  Accordion controls + JSON / Signals tabs
    HistoryItem.tsx, ui/Button.tsx, ui/Label.tsx
  cv/
    frameAnalyzer.ts     Canvas-based edges + frame-diff motion + brightness at 320×180
  render/
    renderer.ts          Per-frame pipeline (trails → video → palette → edges → noise → pixelation)
    effects/{palette,trails,edges,distortion}.ts
  state/
    useConfigStore.ts    Zustand: current/target config, signals, fps, history
    defaultConfig.ts
  llm/
    schema.ts            Zod + JSON-Schema for the tool-use input
    requestConfig.ts     POST /api/config wrapper
  utils/{lerp,clamp}.ts
  styles/tokens.css      Design tokens (DM Sans + sage olive palette)

server/
  index.ts               Express; POST /api/config calls Anthropic with tool_use
                         + prompt caching on the system message.
```

## Phase 1 controls (per `phase1.md`)

- **palette**: tint (RGB), saturation, contrast, brightness
- **motion**: trailLength, blur
- **edges**: enabled, threshold, glow
- **distortion**: noise, pixelation

Other parts of the `VibeConfig` (particles, composition, audio mappings, etc.) are deferred to later phases.

## Notes

- Local files are loaded with a file picker, so camera permissions are no longer required.
- Frame analysis runs at 320×180 to keep the loop at 30+ FPS on modern laptops.
- Config interpolation: palette/edges lerp at 0.05/frame, motion at 0.02, distortion at 0.08.
