import type { HistoryItem as HItem } from '../state/useConfigStore';

function timeAgo(t: number) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function tintCss([r, g, b]: [number, number, number]) {
  return `rgb(${r}, ${g}, ${b})`;
}

export function HistoryItemRow({
  item,
  active,
  onClick,
}: {
  item: HItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: active ? 'var(--accent-light)' : 'transparent',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
      }}
    >
      <div
        style={{
          width: 32,
          height: 24,
          borderRadius: 'var(--r-sm)',
          flexShrink: 0,
          background: tintCss(item.style.palette.tint),
          border: '1px solid rgba(0,0,0,0.06)',
          opacity: 0.85,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: active ? 500 : 400,
            color: active ? 'var(--accent)' : 'var(--fg-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.prompt}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-muted)', marginTop: 1 }}>
          {timeAgo(item.createdAt)}
        </div>
      </div>
    </div>
  );
}
