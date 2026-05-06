import { useState, type ReactNode } from 'react';
import { useConfigStore } from '../state/useConfigStore';
import { Button } from './ui/Button';
import { defaultAnalysisConfig } from '../state/defaultConfig';
import type { AnalysisConfig } from '../llm/schema';

type SectionKey = 'ANALYSIS' | 'PALETTE' | 'MOTION' | 'VIBE' | 'LAYERS' | 'DISTORTION' | 'COMPOSITION';

export function ConfigInspector() {
  const currentStyle = useConfigStore((s) => s.currentStyle);
  const targetStyle = useConfigStore((s) => s.targetStyle);
  const analysis = useConfigStore((s) => s.analysis);
  const renderMode = useConfigStore((s) => s.renderMode);
  const setAnalysis = useConfigStore((s) => s.setAnalysis);
  const setTargetStyle = useConfigStore((s) => s.setTargetStyle);
  const resetStyle = useConfigStore((s) => s.resetStyle);
  const signals = useConfigStore((s) => s.signals);
  const [tab, setTab] = useState<'JSON' | 'SIGNALS'>('JSON');

  const setAnalysisGroup = <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => {
    setAnalysis({ ...analysis, [key]: value });
  };

  const session = { analysis, style: currentStyle, renderMode };

  return (
    <aside
      style={{
        width: 292,
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--fg-ghost)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--fg-ghost)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-primary)', letterSpacing: '0.04em' }}>
            GEOMETRY RACK
          </span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-muted)', marginTop: 2 }}>
            {renderMode === 'geometry-preview' ? 'GEOMETRY PREVIEW' : 'STYLED OUTPUT'}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAnalysis(defaultAnalysisConfig);
            resetStyle();
          }}
        >
          Reset
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Section title="ANALYSIS" defaultOpen>
          <ToggleRow
            label="Edges"
            value={analysis.edges.enabled}
            onChange={(enabled) => setAnalysisGroup('edges', { ...analysis.edges, enabled })}
          />
          <SliderRow
            label="Edge Threshold"
            value={analysis.edges.threshold}
            onChange={(threshold) => setAnalysisGroup('edges', { ...analysis.edges, threshold })}
          />
          <SliderRow
            label="Edge Blur"
            value={analysis.edges.blur}
            onChange={(blur) => setAnalysisGroup('edges', { ...analysis.edges, blur })}
          />
          <ToggleRow
            label="Fast Lines"
            value={analysis.lines.enabled}
            onChange={(enabled) => setAnalysisGroup('lines', { ...analysis.lines, enabled })}
          />
          <SliderRow
            label="Line Threshold"
            value={analysis.lines.threshold}
            onChange={(threshold) => setAnalysisGroup('lines', { ...analysis.lines, threshold })}
          />
          <SliderRow
            label="Min Length"
            value={analysis.lines.minLength}
            onChange={(minLength) => setAnalysisGroup('lines', { ...analysis.lines, minLength })}
          />
          <ToggleRow
            label="Contours"
            value={analysis.contours.enabled}
            onChange={(enabled) => setAnalysisGroup('contours', { ...analysis.contours, enabled })}
          />
          <SliderRow
            label="Contour Area"
            value={analysis.contours.minArea}
            onChange={(minArea) => setAnalysisGroup('contours', { ...analysis.contours, minArea })}
          />
          <SliderRow
            label="Simplify"
            value={analysis.contours.simplify}
            onChange={(simplify) => setAnalysisGroup('contours', { ...analysis.contours, simplify })}
          />
          <ToggleRow
            label="Motion Mask"
            value={analysis.motion.enabled}
            onChange={(enabled) => setAnalysisGroup('motion', { ...analysis.motion, enabled })}
          />
          <SliderRow
            label="Persistence"
            value={analysis.motion.persistence}
            onChange={(persistence) => setAnalysisGroup('motion', { ...analysis.motion, persistence })}
          />
          <ToggleRow
            label="Depth"
            value={analysis.depth.enabled}
            onChange={(enabled) => setAnalysisGroup('depth', { ...analysis.depth, enabled })}
          />
          <SelectRow
            label="Depth Mode"
            value={analysis.depth.mode}
            options={['pseudo', 'ml'] as const}
            onChange={(mode) => setAnalysisGroup('depth', { ...analysis.depth, mode })}
          />
          <SliderRow
            label="Depth Strength"
            value={analysis.depth.strength}
            onChange={(strength) => setAnalysisGroup('depth', { ...analysis.depth, strength })}
          />
        </Section>

        <Section title="PALETTE" defaultOpen>
          <TintRow tint={currentStyle.palette.tint} />
          <SliderRow
            label="Saturation"
            value={currentStyle.palette.saturation}
            onChange={(saturation) => setTargetStyle({ ...targetStyle, palette: { ...targetStyle.palette, saturation } })}
          />
          <SliderRow
            label="Contrast"
            value={currentStyle.palette.contrast}
            onChange={(contrast) => setTargetStyle({ ...targetStyle, palette: { ...targetStyle.palette, contrast } })}
          />
          <SliderRow
            label="Brightness"
            value={currentStyle.palette.brightness}
            onChange={(brightness) => setTargetStyle({ ...targetStyle, palette: { ...targetStyle.palette, brightness } })}
          />
        </Section>
        <Section title="MOTION">
          <SliderRow
            label="Trail Length"
            value={currentStyle.motion.trailLength}
            onChange={(trailLength) => setTargetStyle({ ...targetStyle, motion: { ...targetStyle.motion, trailLength } })}
          />
          <SliderRow
            label="Blur"
            value={currentStyle.motion.blur}
            onChange={(blur) => setTargetStyle({ ...targetStyle, motion: { ...targetStyle.motion, blur } })}
          />
        </Section>
        <Section title="VIBE">
          <SliderRow
            label="Chaoticness"
            value={currentStyle.vibe.chaoticness}
            onChange={(chaoticness) => setTargetStyle({ ...targetStyle, vibe: { ...targetStyle.vibe, chaoticness } })}
          />
          <SliderRow
            label="Softness"
            value={currentStyle.vibe.softness}
            onChange={(softness) => setTargetStyle({ ...targetStyle, vibe: { ...targetStyle.vibe, softness } })}
          />
          <SliderRow
            label="Density"
            value={currentStyle.vibe.density}
            onChange={(density) => setTargetStyle({ ...targetStyle, vibe: { ...targetStyle.vibe, density } })}
          />
        </Section>
        <Section title="LAYERS">
          <SliderRow
            label="Source"
            value={currentStyle.layers.sourceOpacity}
            onChange={(sourceOpacity) =>
              setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, sourceOpacity } })
            }
          />
          <SliderRow
            label="Edge Glow"
            value={currentStyle.layers.edgeGlow}
            onChange={(edgeGlow) => setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, edgeGlow } })}
          />
          <SliderRow
            label="Line Weight"
            value={currentStyle.layers.lineWeight}
            onChange={(lineWeight) => setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, lineWeight } })}
          />
          <SliderRow
            label="Line Glow"
            value={currentStyle.layers.lineGlow}
            onChange={(lineGlow) => setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, lineGlow } })}
          />
          <SliderRow
            label="Contour Stroke"
            value={currentStyle.layers.contourStroke}
            onChange={(contourStroke) =>
              setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, contourStroke } })
            }
          />
          <SliderRow
            label="Contour Fill"
            value={currentStyle.layers.contourFill}
            onChange={(contourFill) =>
              setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, contourFill } })
            }
          />
          <SliderRow
            label="Depth Fog"
            value={currentStyle.layers.depthFog}
            onChange={(depthFog) => setTargetStyle({ ...targetStyle, layers: { ...targetStyle.layers, depthFog } })}
          />
        </Section>
        <Section title="DISTORTION">
          <SliderRow
            label="Noise"
            value={currentStyle.distortion.noise}
            onChange={(noise) => setTargetStyle({ ...targetStyle, distortion: { ...targetStyle.distortion, noise } })}
          />
          <SliderRow
            label="Pixelation"
            value={currentStyle.distortion.pixelation}
            onChange={(pixelation) =>
              setTargetStyle({ ...targetStyle, distortion: { ...targetStyle.distortion, pixelation } })
            }
          />
          <SliderRow
            label="Wave"
            value={currentStyle.distortion.wave}
            onChange={(wave) => setTargetStyle({ ...targetStyle, distortion: { ...targetStyle.distortion, wave } })}
          />
          <SliderRow
            label="Displace"
            value={currentStyle.distortion.displacement}
            onChange={(displacement) =>
              setTargetStyle({ ...targetStyle, distortion: { ...targetStyle.distortion, displacement } })
            }
          />
        </Section>
        <Section title="COMPOSITION">
          <SelectRow
            label="Blend"
            value={currentStyle.composition.blendMode}
            options={['normal', 'screen', 'multiply', 'difference', 'overlay'] as const}
            onChange={(blendMode) =>
              setTargetStyle({ ...targetStyle, composition: { ...targetStyle.composition, blendMode } })
            }
          />
          <SliderRow
            label="Opacity"
            value={currentStyle.composition.opacity}
            onChange={(opacity) => setTargetStyle({ ...targetStyle, composition: { ...targetStyle.composition, opacity } })}
          />
          <SliderRow
            label="Vignette"
            value={currentStyle.composition.vignette}
            onChange={(vignette) =>
              setTargetStyle({ ...targetStyle, composition: { ...targetStyle.composition, vignette } })
            }
          />
        </Section>
      </div>

      <div style={{ borderTop: '1px solid var(--fg-ghost)', background: 'var(--bg-overlay)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--fg-ghost)' }}>
          {(['JSON', 'SIGNALS'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '7px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === t ? 'var(--fg-primary)' : 'var(--fg-muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: tab === t ? 500 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: 'var(--fg-secondary)',
            lineHeight: 1.6,
            maxHeight: 168,
            overflow: 'auto',
          }}
        >
          {tab === 'JSON' ? (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {JSON.stringify(session, null, 2)}
            </pre>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>edgeDensity: {signals.edgeDensity.toFixed(3)}</div>
              <div>motionAmount: {signals.motionAmount.toFixed(3)}</div>
              <div>brightness: {signals.averageBrightness.toFixed(3)}</div>
              <div>lineCount: {signals.lineCount.toFixed(3)}</div>
              <div>contourCount: {signals.contourCount.toFixed(3)}</div>
              <div>depthMean: {signals.depthMean.toFixed(3)}</div>
              <div>sceneStability: {signals.sceneStability.toFixed(3)}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '4px 10px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(JSON.stringify(session, null, 2))}>
            Copy JSON
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Section({ title, defaultOpen, children }: { title: SectionKey; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--fg-ghost)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '0.12em',
          color: 'var(--fg-secondary)',
          textAlign: 'left',
        }}
      >
        {title}
        <span style={{ color: 'var(--fg-muted)', fontSize: 10 }}>{open ? '∧' : '∨'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-secondary)', width: 112, flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="lc-slider"
        style={{ flex: 1 }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--fg-muted)',
          width: 30,
          textAlign: 'right',
        }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-secondary)', width: 112, flexShrink: 0 }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 32,
          height: 18,
          borderRadius: 'var(--r-full)',
          background: value ? 'var(--accent)' : 'var(--fg-ghost)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.18s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: value ? 16 : 3,
            transition: 'left 0.18s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: value ? 'var(--accent)' : 'var(--fg-muted)',
        }}
      >
        {value ? 'on' : 'off'}
      </span>
    </div>
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-secondary)', width: 112, flexShrink: 0 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: 'var(--fg-secondary)',
          background: 'var(--bg-overlay)',
          border: '1px solid var(--fg-ghost)',
          borderRadius: 'var(--r-sm)',
          padding: '3px 6px',
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TintRow({ tint }: { tint: [number, number, number] }) {
  const [r, g, b] = tint;
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 6 }}>Tint</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            width: 36,
            height: 24,
            borderRadius: 'var(--r-sm)',
            background: `rgb(${r}, ${g}, ${b})`,
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-muted)' }}>
          {r}, {g}, {b}
        </span>
      </div>
    </div>
  );
}
