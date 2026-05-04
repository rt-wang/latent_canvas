import { useEffect, useRef, useState } from 'react';
import { whenReady } from '../cv/opencvLoader';
import { FrameAnalyzer } from '../cv/frameAnalyzer';
import { renderFrame } from '../render/renderer';
import { lerpConfig } from '../utils/lerp';
import { useConfigStore } from '../state/useConfigStore';
import { SectionLabel } from './ui/Label';

const ANALYSIS_W = 320;
const ANALYSIS_H = 180;

type Props = { videoRef: React.RefObject<HTMLVideoElement>; videoReady: boolean };

export function CanvasRenderer({ videoRef, videoReady }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const analysisRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cvReady, setCvReady] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  // Load OpenCV once
  useEffect(() => {
    let cancelled = false;
    whenReady()
      .then(() => { if (!cancelled) setCvReady(true); })
      .catch((e) => { if (!cancelled) setCvError(String(e)); });
    return () => { cancelled = true; };
  }, []);

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
    if (!cvReady || !videoReady) return;
    const video = videoRef.current;
    const display = displayRef.current;
    const analysis = analysisRef.current;
    if (!video || !display || !analysis) return;

    analysis.width = ANALYSIS_W;
    analysis.height = ANALYSIS_H;

    let analyzer: FrameAnalyzer | null = null;
    let cancelled = false;
    whenReady().then((cv) => {
      if (cancelled) return;
      analyzer = new FrameAnalyzer(cv, ANALYSIS_W, ANALYSIS_H);
    });

    const store = useConfigStore.getState;
    let raf = 0;
    let frameCount = 0;
    let lastFps = performance.now();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = store();
      const next = lerpConfig(s.current, s.target);
      useConfigStore.setState({ current: next });

      let edgeImage: ImageData | null = null;
      if (analyzer && video.readyState >= 2) {
        const actx = analysis.getContext('2d', { willReadFrequently: true });
        if (actx) {
          actx.save();
          actx.setTransform(-1, 0, 0, 1, ANALYSIS_W, 0);
          actx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
          actx.restore();
          const rgba = actx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
          const { signals, edges } = analyzer.analyze(rgba, next.edges.threshold);
          edgeImage = edges;
          useConfigStore.setState({ signals });
        }
      }

      renderFrame({ video, display, analysis, config: next, edges: edgeImage });

      frameCount++;
      const now = performance.now();
      if (now - lastFps >= 500) {
        const fps = (frameCount * 1000) / (now - lastFps);
        useConfigStore.setState({ fps });
        frameCount = 0;
        lastFps = now;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      analyzer?.destroy();
    };
  }, [cvReady, videoReady, videoRef]);

  const fps = useConfigStore((s) => s.fps);
  const signals = useConfigStore((s) => s.signals);

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
          {videoReady && cvReady ? (
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
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-muted)' }} />
              {cvError ? 'CV ERROR' : !cvReady ? 'LOADING CV…' : 'WAITING FOR VIDEO'}
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

        {!cvReady && !cvError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Loading</SectionLabel>
            <div style={{ color: '#fff', fontSize: 14 }}>Loading OpenCV.js…</div>
          </Overlay>
        )}
        {cvError && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Error</SectionLabel>
            <div style={{ color: '#fff', fontSize: 13, maxWidth: 360 }}>{cvError}</div>
          </Overlay>
        )}
        {cvReady && !videoReady && (
          <Overlay>
            <SectionLabel light style={{ marginBottom: 8 }}>Camera</SectionLabel>
            <div style={{ color: '#fff', fontSize: 14 }}>Waiting for camera permission…</div>
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
