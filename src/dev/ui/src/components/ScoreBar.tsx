export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1 overflow-hidden rounded-pill bg-background-muted">
        <div
          className="h-full rounded-pill bg-text-faint"
          style={{ width: `${(score * 100).toFixed(1)}%` }}
        />
      </div>
      <span className="type-mono text-[0.625rem] text-text-faint">
        {score.toFixed(3)}
      </span>
    </div>
  );
}
