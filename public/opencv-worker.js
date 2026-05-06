const TIMEOUT_MS = 60000;

let cvModule = null;
let cvReadyPromise = null;
let analyzer = null;
let initWidth = 0;
let initHeight = 0;

function emitLog(stage, detail) {
  self.postMessage({ type: 'log', stage, detail });
}

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
    emitLog('worker-init', `seeded cv object; hasMat=${isReady(scope.cv)}`);

    if (isReady(scope.cv)) {
      cvModule = scope.cv;
      emitLog('worker-init', 'cv already ready before importScripts');
      resolve(cvModule);
      return;
    }

    let settled = false;
    let lastHeartbeatAt = Date.now();
    let unwrapping = false;
    const timeoutId = self.setTimeout(() => {
      fail(new Error(`OpenCV.js did not initialize within ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    let pollId = null;

    const finish = (maybeCv) => {
      const cv = maybeCv ?? scope.cv;
      if (settled || !isReady(cv)) return;
      settled = true;
      self.clearTimeout(timeoutId);
      if (pollId !== null) self.clearInterval(pollId);
      cvModule = cv;
      emitLog('worker-ready', 'OpenCV runtime initialized');
      resolve(cv);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      self.clearTimeout(timeoutId);
      if (pollId !== null) self.clearInterval(pollId);
      cvReadyPromise = null;
      emitLog('worker-error', getErrorMessage(error));
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const previousInit =
      typeof seed.onRuntimeInitialized === 'function' ? seed.onRuntimeInitialized : null;
    seed.onRuntimeInitialized = () => {
      previousInit?.();
      emitLog('worker-init', 'onRuntimeInitialized fired');
      finish(scope.cv);
    };

    try {
      emitLog('worker-init', 'importScripts(/opencv.js) starting');
      self.importScripts('/opencv.js');
      emitLog('worker-init', 'importScripts(/opencv.js) returned');
    } catch (error) {
      fail(error);
      return;
    }

    if (isReady(scope.cv)) {
      emitLog('worker-init', 'cv ready immediately after importScripts');
      finish(scope.cv);
      return;
    }

    emitLog('worker-init', 'waiting for thenable/runtime callback');

    const tryUnwrap = () => {
      const current = scope.cv;
      const hasThen = current && typeof current.then === 'function';
      if (!hasThen || unwrapping) return;
      unwrapping = true;
      emitLog('worker-init', 'attempting thenable unwrap');
      try {
        current.then((unwrapped) => {
          unwrapping = false;
          if (unwrapped && unwrapped !== scope.cv) {
            scope.cv = unwrapped;
            emitLog('worker-init', 'unwrapped thenable -> cv');
          } else {
            emitLog('worker-init', 'thenable callback returned module');
          }
          finish(unwrapped ?? scope.cv);
        }, (error) => {
          unwrapping = false;
          fail(error);
        });
      } catch (error) {
        unwrapping = false;
        fail(error);
      }
    };

    pollId = self.setInterval(() => {
      if (settled) return;
      const current = scope.cv;
      if (isReady(current)) {
        finish(current);
        return;
      }

      if (Date.now() - lastHeartbeatAt >= 2000) {
        lastHeartbeatAt = Date.now();
        emitLog(
          'worker-init',
          `heartbeat hasThen=${Boolean(current && typeof current.then === 'function')} hasMat=${Boolean(
            current && typeof current.Mat === 'function',
          )}`,
        );
      }

      tryUnwrap();
    }, 100);

    tryUnwrap();
  });

  return cvReadyPromise;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function normalizeAnalysisConfig(input) {
  const cfg = input && typeof input === 'object' ? input : {};
  return {
    edges: {
      enabled: Boolean(cfg.edges?.enabled),
      threshold: clamp01(cfg.edges?.threshold ?? 0.38),
      blur: clamp01(cfg.edges?.blur ?? 0.25),
    },
    lines: {
      enabled: Boolean(cfg.lines?.enabled),
      threshold: clamp01(cfg.lines?.threshold ?? 0.45),
      minLength: clamp01(cfg.lines?.minLength ?? 0.2),
    },
    contours: {
      enabled: Boolean(cfg.contours?.enabled),
      minArea: clamp01(cfg.contours?.minArea ?? 0.18),
      simplify: clamp01(cfg.contours?.simplify ?? 0.28),
    },
    motion: {
      enabled: Boolean(cfg.motion?.enabled),
      persistence: clamp01(cfg.motion?.persistence ?? 0.25),
    },
    depth: {
      enabled: Boolean(cfg.depth?.enabled),
      strength: clamp01(cfg.depth?.strength ?? 0.45),
    },
  };
}

function copyBuffer(mat, total) {
  const out = new Uint8ClampedArray(total);
  out.set(mat.data.subarray(0, total));
  return out.buffer;
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
    this.motionMask = new cv.Mat(height, width, cv.CV_8UC1);
    this.depth = new cv.Mat(height, width, cv.CV_8UC1);
    this.hasPrev = false;
    this.fastLineDetector = null;

    if (typeof cv.createFastLineDetector === 'function') {
      try {
        this.fastLineDetector = cv.createFastLineDetector();
        emitLog('analyze-init', 'using createFastLineDetector for line geometry');
      } catch (error) {
        this.fastLineDetector = null;
        emitLog('analyze-init', `fast line detector unavailable; using HoughLinesP fallback (${getErrorMessage(error)})`);
      }
    } else {
      emitLog('analyze-init', 'createFastLineDetector unavailable; using HoughLinesP fallback');
    }
  }

  blurGray(amount) {
    const cv = this.cv;
    const radius = Math.max(1, Math.round(1 + amount * 3));
    const size = radius * 2 + 1;
    const kernel = new cv.Size(size, size);
    cv.GaussianBlur(this.gray, this.blurred, kernel, 0, 0, cv.BORDER_DEFAULT);
    kernel.delete?.();
  }

  computeEdges(config) {
    const cv = this.cv;
    this.blurGray(config.edges.blur);
    const low = 18 + config.edges.threshold * 118;
    const high = Math.max(low * 2, low + 48);
    cv.Canny(this.blurred, this.edges, low, high, 3, false);
  }

  detectLines(config) {
    const cv = this.cv;
    const segments = [];
    const maxSegments = 420;

    if (this.fastLineDetector && typeof this.fastLineDetector.detect === 'function') {
      const lines = new cv.Mat();
      try {
        this.fastLineDetector.detect(this.gray, lines);
        const data = lines.data32F;
        const count = Math.min(maxSegments, Math.floor(data.length / 4));
        for (let i = 0; i < count; i += 1) {
          const j = i * 4;
          segments.push(data[j], data[j + 1], data[j + 2], data[j + 3]);
        }
        return new Float32Array(segments);
      } catch (error) {
        this.fastLineDetector = null;
        emitLog('analyze-lines', `fast line detector failed; using HoughLinesP fallback (${getErrorMessage(error)})`);
      } finally {
        lines.delete();
      }
    }

    if (typeof cv.HoughLinesP !== 'function') {
      return new Float32Array(segments);
    }

    const lines = new cv.Mat();
    try {
      const threshold = Math.round(10 + config.lines.threshold * 70);
      const minLineLength = Math.round(8 + config.lines.minLength * Math.min(this.width, this.height) * 0.72);
      const maxLineGap = Math.round(2 + config.lines.threshold * 10);
      cv.HoughLinesP(this.edges, lines, 1, Math.PI / 180, threshold, minLineLength, maxLineGap);
      const data = lines.data32S;
      const count = Math.min(maxSegments, Math.floor(data.length / 4));
      for (let i = 0; i < count; i += 1) {
        const j = i * 4;
        segments.push(data[j], data[j + 1], data[j + 2], data[j + 3]);
      }
    } finally {
      lines.delete();
    }

    return new Float32Array(segments);
  }

  detectContours(config) {
    const cv = this.cv;
    const contourSource = this.edges.clone();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const floats = [];
    const maxFloats = 9000;
    let count = 0;

    try {
      cv.findContours(contourSource, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const minArea = 8 + config.contours.minArea * this.total * 0.06;
      for (let i = 0; i < contours.size() && floats.length < maxFloats; i += 1) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour, false);
        if (area < minArea) {
          contour.delete();
          continue;
        }

        const approx = new cv.Mat();
        const epsilon = config.contours.simplify * 0.04 * cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, epsilon, true);
        const data = approx.data32S;
        if (data.length >= 4) {
          for (let j = 0; j < data.length && floats.length < maxFloats - 2; j += 2) {
            floats.push(data[j], data[j + 1]);
          }
          floats.push(Number.NaN, Number.NaN);
          count += 1;
        }
        approx.delete();
        contour.delete();
      }
    } finally {
      hierarchy.delete();
      contours.delete();
      contourSource.delete();
    }

    return { contours: new Float32Array(floats), count };
  }

  computeMotionMask(config) {
    if (!this.hasPrev) return null;
    const cv = this.cv;
    const threshold = 10 + (1 - config.motion.persistence) * 66;
    cv.threshold(this.diff, this.motionMask, threshold, 255, cv.THRESH_BINARY);
    return copyBuffer(this.motionMask, this.total);
  }

  computeDepth() {
    const cv = this.cv;
    cv.equalizeHist(this.blurred, this.depth);
    return {
      mean: cv.mean(this.depth)[0] / 255,
      buffer: copyBuffer(this.depth, this.total),
    };
  }

  analyze(rgbaBuffer, analysisConfig) {
    const cv = this.cv;
    const config = normalizeAnalysisConfig(analysisConfig);
    const rgba = new Uint8ClampedArray(rgbaBuffer);
    const geometry = {
      width: this.width,
      height: this.height,
    };
    const transfers = [];

    this.src.data.set(rgba);
    cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);
    this.blurGray(config.edges.blur);

    const brightness = cv.mean(this.gray)[0] / 255;
    let motion = 0;
    if (this.hasPrev) {
      cv.absdiff(this.gray, this.prevGray, this.diff);
      motion = cv.mean(this.diff)[0] / 255;
    }

    const needsEdges = config.edges.enabled || config.lines.enabled || config.contours.enabled;
    let edgeDensity = 0;
    if (needsEdges) {
      this.computeEdges(config);
      edgeDensity = cv.countNonZero(this.edges) / this.total;
      if (config.edges.enabled) {
        geometry.edgeAlphaBuffer = copyBuffer(this.edges, this.total);
        transfers.push(geometry.edgeAlphaBuffer);
      }
    }

    let lineCount = 0;
    if (config.lines.enabled && needsEdges) {
      const lines = this.detectLines(config);
      lineCount = Math.min(1, (lines.length / 4) / 120);
      geometry.lineSegmentsBuffer = lines.buffer;
      transfers.push(lines.buffer);
    }

    let contourCount = 0;
    if (config.contours.enabled && needsEdges) {
      const result = this.detectContours(config);
      contourCount = Math.min(1, result.count / 45);
      geometry.contoursBuffer = result.contours.buffer;
      transfers.push(result.contours.buffer);
    }

    let depthMean = 0;
    if (config.depth.enabled) {
      const depth = this.computeDepth(config);
      depthMean = depth.mean;
      geometry.depthBuffer = depth.buffer;
      transfers.push(depth.buffer);
    }

    if (config.motion.enabled) {
      const motionBuffer = this.computeMotionMask(config);
      if (motionBuffer) {
        geometry.motionAlphaBuffer = motionBuffer;
        transfers.push(motionBuffer);
      }
    }

    geometry.signals = {
      edgeDensity,
      motionAmount: motion,
      averageBrightness: brightness,
      lineCount,
      contourCount,
      depthMean,
      sceneStability: Math.max(0, 1 - motion * 3.5),
    };

    this.gray.copyTo(this.prevGray);
    this.hasPrev = true;

    return { geometry, transfers };
  }

  destroy() {
    this.src.delete();
    this.gray.delete();
    this.blurred.delete();
    this.prevGray.delete();
    this.diff.delete();
    this.edges.delete();
    this.motionMask.delete();
    this.depth.delete();
    this.fastLineDetector?.delete?.();
  }
}

self.onmessage = async (event) => {
  const message = event.data ?? {};

  if (message.type === 'init') {
    try {
      emitLog('init', `dimensions=${message.width}x${message.height}`);
      await waitForCv();
      initWidth = message.width;
      initHeight = message.height;
      emitLog('init', 'runtime ready; signaling main thread');
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: getErrorMessage(error) });
    }
    return;
  }

  if (message.type === 'analyze') {
    try {
      if (!cvModule) {
        throw new Error('OpenCV runtime is not ready.');
      }
      if (!analyzer) {
        emitLog('analyze-init', `creating analyzer ${initWidth}x${initHeight}`);
        analyzer = new OpenCvAnalyzer(cvModule, initWidth, initHeight);
        emitLog('analyze-init', 'analyzer created');
      }
      const result = analyzer.analyze(message.rgbaBuffer, message.analysisConfig);
      self.postMessage(
        {
          type: 'result',
          id: message.id,
          geometry: result.geometry,
        },
        result.transfers,
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
