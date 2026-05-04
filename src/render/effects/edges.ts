// Composite the edge ImageData (white-on-transparent at analysis res) onto
// the display canvas via a scratch canvas, with `screen` blend and glow alpha.
let scratch: HTMLCanvasElement | null = null;
function getScratch(w: number, h: number) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  return scratch;
}

export function drawEdges(
  ctx: CanvasRenderingContext2D,
  edges: ImageData,
  destW: number,
  destH: number,
  glow: number,
) {
  if (glow <= 0.01) return;
  const s = getScratch(edges.width, edges.height);
  const sc = s.getContext('2d');
  if (!sc) return;
  sc.putImageData(edges, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // First pass: crisp contours.
  ctx.globalAlpha = Math.min(1, 0.3 + glow * 0.85);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s, 0, 0, destW, destH);
  // Second pass: soft bloom so the contours read as an effect instead of aliasing.
  ctx.globalAlpha = Math.min(0.9, glow * 0.75);
  ctx.imageSmoothingEnabled = true;
  ctx.filter = `blur(${(1 + glow * 8).toFixed(2)}px)`;
  ctx.drawImage(s, 0, 0, destW, destH);
  ctx.restore();
}
