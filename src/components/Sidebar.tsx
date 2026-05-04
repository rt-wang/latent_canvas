const NAV = [
  { label: 'Live Render', icon: '⊙', active: true },
  { label: 'Timeline',    icon: '▤', active: false, soon: true },
  { label: 'Presets',     icon: '⊞', active: false, soon: true },
  { label: 'Gallery',     icon: '⊟', active: false, soon: true },
  { label: 'Audio',       icon: '♪', active: false, soon: true },
  { label: 'Saved Vibes', icon: '♡', active: false, soon: true },
  { label: 'Settings',    icon: '⚙', active: false, soon: true },
];

export function Sidebar() {
  return (
    <aside
      style={{
        width: 180,
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 10,
          }}
        >
          ✦
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--fg-on-dark-active)',
            letterSpacing: '0.04em',
          }}
        >
          LATENT CANVAS
        </span>
      </div>

      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map((item) => (
          <div
            key={item.label}
            title={item.soon ? 'Coming in a later phase' : undefined}
            style={{
              padding: '7px 10px',
              borderRadius: 'var(--r-md)',
              cursor: item.active ? 'pointer' : 'default',
              background: item.active ? 'var(--bg-sidebar-active)' : 'transparent',
              color: item.active ? 'var(--fg-on-dark-active)' : 'var(--fg-on-dark-muted)',
              fontSize: 12.5,
              fontWeight: item.active ? 500 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              opacity: item.soon ? 0.55 : 1,
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#4a5a3a',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'var(--fg-on-dark-active)',
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-on-dark-active)', fontWeight: 500 }}>Aria Studio</div>
          <div style={{ fontSize: 10, color: 'var(--fg-on-dark-muted)' }}>Creator</div>
        </div>
      </div>
    </aside>
  );
}
