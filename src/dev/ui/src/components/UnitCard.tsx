import { Link } from 'react-router-dom';
import { EnforcementBadge } from './EnforcementBadge';
import { ScoreBar } from './ScoreBar';
import type { KnowledgeUnit } from '../api';

export function UnitCard({ unit }: { unit: KnowledgeUnit }) {
  return (
    <Link
      to={`/units/${encodeURIComponent(unit.id)}`}
      className="block group"
      style={{ textDecoration: 'none' }}
    >
      <article
        className="py-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Overline: domain / kind */}
        <div className="flex items-center gap-3 mb-2">
          <span className="type-overline">{unit.domain}</span>
          <span className="type-overline" style={{ color: 'var(--text-faint)' }}>/</span>
          <span className="type-overline">{unit.kind}</span>
          {unit.brand && (
            <>
              <span className="type-overline" style={{ color: 'var(--text-faint)' }}>/</span>
              <span className="type-overline">{unit.brand}</span>
            </>
          )}
          <span className="ml-auto"><EnforcementBadge level={unit.enforcement} /></span>
        </div>

        {/* Title */}
        <h3 className="type-title" style={{ marginBottom: 6 }}>
          {unit.title}
        </h3>

        {/* Tags */}
        {unit.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unit.tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="type-overline px-2 py-0.5"
                style={{
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-muted)',
                  color: 'var(--text-faint)',
                  letterSpacing: '0.05em',
                  fontSize: '0.5625rem',
                }}
              >
                {t}
              </span>
            ))}
            {unit.tags.length > 5 && (
              <span className="type-overline" style={{ color: 'var(--text-faint)', padding: '2px 0' }}>
                +{unit.tags.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Score */}
        {unit._score !== undefined && (
          <div className="mt-3">
            <ScoreBar score={unit._score} />
          </div>
        )}
      </article>
    </Link>
  );
}
