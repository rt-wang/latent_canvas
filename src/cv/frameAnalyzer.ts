import type { VisualSignals } from '../state/useConfigStore';

// Analysis works at a tiny resolution (per design.md §16). The instance owns
// reusable Mats so we don't allocate per frame.
export class FrameAnalyzer {
  private cv: any;
  private w: number;
  private h: number;
  private src: any;
  private gray: any;
  private prevGray: any;
  private diff: any;
  private edges: any;
  private hasPrev = false;
  private edgeImageData: ImageData;

  constructor(cv: any, width = 320, height = 180) {
    this.cv = cv;
    this.w = width;
    this.h = height;
    this.src = new cv.Mat(height, width, cv.CV_8UC4);
    this.gray = new cv.Mat(height, width, cv.CV_8UC1);
    this.prevGray = new cv.Mat(height, width, cv.CV_8UC1);
    this.diff = new cv.Mat(height, width, cv.CV_8UC1);
    this.edges = new cv.Mat(height, width, cv.CV_8UC1);
    this.edgeImageData = new ImageData(width, height);
  }

  get width() { return this.w; }
  get height() { return this.h; }

  // Run on a 320×180 RGBA ImageData. Returns normalized signals plus an
  // edge ImageData (white edges on transparent) so the renderer can draw it.
  analyze(rgba: ImageData, edgeThreshold01: number): { signals: VisualSignals; edges: ImageData } {
    const cv = this.cv;
    this.src.data.set(rgba.data);
    cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);

    // Brightness — mean of grayscale
    const meanScalar = cv.mean(this.gray);
    const averageBrightness = meanScalar[0] / 255;

    // Motion — mean abs-diff vs previous gray
    let motionAmount = 0;
    if (this.hasPrev) {
      cv.absdiff(this.gray, this.prevGray, this.diff);
      motionAmount = cv.mean(this.diff)[0] / 255;
    }
    this.gray.copyTo(this.prevGray);
    this.hasPrev = true;

    // Edges — Canny. Map [0,1] threshold to [10..200] low, double for high.
    const lo = 10 + edgeThreshold01 * 190;
    const hi = Math.min(255, lo * 2.2);
    cv.Canny(this.gray, this.edges, lo, hi, 3, false);

    const edgeData = this.edgeImageData.data;
    const total = this.w * this.h;
    let nonZero = 0;
    const e = this.edges.data;
    for (let i = 0; i < total; i++) {
      const v = e[i];
      const j = i << 2;
      edgeData[j]     = 255;
      edgeData[j + 1] = 255;
      edgeData[j + 2] = 255;
      edgeData[j + 3] = v; // alpha = edge intensity
      if (v > 0) nonZero++;
    }

    const signals: VisualSignals = {
      edgeDensity: nonZero / total,
      motionAmount,
      averageBrightness,
    };
    return { signals, edges: this.edgeImageData };
  }

  destroy() {
    this.src.delete();
    this.gray.delete();
    this.prevGray.delete();
    this.diff.delete();
    this.edges.delete();
  }
}
