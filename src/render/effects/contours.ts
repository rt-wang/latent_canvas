import type { StyleConfig } from '../../llm/schema';

function pathContours(
  ctx: CanvasRenderingContext2D,
  contours: Float32Array,
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
) {
  const sx = destW / sourceW;
  const sy = destH / sourceH;
  let open = false;

  ctx.beginPath();
  for (let i = 0; i < contours.length; i += 2) {
    const x = contours[i];
    const y = contours[i + 1];
    if (Number.isNaN(x) || Number.isNaN(y)) {
      if (open) ctx.closePath();
      open = false;
      continue;
    }
    if (!open) {
      ctx.moveTo(x * sx, y * sy);
      open = true;
    } else {
      ctx.lineTo(x * sx, y * sy);
    }
  }
  if (open) ctx.closePath();
}

export function drawContours(
  ctx: CanvasRenderingContext2D,
  contours: Float32Array,
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
  style: StyleConfig,
) {
  if (contours.length < 4) return;
  const [r, g, b] = style.palette.tint;
  const color = Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255) < 24 ? '200, 245, 225' : `${r}, ${g}, ${b}`;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  if (style.layers.contourFill > 0.01) {
    ctx.fillStyle = `rgba(${color}, ${Math.min(0.38, style.layers.contourFill * 0.38)})`;
    pathContours(ctx, contours, sourceW, sourceH, destW, destH);
    ctx.fill();
  }

  if (style.layers.contourStroke > 0.01) {
    ctx.strokeStyle = `rgba(${color}, ${Math.min(0.9, 0.2 + style.layers.contourStroke * 0.7)})`;
    ctx.lineWidth = Math.max(0.75, 0.8 + style.layers.contourStroke * 3);
    ctx.filter = style.vibe.softness > 0.45 ? `blur(${((style.vibe.softness - 0.45) * 4).toFixed(2)}px)` : 'none';
    pathContours(ctx, contours, sourceW, sourceH, destW, destH);
    ctx.stroke();
  }

  ctx.restore();
}
