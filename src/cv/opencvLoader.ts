// Loads OpenCV.js from /opencv.js (served out of /public). This specific
// Emscripten build only initializes reliably when a global `cv` module object
// exists before the script executes, so we seed `window.cv` up front and
// resolve once `cv.Mat` is callable.

const URL = '/opencv.js';
const TIMEOUT_MS = 60000;

let _cv: any | null = null;
let _readyPromise: Promise<any> | null = null;

function isReady(cv: any): boolean {
  return !!(cv && typeof cv.Mat === 'function' && cv.CV_8UC1 !== undefined);
}

export function whenReady(): Promise<any> {
  if (_cv) return Promise.resolve(_cv);
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise((resolve, reject) => {
    const w = window as any;
    const seed = w.cv && typeof w.cv === 'object' ? w.cv : {};
    w.cv = seed;

    if (isReady(w.cv)) {
      _cv = w.cv;
      resolve(_cv);
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      fail(new Error(`OpenCV.js did not initialize within ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    const finish = (maybeCv?: any) => {
      const cv = maybeCv ?? w.cv;
      if (settled || !isReady(cv)) return;
      settled = true;
      window.clearTimeout(timeoutId);
      _cv = cv;
      resolve(cv);
    };

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      _readyPromise = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const previousInit =
      typeof seed.onRuntimeInitialized === 'function' ? seed.onRuntimeInitialized : null;
    seed.onRuntimeInitialized = () => {
      previousInit?.();
      finish(w.cv);
    };

    const observeCurrent = () => {
      if (isReady(w.cv)) {
        finish(w.cv);
        return;
      }
      Promise.resolve(w.cv).then(finish).catch(fail);
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-opencv-loader]');
    if (!script) {
      script = document.createElement('script');
      script.src = URL;
      script.async = true;
      script.dataset.opencvLoader = '1';
      script.addEventListener('error', () => {
        fail(new Error(`Failed to load OpenCV.js from ${URL}`));
      });
      script.addEventListener('load', observeCurrent);
      document.head.appendChild(script);
    }

    observeCurrent();
  });

  return _readyPromise;
}

export function getCv(): any | null { return _cv; }
