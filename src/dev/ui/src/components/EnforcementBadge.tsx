const colors: Record<string, string> = {
  must: 'bg-red-500/15 text-red-400 border-red-500/30',
  should: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  may: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  context: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  deprecated: 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30',
};

export function EnforcementBadge({ level }: { level: string }) {
  const cls = colors[level] || colors.context;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${cls}`}>
      {level.toUpperCase()}
    </span>
  );
}
