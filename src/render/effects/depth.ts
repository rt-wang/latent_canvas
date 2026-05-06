let depthScratch: HTMLCanvasElement | null = null;

function getScratch(w: number, h: number) {
  if (!depthScratch) depthScratch = document.createElement('canvas');
  if (depthScratch.width !== w || depthScratch.height !== h) {
    depthScratch.width = w;
    depthScratch.height = h;
  }
  return depthScratch;
}

export function drawDepthMap(
  ctx: CanvasRenderingContext2D,
  depth: ImageData,
  destW: number,
  destH: number,
  amount: number,
) {
  if (amount <= 0.01) return;
  const scratch = getScratch(depth.width, depth.height);
  const sc = scratch.getContext('2d');
  if (!sc) return;
  sc.putImageData(depth, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.55, amount * 0.55);
  ctx.filter = `blur(${(amount * 8).toFixed(2)}px)`;
  ctx.drawImage(scratch, 0, 0, destW, destH);
  ctx.filter = 'none';
  ctx.globalAlpha = Math.min(0.25, amount * 0.25);
  ctx.drawImage(scratch, 0, 0, destW, destH);
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0.01) return;
  const gradient = ctx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.68);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.72, amount * 0.72)})`);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
