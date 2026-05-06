import type { StyleConfig } from '../../llm/schema';

// Apply ctx.filter for sat/contrast/brightness, then a multiply tint.
// Map [0,1] to a useful CSS filter range — 0.5 is identity.
export function applyPalette(ctx: CanvasRenderingContext2D, p: StyleConfig['palette']) {
  const sat   = (p.saturation * 2).toFixed(3);   // 0..2
  const con   = (0.4 + p.contrast * 1.6).toFixed(3); // 0.4..2.0
  const bri   = (0.3 + p.brightness * 1.4).toFixed(3); // 0.3..1.7
  ctx.filter = `saturate(${sat}) contrast(${con}) brightness(${bri})`;
}

export function tintOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, p: StyleConfig['palette']) {
  // Distance from neutral white drives the tint strength.
  const [r, g, b] = p.tint;
  const dist = (Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255)) / (3 * 255);
  if (dist < 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = Math.min(1, dist * 1.4);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
