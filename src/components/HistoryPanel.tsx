import { useConfigStore } from '../state/useConfigStore';
import { HistoryItemRow } from './HistoryItem';
import { SectionLabel } from './ui/Label';
import { Button } from './ui/Button';

export function HistoryPanel() {
  const history = useConfigStore((s) => s.history);
  const activeId = useConfigStore((s) => s.activeHistoryId);
  const select = useConfigStore((s) => s.selectHistory);
  const clear = useConfigStore((s) => s.clearHistory);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 10px' }}>
      <div
        style={{
          padding: '0 4px',
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <SectionLabel>Recent Vibes</SectionLabel>
        {history.length > 0 && (
          <button
            onClick={clear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            CLEAR
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div
          style={{
            padding: '16px 10px',
            color: 'var(--fg-muted)',
            fontSize: 12,
            textAlign: 'center',
            border: '1px dashed var(--fg-ghost)',
            borderRadius: 'var(--r-md)',
          }}
        >
          Generated vibes will appear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {history.map((item) => (
            <HistoryItemRow key={item.id} item={item} active={item.id === activeId} onClick={() => select(item.id)} />
          ))}
        </div>
      )}
      {history.length > 0 && (
        <Button variant="ghost" size="sm" style={{ width: '100%', marginTop: 10 }}>
          View All
        </Button>
      )}
    </div>
  );
}
