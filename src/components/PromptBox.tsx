import { useCallback, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Button } from './ui/Button';
import { SectionLabel } from './ui/Label';
import { useConfigStore } from '../state/useConfigStore';
import { requestConfig } from '../llm/requestConfig';

const SUGGESTIONS = [
  'make the active geometry feel like a memory decaying',
  'turn these mapped lines into anxious static',
  'make the contours feel sacred and slow',
  'lonely underwater depth haze',
];

const wrap: CSSProperties = {
  background: 'var(--bg-overlay)',
  border: '1px solid var(--fg-ghost)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
};

const input: CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: 'var(--fg-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  lineHeight: 1.5,
  padding: '12px 14px',
  resize: 'none',
};

export function PromptBox() {
  const [value, setValue] = useState('');
  const status = useConfigStore((s) => s.status);
  const error = useConfigStore((s) => s.error);
  const renderMode = useConfigStore((s) => s.renderMode);
  const setTargetStyle = useConfigStore((s) => s.setTargetStyle);
  const setStatus = useConfigStore((s) => s.setStatus);
  const loading = status === 'loading';

  const submit = useCallback(async () => {
    const prompt = value.trim();
    if (!prompt || loading) return;
    setStatus('loading');
    try {
      const { currentStyle, analysis, signals } = useConfigStore.getState();
      const cfg = await requestConfig(prompt, currentStyle, analysis, signals);
      setTargetStyle(cfg, prompt);
      setValue('');
    } catch (e) {
      setStatus('error', (e as Error).message);
    }
  }, [value, loading, setStatus, setTargetStyle]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--fg-ghost)', background: 'var(--bg-base)' }}>
      <SectionLabel style={{ marginBottom: 8 }}>{renderMode === 'geometry-preview' ? 'Style Geometry' : 'Refine Style'}</SectionLabel>
      <div style={wrap}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder={renderMode === 'geometry-preview' ? 'choose geometry, then describe how it should feel…' : 'refine the current style…'}
          style={input}
          disabled={loading}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 10px 10px',
          }}
        >
          {loading ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: 'lcPulse 1s infinite',
                }}
              />
              translating vibe…
            </span>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>
              ⏎ to generate · ⇧⏎ for newline
            </span>
          )}
          <Button onClick={submit} disabled={loading || !value.trim()} size="sm">
            ✦ Generate
          </Button>
        </div>
      </div>

      {status === 'error' && error && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            background: 'rgba(168,64,48,0.08)',
            color: 'var(--signal-red)',
            fontSize: 11.5,
            borderRadius: 'var(--r-sm)',
            border: '1px solid rgba(168,64,48,0.2)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setValue(s)}
            disabled={loading}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 'var(--r-full)',
              border: '1px solid var(--fg-ghost)',
              background: 'var(--bg-overlay)',
              color: 'var(--fg-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
