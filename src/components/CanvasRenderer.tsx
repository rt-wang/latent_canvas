import { useEffect, useRef, useState } from 'react';
import { renderFrame } from '../render/renderer';
import { lerpStyleConfig } from '../utils/lerp';
import { useConfigStore } from '../state/useConfigStore';
import { defaultPreviewStyleConfig } from '../state/defaultConfig';
import { SectionLabel } from './ui/Label';
import type { GeometryFrame, WorkerGeometryPayload } from '../cv/geometry';

const ANALYSIS_W = 320;
const ANALYSIS_H = 180;
const ANALYSIS_INTERVAL_MS = 1000 / 24;
const CV_STALL_MS = 15000;
const UI_SYNC_MS = 250;

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoReady: boolean;
  videoError: string | null;
};

function alphaToImage(buffer: ArrayBuffer | undefined, width: number, height: number, rgb: [number, number, number]) {
  if (!buffer) return null;
  const alpha = new Uint8ClampedArray(buffer);
  const image = new ImageData(width, height);
  const pixels = image.data;
  for (let i = 0; i < alpha.length; i += 1) {
    const j = i << 2;
    pixels[j] = rgb[0];
    pixels[j + 1] = rgb[1];
    pixels[j + 2] = rgb[2];
    pixels[j + 3] = alpha[i];
  }
  return image;
}

function depthToImage(buffer: ArrayBuffer | undefined, width: number, height: number) {
  if (!buffer) return null;
  const depth = new Uint8ClampedArray(buffer);
  const image = new ImageData(width, height);
  const pixels = image.data;
  for (let i = 0; i < depth.length; i += 1) {
    const v = depth[i];
    const j = i << 2;
    pixels[j] = Math.min(255, 40 + v * 0.55);
    pixels[j + 1] = Math.min(255, 96 + v * 0.55);
    pixels[j + 2] = Math.min(255, 132 + v * 0.65);
    pixels[j + 3] = Math.min(210, v);
  }
  return image;
}

function toGeometryFrame(payload: WorkerGeometryPayload | undefined): GeometryFrame | null {
  if (!payload) return null;
  const { width, height } = payload;
  return {
    width,
    height,
    signals: payload.signals,
    edgeMask: alphaToImage(payload.edgeAlphaBuffer, width, height, [230, 255, 238]),
    motionMask: alphaToImage(payload.motionAlphaBuffer, width, height, [255, 96, 86]),
    depthMap: depthToImage(payload.depthBuffer, width, height),
    lineSegments: payload.lineSegmentsBuffer ? new Float32Array(payload.lineSegmentsBuffer) : null,
    contours: payload.contoursBuffer ? new Float32Array(payload.contoursBuffer) : null,
  };
}

