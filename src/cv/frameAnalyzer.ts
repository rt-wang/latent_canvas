import type { VisualSignals } from '../state/useConfigStore';

// Real OpenCV analysis path. The analyzer owns reusable Mats so the render
// loop does not allocate OpenCV objects per frame.
export class FrameAnalyzer {
  private cv: any;
  private w: number;
  private h: number;
  private src: any;
  private gray: any;
  private blurred: any;
  private prevGray: any;
  private diff: any;
  private edges: any;
  private blurSize: any;
  private edgeImageData: ImageData;
  private hasPrev = false;

  constructor(cv: any, width = 320, height = 180) {
    this.cv = cv;
    this.w = width;
    this.h = height;

    this.src = new cv.Mat(height, width, cv.CV_8UC4);
    this.gray = new cv.Mat(height, width, cv.CV_8UC1);
    this.blurred = new cv.Mat(height, width, cv.CV_8UC1);
    this.prevGray = new cv.Mat(height, width, cv.CV_8UC1);
    this.diff = new cv.Mat(height, width, cv.CV_8UC1);
    this.edges = new cv.Mat(height, width, cv.CV_8UC1);
    this.blurSize = new cv.Size(3, 3);
    this.edgeImageData = new ImageData(width, height);

    const edgePixels = this.edgeImageData.data;
    for (let i = 0; i < width * height; i += 1) {
      const j = i << 2;
      edgePixels[j] = 255;
      edgePixels[j + 1] = 255;
      edgePixels[j + 2] = 255;
      edgePixels[j + 3] = 0;
    }
  }

  get width() {
    return this.w;
  }

  get height() {
    return this.h;
  }

  analyze(rgba: ImageData, edgeThreshold01: number): { signals: VisualSignals; edges: ImageData } {
    const cv = this.cv;
    const total = this.w * this.h;
    const edgePixels = this.edgeImageData.data;

    this.src.data.set(rgba.data);
    cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);

    const brightness = cv.mean(this.gray)[0] / 255;
    let motion = 0;
    if (this.hasPrev) {
      cv.absdiff(this.gray, this.prevGray, this.diff);
      motion = cv.mean(this.diff)[0] / 255;
    }

    cv.GaussianBlur(this.gray, this.blurred, this.blurSize, 0, 0, cv.BORDER_DEFAULT);

    const low = 24 + edgeThreshold01 * 96;
    const high = Math.max(low * 2, low + 48);
    cv.Canny(this.blurred, this.edges, low, high, 3, false);

    const edgeData = this.edges.data;
    for (let i = 0; i < total; i += 1) {
      edgePixels[(i << 2) + 3] = edgeData[i];
    }

    const signals: VisualSignals = {
      edgeDensity: cv.countNonZero(this.edges) / total,
      motionAmount: motion,
      averageBrightness: brightness,
    };

    this.gray.copyTo(this.prevGray);
    this.hasPrev = true;

    return { signals, edges: this.edgeImageData };
  }

  destroy() {
    this.src.delete();
    this.gray.delete();
    this.blurred.delete();
    this.prevGray.delete();
    this.diff.delete();
    this.edges.delete();
    this.blurSize.delete();
  }
}
