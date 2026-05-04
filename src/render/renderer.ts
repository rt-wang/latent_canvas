import type { VibeConfig } from '../llm/schema';
import { applyPalette, tintOverlay } from './effects/palette';
import { applyTrails } from './effects/trails';
import { drawEdges } from './effects/edges';
import { applyPixelation, applyNoise } from './effects/distortion';

export type RenderInput = {
  video: HTMLVideoElement;
  display: HTMLCanvasElement;
  config: VibeConfig;
  edges: ImageData | null;
};

export function renderFrame(input: RenderInput) {
  const { video, display, config, edges } = input;
  const dctx = display.getContext('2d');
  if (!dctx) return;

  // Mirror the webcam (selfie-style) so motion feels natural.
  const dw = display.width;
  const dh = display.height;

  // 1. display: trails fade
  applyTrails(dctx, dw, dh, config.motion.trailLength);

  // 2. video draw with palette filter
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

  // 3. tint overlay (multiply)
  tintOverlay(dctx, dw, dh, config.palette);

  // 4. edges (screen blend)
  if (config.edges.enabled && edges) {
    drawEdges(dctx, edges, dw, dh, config.edges.glow);
  }

  // 5. noise
  applyNoise(dctx, dw, dh, config.distortion.noise);

  // 6. pixelation (last so it acts on the composite)
  applyPixelation(dctx, dw, dh, config.distortion.pixelation);
}
