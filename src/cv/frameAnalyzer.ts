import type { VisualSignals } from '../state/useConfigStore';

// Lightweight canvas-based analysis. This avoids OpenCV/WASM entirely while
// still giving us stable edge, motion, and brightness signals at 320×180.
export class FrameAnalyzer {
  private w: number;
  private h: number;
  private currGray: Uint8ClampedArray;
  private prevGray: Uint8ClampedArray;
  private edgeImageData: ImageData;
  private hasPrev = false;

  constructor(width = 320, height = 180) {
    this.w = width;
    this.h = height;
    this.currGray = new Uint8ClampedArray(width * height);
    this.prevGray = new Uint8ClampedArray(width * height);
    this.edgeImageData = new ImageData(width, height);

    const edgeData = this.edgeImageData.data;
    for (let i = 0; i < width * height; i++) {
      const j = i << 2;
      edgeData[j] = 255;
      edgeData[j + 1] = 255;
      edgeData[j + 2] = 255;
      edgeData[j + 3] = 0;
    }
  }

  get width() { return this.w; }
  get height() { return this.h; }

  analyze(rgba: ImageData, edgeThreshold01: number): { signals: VisualSignals; edges: ImageData } {
    const src = rgba.data;
    const total = this.w * this.h;
    const edgeData = this.edgeImageData.data;

    let brightnessSum = 0;
    let motionSum = 0;

    for (let i = 0; i < total; i++) {
      const j = i << 2;
      // Integer luma approximation: 0.299r + 0.587g + 0.114b
      const gray = (src[j] * 77 + src[j + 1] * 150 + src[j + 2] * 29) >> 8;
      this.currGray[i] = gray;
      brightnessSum += gray;
      if (this.hasPrev) {
        motionSum += Math.abs(gray - this.prevGray[i]);
      }
      edgeData[j + 3] = 0;
    }

    const edgeThreshold = 20 + edgeThreshold01 * 120;
    let edgeCount = 0;

    for (let y = 1; y < this.h - 1; y++) {
      const row = y * this.w;
      for (let x = 1; x < this.w - 1; x++) {
        const i = row + x;
        const horizontal = Math.abs(this.currGray[i + 1] - this.currGray[i - 1]);
        const vertical = Math.abs(this.currGray[i + this.w] - this.currGray[i - this.w]);
        const magnitude = horizontal + vertical;
        const alpha = magnitude > edgeThreshold ? Math.min(255, magnitude * 2) : 0;
        edgeData[(i << 2) + 3] = alpha;
        if (alpha > 0) edgeCount++;
      }
    }

    const signals: VisualSignals = {
      edgeDensity: edgeCount / total,
      motionAmount: this.hasPrev ? motionSum / (total * 255) : 0,
      averageBrightness: brightnessSum / (total * 255),
    };

    const swap = this.prevGray;
    this.prevGray = this.currGray;
    this.currGray = swap;
    this.hasPrev = true;

    return { signals, edges: this.edgeImageData };
  }

  destroy() {
    // No external resources to release in the canvas implementation.
  }
}
