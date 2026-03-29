import ReactMarkdown from 'react-markdown';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-200 prose-p:text-zinc-300 prose-li:text-zinc-300 prose-code:text-violet-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-a:text-violet-400">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
