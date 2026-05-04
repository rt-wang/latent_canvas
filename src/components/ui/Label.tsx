import type { CSSProperties, ReactNode } from 'react';

export function SectionLabel({
  children,
  light,
  style,
}: {
  children: ReactNode;
  light?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9.5,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: light ? 'var(--fg-on-dark-muted)' : 'var(--fg-muted)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
