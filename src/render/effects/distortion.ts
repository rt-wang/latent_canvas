// Pixelation: downscale-then-upscale via a scratch canvas with smoothing off.
// Noise: small grayscale ImageData composited with `screen` blend.

let pixScratch: HTMLCanvasElement | null = null;
let noiseCanvas: HTMLCanvasElement | null = null;
let noiseImage: ImageData | null = null;
let noiseSize = 0;

export function applyPixelation(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount < 0.02) return;
  if (!pixScratch) pixScratch = document.createElement('canvas');
  // amount 0 → no change; 1 → ~32px blocks
  const blocks = Math.max(1, Math.round((1 - amount) * Math.min(w, h) / 4 + amount * 0.5));
  const sw = Math.max(2, Math.floor(w / blocks));
  const sh = Math.max(2, Math.floor(h / blocks));
  pixScratch.width = sw;
  pixScratch.height = sh;
  const sc = pixScratch.getContext('2d');
  if (!sc) return;
  sc.imageSmoothingEnabled = false;
  sc.drawImage(ctx.canvas, 0, 0, sw, sh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixScratch, 0, 0, sw, sh, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

export function applyNoise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount < 0.02) return;
  const size = 240;
  if (!noiseCanvas || noiseSize !== size) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = size;
    noiseCanvas.height = size;
    noiseImage = new ImageData(size, size);
    noiseSize = size;
  }
  const data = noiseImage!.data;
  // Re-roll noise each call so it shimmers.
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  const nc = noiseCanvas!.getContext('2d');
  if (!nc) return;
  nc.putImageData(noiseImage!, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.85, amount * 0.85);
  ctx.imageSmoothingEnabled = false;
  // Tile across the full canvas.
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.drawImage(noiseCanvas!, x, y);
    }
  }
  ctx.restore();
}
