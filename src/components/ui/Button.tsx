import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
type Size = 'sm' | 'md';

const base: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 500,
  borderRadius: 'var(--r-md)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'background 0.12s, border-color 0.12s, opacity 0.12s',
  whiteSpace: 'nowrap',
};

const sizes: Record<Size, CSSProperties> = {
  sm: { padding: '4px 12px', fontSize: 11 },
  md: { padding: '7px 14px', fontSize: 12.5 },
};

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: '0 1px 3px rgba(40,60,30,0.25)',
  },
  secondary: {
    background: 'var(--bg-overlay)',
    color: 'var(--fg-primary)',
    border: '1px solid var(--fg-ghost)',
    boxShadow: 'var(--shadow-sm)',
    fontWeight: 400,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--fg-secondary)',
    border: '1px solid var(--fg-ghost)',
    fontWeight: 400,
  },
  icon: {
    background: 'var(--bg-overlay)',
    color: 'var(--fg-secondary)',
    border: '1px solid var(--fg-ghost)',
    boxShadow: 'var(--shadow-sm)',
    width: 28,
    height: 28,
    padding: 0,
    fontSize: 13,
  },
  danger: {
    background: 'transparent',
    color: 'var(--signal-red)',
    border: '1px solid var(--signal-red)',
    fontWeight: 400,
  },
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = 'primary', size = 'md', style, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...base,
        ...sizes[size],
        ...variants[variant],
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
        ...style,
      }}
    />
  );
}
