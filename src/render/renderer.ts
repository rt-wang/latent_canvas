import type { StyleConfig } from '../llm/schema';
import type { GeometryFrame } from '../cv/geometry';
import { applyPalette, tintOverlay } from './effects/palette';
import { applyTrails } from './effects/trails';
import { drawEdges } from './effects/edges';
import { drawLines } from './effects/lines';
import { drawContours } from './effects/contours';
import { drawDepthMap, drawVignette } from './effects/depth';
import { applyPixelation, applyNoise } from './effects/distortion';

export type RenderInput = {
  video: HTMLVideoElement;
  display: HTMLCanvasElement;
  style: StyleConfig;
  geometry: GeometryFrame | null;
};

export function renderFrame(input: RenderInput) {
  const { video, display, style, geometry } = input;
  const dctx = display.getContext('2d');
  if (!dctx) return;

  const dw = display.width;
  const dh = display.height;

  applyTrails(dctx, dw, dh, style.motion.trailLength);

  dctx.save();
  dctx.globalAlpha = Math.min(1, style.layers.sourceOpacity * style.composition.opacity);
  applyPalette(dctx, style.palette);
  dctx.setTransform(-1, 0, 0, 1, dw, 0);
  const blurPx = style.motion.blur * 12 + style.vibe.softness * 2;
  if (blurPx > 0.1) {
    dctx.filter = `${dctx.filter} blur(${blurPx.toFixed(2)}px)`;
  }
  dctx.drawImage(video, 0, 0, dw, dh);
  dctx.restore();
  dctx.filter = 'none';

  tintOverlay(dctx, dw, dh, style.palette);

  if (geometry?.depthMap) {
    drawDepthMap(dctx, geometry.depthMap, dw, dh, style.layers.depthFog);
  }

  if (geometry?.edgeMask) {
    drawEdges(dctx, geometry.edgeMask, dw, dh, style.layers.edgeGlow);
  }

  if (geometry?.motionMask) {
    drawEdges(dctx, geometry.motionMask, dw, dh, Math.min(0.8, 0.15 + style.vibe.chaoticness * 0.65));
  }

  if (geometry?.contours) {
    drawContours(dctx, geometry.contours, geometry.width, geometry.height, dw, dh, style);
  }

  if (geometry?.lineSegments) {
    drawLines(dctx, geometry.lineSegments, geometry.width, geometry.height, dw, dh, style);
  }

  applyNoise(dctx, dw, dh, Math.min(1, style.distortion.noise + style.vibe.chaoticness * 0.12));
  applyPixelation(dctx, dw, dh, style.distortion.pixelation);
  drawVignette(dctx, dw, dh, style.composition.vignette);
}
