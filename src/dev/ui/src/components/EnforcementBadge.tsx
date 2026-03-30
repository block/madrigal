import { cn } from '@/lib/utils';

const styles: Record<string, { bg: string; text: string; border: string; borderStyle?: string }> = {
  must: {
    bg: 'bg-[var(--enforcement-must-bg)]',
    text: 'text-[var(--enforcement-must-text)]',
    border: 'border-[var(--enforcement-must-border)]',
  },
  should: {
    bg: 'bg-[var(--enforcement-should-bg)]',
    text: 'text-[var(--enforcement-should-text)]',
    border: 'border-[var(--enforcement-should-border)]',
    borderStyle: 'border-dashed',
  },
  may: {
    bg: 'bg-[var(--enforcement-may-bg)]',
    text: 'text-[var(--enforcement-may-text)]',
    border: 'border-[var(--enforcement-may-border)]',
    borderStyle: 'border-dotted',
  },
  context: {
    bg: 'bg-background-muted',
    text: 'text-text-muted',
    border: 'border-border-default',
  },
  deprecated: {
    bg: 'bg-background-muted',
    text: 'text-text-faint',
    border: 'border-border-default',
    borderStyle: 'border-dashed',
  },
};

export function EnforcementBadge({ level }: { level: string }) {
  const s = styles[level] || styles.context;
  return (
    <span
      className={cn(
        'inline-block shrink-0 font-mono text-[0.625rem] font-medium tracking-[0.08em] uppercase leading-none px-2 py-1 rounded-pill border',
        s.bg, s.text, s.border, s.borderStyle,
      )}
    >
      {level}
    </span>
  );
}
