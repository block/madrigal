import ReactMarkdown from 'react-markdown';

export function Markdown({ children }: { children: string }) {
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{
        '--tw-prose-body': 'var(--text-secondary)',
        '--tw-prose-headings': 'var(--text)',
        '--tw-prose-links': 'var(--text)',
        '--tw-prose-bold': 'var(--text)',
        '--tw-prose-code': 'var(--text-secondary)',
        '--tw-prose-pre-bg': 'var(--bg-subtle)',
        '--tw-prose-pre-code': 'var(--text-secondary)',
        '--tw-prose-bullets': 'var(--text-faint)',
        '--tw-prose-counters': 'var(--text-faint)',
        '--tw-prose-hr': 'var(--rule)',
        '--tw-prose-th-borders': 'var(--rule)',
        '--tw-prose-td-borders': 'var(--border-subtle)',
        fontFamily: 'var(--font-sans)',
        letterSpacing: '-0.006em',
      } as React.CSSProperties}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
