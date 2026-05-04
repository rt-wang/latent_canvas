const TIMEOUT_MS = 60000;

let cvModule = null;
let cvReadyPromise = null;
let analyzer = null;

function isReady(cv) {
  return !!(cv && typeof cv.Mat === 'function' && cv.CV_8UC1 !== undefined);
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function waitForCv() {
  if (cvModule) return Promise.resolve(cvModule);
  if (cvReadyPromise) return cvReadyPromise;

  cvReadyPromise = new Promise((resolve, reject) => {
    const scope = self;
    const seed = scope.cv && typeof scope.cv === 'object' ? scope.cv : {};
    scope.cv = seed;

    if (isReady(scope.cv)) {
      cvModule = scope.cv;
      resolve(cvModule);
      return;
    }

    let settled = false;
    const timeoutId = self.setTimeout(() => {
      fail(new Error(`OpenCV.js did not initialize within ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    const finish = (maybeCv) => {
      const cv = maybeCv ?? scope.cv;
      if (settled || !isReady(cv)) return;
      settled = true;
      self.clearTimeout(timeoutId);
      cvModule = cv;
      resolve(cv);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      self.clearTimeout(timeoutId);
      cvReadyPromise = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const previousInit =
      typeof seed.onRuntimeInitialized === 'function' ? seed.onRuntimeInitialized : null;
    seed.onRuntimeInitialized = () => {
      previousInit?.();
      finish(scope.cv);
    };

    try {
      self.importScripts('/opencv.js');
    } catch (error) {
      fail(error);
      return;
    }

    if (isReady(scope.cv)) {
      finish(scope.cv);
      return;
    }

    Promise.resolve(scope.cv).then(finish).catch(fail);
  });

  return cvReadyPromise;
}

class OpenCvAnalyzer {
  constructor(cv, width, height) {
    this.cv = cv;
    this.width = width;
    this.height = height;
    this.total = width * height;

    this.src = new cv.Mat(height, width, cv.CV_8UC4);
    this.gray = new cv.Mat(height, width, cv.CV_8UC1);
    this.blurred = new cv.Mat(height, width, cv.CV_8UC1);
    this.prevGray = new cv.Mat(height, width, cv.CV_8UC1);
    this.diff = new cv.Mat(height, width, cv.CV_8UC1);
    this.edges = new cv.Mat(height, width, cv.CV_8UC1);
    this.blurSize = new cv.Size(3, 3);
    this.hasPrev = false;
  }

  analyze(rgbaBuffer, edgeThreshold01) {
    const cv = this.cv;
    const rgba = new Uint8ClampedArray(rgbaBuffer);
    this.src.data.set(rgba);
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

    const alpha = new Uint8ClampedArray(this.total);
    alpha.set(this.edges.data);

    const signals = {
      edgeDensity: cv.countNonZero(this.edges) / this.total,
      motionAmount: motion,
      averageBrightness: brightness,
    };

    this.gray.copyTo(this.prevGray);
    this.hasPrev = true;

    return { signals, alphaBuffer: alpha.buffer };
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

self.onmessage = async (event) => {
  const message = event.data ?? {};

  if (message.type === 'init') {
    try {
      const cv = await waitForCv();
      analyzer?.destroy();
      analyzer = new OpenCvAnalyzer(cv, message.width, message.height);
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: getErrorMessage(error) });
    }
    return;
  }

  if (message.type === 'analyze') {
    if (!analyzer) return;
    try {
      const result = analyzer.analyze(message.rgbaBuffer, message.edgeThreshold01);
      self.postMessage(
        {
          type: 'result',
          id: message.id,
          signals: result.signals,
          alphaBuffer: result.alphaBuffer,
        },
        [result.alphaBuffer],
      );
    } catch (error) {
      self.postMessage({ type: 'error', message: getErrorMessage(error) });
    }
    return;
  }

  if (message.type === 'dispose') {
    analyzer?.destroy();
    analyzer = null;
    self.close();
  }
};
