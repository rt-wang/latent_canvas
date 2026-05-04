import { useState, type ReactNode } from 'react';
import { useConfigStore } from '../state/useConfigStore';
import { Button } from './ui/Button';
import { defaultConfig } from '../state/defaultConfig';

type SectionKey = 'PALETTE' | 'MOTION' | 'EDGES' | 'DISTORTION';

export function ConfigInspector() {
  const current = useConfigStore((s) => s.current);
  const target = useConfigStore((s) => s.target);
  const setTarget = useConfigStore((s) => s.setTarget);
  const signals = useConfigStore((s) => s.signals);
  const [tab, setTab] = useState<'JSON' | 'SIGNALS'>('JSON');

  return (
    <aside
      style={{
        width: 260,
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
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-primary)', letterSpacing: '0.04em' }}>
          CONFIG INSPECTOR
        </span>
        <Button variant="ghost" size="sm" onClick={() => setTarget(defaultConfig)}>
          Reset
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Section title="PALETTE" defaultOpen>
          <TintRow tint={current.palette.tint} />
          <SliderRow
            label="Saturation"
            value={current.palette.saturation}
            onChange={(v) => setTarget({ ...target, palette: { ...target.palette, saturation: v } })}
          />
          <SliderRow
            label="Contrast"
            value={current.palette.contrast}
            onChange={(v) => setTarget({ ...target, palette: { ...target.palette, contrast: v } })}
          />
          <SliderRow
            label="Brightness"
            value={current.palette.brightness}
            onChange={(v) => setTarget({ ...target, palette: { ...target.palette, brightness: v } })}
          />
        </Section>
        <Section title="MOTION" defaultOpen>
          <SliderRow
            label="Trail Length"
            value={current.motion.trailLength}
            onChange={(v) => setTarget({ ...target, motion: { ...target.motion, trailLength: v } })}
          />
          <SliderRow
            label="Blur"
            value={current.motion.blur}
            onChange={(v) => setTarget({ ...target, motion: { ...target.motion, blur: v } })}
          />
        </Section>
        <Section title="EDGES">
          <ToggleRow
            label="Enabled"
            value={current.edges.enabled}
            onChange={(v) => setTarget({ ...target, edges: { ...target.edges, enabled: v } })}
          />
          <SliderRow
            label="Threshold"
            value={current.edges.threshold}
            onChange={(v) => setTarget({ ...target, edges: { ...target.edges, threshold: v } })}
          />
          <SliderRow
            label="Glow"
            value={current.edges.glow}
            onChange={(v) => setTarget({ ...target, edges: { ...target.edges, glow: v } })}
          />
        </Section>
        <Section title="DISTORTION">
          <SliderRow
            label="Noise"
            value={current.distortion.noise}
            onChange={(v) => setTarget({ ...target, distortion: { ...target.distortion, noise: v } })}
          />
          <SliderRow
            label="Pixelation"
            value={current.distortion.pixelation}
            onChange={(v) => setTarget({ ...target, distortion: { ...target.distortion, pixelation: v } })}
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
            maxHeight: 160,
            overflow: 'auto',
          }}
        >
          {tab === 'JSON' ? (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {JSON.stringify(current, null, 2)}
            </pre>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>edgeDensity: {signals.edgeDensity.toFixed(3)}</div>
              <div>motionAmount: {signals.motionAmount.toFixed(3)}</div>
              <div>brightness: {signals.averageBrightness.toFixed(3)}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '4px 10px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard?.writeText(JSON.stringify(current, null, 2))}
          >
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
      <span style={{ fontSize: 12, color: 'var(--fg-secondary)', width: 100, flexShrink: 0 }}>{label}</span>
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
      <span style={{ fontSize: 12, color: 'var(--fg-secondary)', width: 100, flexShrink: 0 }}>{label}</span>
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
        {value ? 'true' : 'false'}
      </span>
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
