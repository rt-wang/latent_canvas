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
  ctx.globalAlpha = Math.min(1, glow);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s, 0, 0, destW, destH);
  ctx.restore();
}
