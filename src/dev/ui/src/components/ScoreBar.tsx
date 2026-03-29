export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500 tabular-nums w-10 text-right">{score.toFixed(3)}</span>
    </div>
  );
}
