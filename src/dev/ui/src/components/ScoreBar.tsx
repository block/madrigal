export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-1 overflow-hidden"
        style={{ borderRadius: 'var(--radius-pill)', background: 'var(--bg-muted)' }}
      >
        <div
          className="h-full"
          style={{
            width: `${(score * 100).toFixed(1)}%`,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--text-faint)',
          }}
        />
      </div>
      <span className="type-mono" style={{ fontSize: '0.625rem', color: 'var(--text-faint)' }}>
        {score.toFixed(3)}
      </span>
    </div>
  );
}
