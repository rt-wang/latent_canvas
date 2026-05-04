import { useEffect, useRef, useState } from 'react';
import { renderFrame } from '../render/renderer';
import { lerpConfig } from '../utils/lerp';
import { useConfigStore } from '../state/useConfigStore';
import { SectionLabel } from './ui/Label';

const ANALYSIS_W = 320;
const ANALYSIS_H = 180;
const ANALYSIS_INTERVAL_MS = 1000 / 24;
const UI_SYNC_MS = 250;

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoReady: boolean;
  videoError: string | null;
};

export function CanvasRenderer({ videoRef, videoReady, videoError }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [cvStatus, setCvStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

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
      setCvStatus('error');
      return;
    }

    setRenderError(null);
    setCvStatus('loading');

    const store = useConfigStore.getState;
    const edgeImage = new ImageData(ANALYSIS_W, ANALYSIS_H);
    const edgePixels = edgeImage.data;
    for (let i = 0; i < ANALYSIS_W * ANALYSIS_H; i += 1) {
      const j = i << 2;
      edgePixels[j] = 255;
      edgePixels[j + 1] = 255;
      edgePixels[j + 2] = 255;
      edgePixels[j + 3] = 0;
    }

    let raf = 0;
    let disposed = false;
    let workerReady = false;
    let analysisPending = false;
    let analysisId = 0;
    let lastAnalysisAt = 0;
    let latestEdgeImage: ImageData | null = null;
    let current = store().current;
    let latestSignals = store().signals;
    let latestFps = store().fps;
    let frameCount = 0;
    let lastFps = performance.now();
    let lastUiSync = lastFps;
    const worker = new Worker('/opencv-worker.js');

    worker.onmessage = (workerEvent: MessageEvent) => {
      if (disposed) return;
      const message = workerEvent.data ?? {};

      if (message.type === 'ready') {
        workerReady = true;
        setCvStatus('ready');
        return;
      }

      if (message.type === 'result') {
        analysisPending = false;
        if (typeof message.id !== 'number' || message.id !== analysisId) {
          return;
        }
        const alpha = new Uint8ClampedArray(message.alphaBuffer);
        for (let i = 0; i < alpha.length; i += 1) {
          edgePixels[(i << 2) + 3] = alpha[i];
        }
        latestEdgeImage = edgeImage;
        latestSignals = message.signals ?? latestSignals;
        return;
      }

      if (message.type === 'error') {
        workerReady = false;
        analysisPending = false;
        setCvStatus('error');
        setRenderError(message.message ?? 'OpenCV worker failed.');
      }
    };

    worker.onerror = () => {
      if (disposed) return;
      workerReady = false;
      analysisPending = false;
      setCvStatus('error');
      setRenderError('OpenCV worker failed.');
    };

    worker.postMessage({ type: 'init', width: ANALYSIS_W, height: ANALYSIS_H });

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      current = lerpConfig(current, store().target);

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
            edgeThreshold01: current.edges.threshold,
            rgbaBuffer: rgba.data.buffer,
          },
          [rgba.data.buffer],
        );
      }

      renderFrame({ video, display, config: current, edges: latestEdgeImage });

      frameCount++;
      if (now - lastFps >= 500) {
        latestFps = (frameCount * 1000) / (now - lastFps);
        frameCount = 0;
        lastFps = now;
      }

      if (now - lastUiSync >= UI_SYNC_MS) {
        lastUiSync = now;
        useConfigStore.setState({
          current,
          signals: latestSignals,
          fps: latestFps,
        });
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      worker.postMessage({ type: 'dispose' });
      worker.terminate();
    };
  }, [videoReady, videoRef]);

  const fps = useConfigStore((s) => s.fps);
  const signals = useConfigStore((s) => s.signals);
  const statusLabel = videoReady && cvStatus === 'ready' && !renderError
    ? 'LIVE'
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
              LIVE
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
          </Overlay>
        )}
        {!videoError && videoReady && renderError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Computer Vision</SectionLabel>
            <div style={{ color: '#fff', fontSize: 13, maxWidth: 360 }}>{renderError}</div>
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
