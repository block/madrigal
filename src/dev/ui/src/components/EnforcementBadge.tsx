const styles: Record<string, { bg: string; text: string; border: string; borderStyle?: string }> = {
  must: {
    bg: 'var(--enforcement-must-bg)',
    text: 'var(--enforcement-must-text)',
    border: 'var(--enforcement-must-border)',
  },
  should: {
    bg: 'var(--enforcement-should-bg)',
    text: 'var(--enforcement-should-text)',
    border: 'var(--enforcement-should-border)',
    borderStyle: 'dashed',
  },
  may: {
    bg: 'var(--enforcement-may-bg)',
    text: 'var(--enforcement-may-text)',
    border: 'var(--enforcement-may-border)',
    borderStyle: 'dotted',
  },
  context: {
    bg: 'var(--bg-muted)',
    text: 'var(--text-muted)',
    border: 'var(--border)',
  },
  deprecated: {
    bg: 'var(--bg-muted)',
    text: 'var(--text-faint)',
    border: 'var(--border)',
    borderStyle: 'dashed',
  },
};

export function EnforcementBadge({ level }: { level: string }) {
  const s = styles[level] || styles.context;
  return (
    <span
      className="inline-block shrink-0"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.625rem',
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        lineHeight: 1,
        padding: '4px 8px',
        background: s.bg,
        color: s.text,
        border: `1px ${s.borderStyle || 'solid'} ${s.border}`,
        borderRadius: 'var(--radius-pill)',
      }}
    >
      {level}
    </span>
  );
}