export function CanvasRenderer({ videoRef, videoReady, videoError }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [cvStatus, setCvStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [cvDetail, setCvDetail] = useState<string | null>(null);

  // Resize display canvas to match container, maintaining 16:9 aspect.
  useEffect(() => {
    const wrap = wrapRef.current;
    const display = displayRef.current;
    if (!wrap || !display) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const w = Math.max(2, Math.floor(r.width));
      const h = Math.max(2, Math.floor(r.height));
      // device pixel ratio cap to keep perf manageable
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      display.width = Math.floor(w * dpr);
      display.height = Math.floor(h * dpr);
      display.style.width = `${w}px`;
      display.style.height = `${h}px`;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Main render loop
  useEffect(() => {
    if (!videoReady) {
      setCvStatus('idle');
      setCvDetail(null);
      setRenderError(null);
      return;
    }
    const video = videoRef.current;
    const display = displayRef.current;
    const analysis = analysisRef.current;
    if (!video || !display || !analysis) return;

    analysis.width = ANALYSIS_W;
    analysis.height = ANALYSIS_H;
    const actx = analysis.getContext('2d', { willReadFrequently: true });
    if (!actx) {
      setRenderError('Could not create analysis canvas context.');
      setCvDetail('analysis canvas initialization failed');
      setCvStatus('error');
      return;
    }

    setRenderError(null);
    setCvDetail('starting worker');
    setCvStatus('loading');

    const store = useConfigStore.getState;
    let raf = 0;
    let disposed = false;
    let workerReady = false;
    let analysisPending = false;
    let analysisId = 0;
    let lastAnalysisAt = 0;
    let latestGeometry: GeometryFrame | null = null;
    let currentStyle = store().currentStyle;
    let latestSignals = store().signals;
    let latestFps = store().fps;
    let frameCount = 0;
    let lastFps = performance.now();
    let lastUiSync = lastFps;
    let lastWorkerStage = 'starting worker';
    const worker = new Worker('/opencv-worker.js');
    const stallTimeoutId = window.setTimeout(() => {
      if (disposed || workerReady) return;
      workerReady = false;
      analysisPending = false;
      console.error('[opencv-worker] startup stalled:', lastWorkerStage);
      setCvStatus('error');
      setCvDetail(lastWorkerStage);
      setRenderError(`OpenCV startup stalled after ${CV_STALL_MS / 1000}s.`);
      worker.terminate();
    }, CV_STALL_MS);

    worker.onmessage = (workerEvent: MessageEvent) => {
      if (disposed) return;
      const message = workerEvent.data ?? {};

      if (message.type === 'ready') {
        workerReady = true;
        window.clearTimeout(stallTimeoutId);
        console.info('[opencv-worker] ready');
        setCvDetail(null);
        setCvStatus('ready');
        return;
      }

      if (message.type === 'log') {
        lastWorkerStage = `${message.stage}: ${message.detail}`;
        console.info(`[opencv-worker] ${message.stage}: ${message.detail}`);
        setCvDetail(lastWorkerStage);
        if (message.stage === 'worker-ready') {
          workerReady = true;
          window.clearTimeout(stallTimeoutId);
          setCvStatus('ready');
        }
        return;
      }

      if (message.type === 'result') {
        analysisPending = false;
        if (typeof message.id !== 'number' || message.id !== analysisId) {
          return;
        }
        latestGeometry = toGeometryFrame(message.geometry);
        latestSignals = latestGeometry?.signals ?? latestSignals;
        return;
      }

      if (message.type === 'error') {
        workerReady = false;
        analysisPending = false;
        window.clearTimeout(stallTimeoutId);
        console.error('[opencv-worker] error:', message.message);
        setCvDetail(lastWorkerStage);
        setCvStatus('error');
        setRenderError(message.message ?? 'OpenCV worker failed.');
      }
    };

    worker.onerror = (event) => {
      if (disposed) return;
      workerReady = false;
      analysisPending = false;
      window.clearTimeout(stallTimeoutId);
      const detail =
        typeof event.message === 'string' && event.message
          ? `${event.message}${event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : ''}`
          : 'OpenCV worker failed.';
      console.error('[opencv-worker] uncaught error:', event);
      setCvDetail(lastWorkerStage);
      setCvStatus('error');
      setRenderError(detail);
    };

    worker.postMessage({ type: 'init', width: ANALYSIS_W, height: ANALYSIS_H });

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const state = store();
      currentStyle = lerpStyleConfig(currentStyle, state.targetStyle);

      if (
        workerReady &&
        !analysisPending &&
        video.readyState >= 2 &&
        now - lastAnalysisAt >= ANALYSIS_INTERVAL_MS
      ) {
        analysisPending = true;
        lastAnalysisAt = now;
        actx.save();
        actx.setTransform(-1, 0, 0, 1, ANALYSIS_W, 0);
        actx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
        actx.restore();
        const rgba = actx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
        analysisId += 1;
        worker.postMessage(
          {
            type: 'analyze',
            id: analysisId,
            analysisConfig: state.analysis,
            rgbaBuffer: rgba.data.buffer,
          },
          [rgba.data.buffer],
        );
      }

      renderFrame({
        video,
        display,
        style: state.renderMode === 'geometry-preview' ? defaultPreviewStyleConfig : currentStyle,
        geometry: latestGeometry,
      });

      frameCount++;
      if (now - lastFps >= 500) {
        latestFps = (frameCount * 1000) / (now - lastFps);
        frameCount = 0;
        lastFps = now;
      }

      if (now - lastUiSync >= UI_SYNC_MS) {
        lastUiSync = now;
        useConfigStore.setState({
          currentStyle,
          signals: latestSignals,
          fps: latestFps,
        });
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.clearTimeout(stallTimeoutId);
      cancelAnimationFrame(raf);
      worker.postMessage({ type: 'dispose' });
      worker.terminate();
    };
  }, [videoReady, videoRef]);

  const fps = useConfigStore((s) => s.fps);
  const signals = useConfigStore((s) => s.signals);
  const renderMode = useConfigStore((s) => s.renderMode);
  const statusLabel = videoReady && cvStatus === 'ready' && !renderError
    ? renderMode === 'geometry-preview'
      ? 'GEOMETRY PREVIEW'
      : 'LIVE'
    : videoError
      ? 'VIDEO ERROR'
      : !videoReady
        ? 'WAITING FOR VIDEO'
        : cvStatus === 'loading'
          ? 'LOADING CV…'
        : 'RENDER ERROR';

  return (
    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--fg-ghost)',
          background: 'var(--bg-base)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>LIVE RENDER</span>
          {videoReady && cvStatus === 'ready' && !renderError ? (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#5a8a50',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5a8a50' }} />
              {statusLabel}
            </span>
          ) : (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg-muted)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: videoError || renderError ? 'var(--signal-red)' : 'var(--fg-muted)',
                }}
              />
              {statusLabel}
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-muted)',
          }}
        >
          <span>FPS {fps.toFixed(0)}</span>
          <span>EDGE {(signals.edgeDensity * 100).toFixed(0)}</span>
          <span>MOTION {(signals.motionAmount * 100).toFixed(0)}</span>
          <span>LINE {(signals.lineCount * 100).toFixed(0)}</span>
          <span>CONT {(signals.contourCount * 100).toFixed(0)}</span>
          <span>BRI {(signals.averageBrightness * 100).toFixed(0)}</span>
        </div>
      </header>

      <div
        ref={wrapRef}
        style={{
          flex: 1,
          background: '#0d0c10',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={displayRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        />
        <canvas ref={analysisRef} style={{ display: 'none' }} />

        {videoError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Video</SectionLabel>
            <div style={{ color: '#fff', fontSize: 13, maxWidth: 420 }}>{videoError}</div>
          </Overlay>
        )}
        {!videoError && !videoReady && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Video</SectionLabel>
            <div style={{ color: '#fff', fontSize: 14 }}>Choose a video file to begin.</div>
          </Overlay>
        )}
        {!videoError && videoReady && cvStatus === 'loading' && !renderError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Computer Vision</SectionLabel>
            <div style={{ color: '#fff', fontSize: 14 }}>Loading OpenCV.js…</div>
            {cvDetail && (
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 6, maxWidth: 420 }}>
                {cvDetail}
              </div>
            )}
          </Overlay>
        )}
        {!videoError && videoReady && renderError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Computer Vision</SectionLabel>
            <div style={{ color: '#fff', fontSize: 13, maxWidth: 360 }}>{renderError}</div>
            {cvDetail && (
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 6, maxWidth: 420 }}>
                {cvDetail}
              </div>
            )}
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        textAlign: 'center',
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}
