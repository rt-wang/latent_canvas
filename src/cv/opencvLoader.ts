// Loads OpenCV.js via a <script> tag from the official CDN and resolves
// once `cv.Mat` is available. We intentionally don't bundle @techstark's
// CommonJS build through Vite — its UMD wrapper assumes a `module` global
// at runtime and crashes with "Cannot set properties of undefined" in a
// browser ESM context. The CDN script is the supported path.

const CDN_URL = 'https://docs.opencv.org/4.10.0/opencv.js';

let _cv: any | null = null;
let _readyPromise: Promise<any> | null = null;

export function whenReady(): Promise<any> {
  if (_cv) return Promise.resolve(_cv);
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise((resolve, reject) => {
    const w = window as any;

    const settle = (cv: any) => { _cv = cv; resolve(cv); };

    // Already loaded (HMR or repeat init).
    if (w.cv?.Mat) { settle(w.cv); return; }

    // Script may already be in flight from an earlier mount.
    let script = document.querySelector<HTMLScriptElement>('script[data-opencv-loader]');
    if (!script) {
      script = document.createElement('script');
      script.src = CDN_URL;
      script.async = true;
      script.dataset.opencvLoader = '1';
      script.onerror = () => reject(new Error(`Failed to load OpenCV.js from ${CDN_URL}`));
      document.head.appendChild(script);
    }

    // OpenCV.js exposes `cv` as a Module-like object as soon as the script
    // executes, but `cv.Mat` only appears after the WASM runtime initializes.
    // The supported hook is `cv.onRuntimeInitialized`.
    const wireRuntime = () => {
      const cv = w.cv;
      if (!cv) return false;
      if (cv.Mat) { settle(cv); return true; }
      cv.onRuntimeInitialized = () => settle(w.cv);
      return true;
    };

    if (!wireRuntime()) {
      // Script hasn't executed yet — wait for load, then wire.
      script.addEventListener('load', () => {
        if (!wireRuntime()) {
          // Defensive: poll briefly in case `cv` hasn't been assigned yet.
          const t0 = Date.now();
          const id = setInterval(() => {
            if (wireRuntime()) clearInterval(id);
            else if (Date.now() - t0 > 15000) {
              clearInterval(id);
              reject(new Error('OpenCV.js loaded but `cv` global never appeared'));
            }
          }, 50);
        }
      });
    }
  });

  return _readyPromise;
}

export function getCv(): any | null { return _cv; }
