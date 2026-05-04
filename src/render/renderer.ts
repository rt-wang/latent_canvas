import type { VibeConfig } from '../llm/schema';
import { applyPalette, tintOverlay } from './effects/palette';
import { applyTrails } from './effects/trails';
import { drawEdges } from './effects/edges';
import { applyPixelation, applyNoise } from './effects/distortion';

export type RenderInput = {
  video: HTMLVideoElement;
  display: HTMLCanvasElement;
  analysis: HTMLCanvasElement;
  config: VibeConfig;
  edges: ImageData | null;
};

export function renderFrame(input: RenderInput) {
  const { video, display, analysis, config, edges } = input;
  const dctx = display.getContext('2d');
  const actx = analysis.getContext('2d', { willReadFrequently: true });
  if (!dctx || !actx) return;

  // Mirror the webcam (selfie-style) so motion feels natural.
  const dw = display.width;
  const dh = display.height;
  const aw = analysis.width;
  const ah = analysis.height;

  // 1. analysis canvas: mirrored, current video frame (used by the analyzer)
  actx.save();
  actx.setTransform(-1, 0, 0, 1, aw, 0);
  actx.drawImage(video, 0, 0, aw, ah);
  actx.restore();

  // 2. display: trails fade
  applyTrails(dctx, dw, dh, config.motion.trailLength);

  // 3. video draw with palette filter
  dctx.save();
  applyPalette(dctx, config.palette);
  dctx.setTransform(-1, 0, 0, 1, dw, 0);
  // motion blur (CSS filter blur)
  const blurPx = config.motion.blur * 12;
  if (blurPx > 0.1) {
    dctx.filter = `${dctx.filter} blur(${blurPx.toFixed(2)}px)`;
  }
  dctx.drawImage(video, 0, 0, dw, dh);
  dctx.restore();
  dctx.filter = 'none';

  // 4. tint overlay (multiply)
  tintOverlay(dctx, dw, dh, config.palette);

  // 5. edges (screen blend)
  if (config.edges.enabled && edges) {
    drawEdges(dctx, edges, dw, dh, config.edges.glow);
  }

  // 6. noise
  applyNoise(dctx, dw, dh, config.distortion.noise);

  // 7. pixelation (last so it acts on the composite)
  applyPixelation(dctx, dw, dh, config.distortion.pixelation);
}
