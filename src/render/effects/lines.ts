import type { StyleConfig } from '../../llm/schema';

function layerColor(style: StyleConfig, fallback: [number, number, number]) {
  const [r, g, b] = style.palette.tint;
  const tintDistance = (Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255)) / (255 * 3);
  const [fr, fg, fb] = tintDistance < 0.04 ? fallback : style.palette.tint;
  return `${fr}, ${fg}, ${fb}`;
}

export function drawLines(
  ctx: CanvasRenderingContext2D,
  segments: Float32Array,
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
  style: StyleConfig,
) {
  if (segments.length < 4 || style.layers.lineWeight <= 0.01) return;

  const sx = destW / sourceW;
  const sy = destH / sourceH;
  const color = layerColor(style, [160, 255, 218]);
  const width = Math.max(0.8, 0.8 + style.layers.lineWeight * 5);

  ctx.save();
  ctx.globalCompositeOperation = style.composition.blendMode === 'normal' ? 'screen' : style.composition.blendMode;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (style.layers.lineGlow > 0.02) {
    ctx.strokeStyle = `rgba(${color}, ${Math.min(0.75, 0.18 + style.layers.lineGlow * 0.65)})`;
    ctx.lineWidth = width + style.layers.lineGlow * 7;
    ctx.filter = `blur(${(style.layers.lineGlow * 5).toFixed(2)}px)`;
    ctx.beginPath();
    for (let i = 0; i < segments.length; i += 4) {
      ctx.moveTo(segments[i] * sx, segments[i + 1] * sy);
      ctx.lineTo(segments[i + 2] * sx, segments[i + 3] * sy);
    }
    ctx.stroke();
  }

  ctx.filter = 'none';
  ctx.strokeStyle = `rgba(${color}, ${Math.min(1, 0.35 + style.layers.lineGlow * 0.55)})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i < segments.length; i += 4) {
    const chaos = style.vibe.chaoticness * 1.8;
    const jitterA = chaos > 0.01 ? Math.sin(i * 12.9898) * chaos : 0;
    const jitterB = chaos > 0.01 ? Math.cos(i * 78.233) * chaos : 0;
    ctx.moveTo(segments[i] * sx + jitterA, segments[i + 1] * sy + jitterB);
    ctx.lineTo(segments[i + 2] * sx - jitterB, segments[i + 3] * sy - jitterA);
  }
  ctx.stroke();
  ctx.restore();
}
