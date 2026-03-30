import ReactMarkdown from 'react-markdown';

export function Markdown({ children }: { children: string }) {
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{
        '--tw-prose-body': 'var(--text-alt)',
        '--tw-prose-headings': 'var(--text-default)',
        '--tw-prose-links': 'var(--text-default)',
        '--tw-prose-bold': 'var(--text-default)',
        '--tw-prose-code': 'var(--text-alt)',
        '--tw-prose-pre-bg': 'var(--background-alt)',
        '--tw-prose-pre-code': 'var(--text-alt)',
        '--tw-prose-bullets': 'var(--text-faint)',
        '--tw-prose-counters': 'var(--text-faint)',
        '--tw-prose-hr': 'var(--border-default)',
        '--tw-prose-th-borders': 'var(--border-default)',
        '--tw-prose-td-borders': 'var(--border-card)',
        fontFamily: 'var(--font-sans)',
        letterSpacing: '-0.006em',
      } as React.CSSProperties}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
