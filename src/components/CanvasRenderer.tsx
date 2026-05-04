import { useEffect, useRef, useState } from 'react';
import { FrameAnalyzer } from '../cv/frameAnalyzer';
import { renderFrame } from '../render/renderer';
import { lerpConfig } from '../utils/lerp';
import { useConfigStore } from '../state/useConfigStore';
import { SectionLabel } from './ui/Label';

const ANALYSIS_W = 320;
const ANALYSIS_H = 180;
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
    if (!videoReady) return;
    const video = videoRef.current;
    const display = displayRef.current;
    const analysis = analysisRef.current;
    if (!video || !display || !analysis) return;

    analysis.width = ANALYSIS_W;
    analysis.height = ANALYSIS_H;
    const actx = analysis.getContext('2d', { willReadFrequently: true });
    if (!actx) {
      setRenderError('Could not create analysis canvas context.');
      return;
    }

    setRenderError(null);
    const analyzer = new FrameAnalyzer(ANALYSIS_W, ANALYSIS_H);

    const store = useConfigStore.getState;
    let current = store().current;
    let latestSignals = store().signals;
    let latestFps = store().fps;
    let raf = 0;
    let frameCount = 0;
    let lastFps = performance.now();
    let lastUiSync = lastFps;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      current = lerpConfig(current, store().target);

      let edgeImage: ImageData | null = null;
      if (video.readyState >= 2) {
        actx.save();
        actx.setTransform(-1, 0, 0, 1, ANALYSIS_W, 0);
        actx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
        actx.restore();
        const rgba = actx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
        const { signals, edges } = analyzer.analyze(rgba, current.edges.threshold);
        edgeImage = edges;
        latestSignals = signals;
      }

      renderFrame({ video, display, config: current, edges: edgeImage });

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
      cancelAnimationFrame(raf);
      analyzer.destroy();
    };
  }, [videoReady, videoRef]);

  const fps = useConfigStore((s) => s.fps);
  const signals = useConfigStore((s) => s.signals);
  const statusLabel = videoReady && !renderError
    ? 'LIVE'
    : videoError
      ? 'VIDEO ERROR'
      : !videoReady
        ? 'WAITING FOR VIDEO'
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
          {videoReady && !renderError ? (
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
        {!videoError && videoReady && renderError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Error</SectionLabel>
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
