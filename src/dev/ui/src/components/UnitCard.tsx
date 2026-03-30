import { Link } from 'react-router-dom';
import { EnforcementBadge } from './EnforcementBadge';
import { ScoreBar } from './ScoreBar';
import type { KnowledgeUnit } from '../api';

export function UnitCard({ unit }: { unit: KnowledgeUnit }) {
  return (
    <Link
      to={`/units/${encodeURIComponent(unit.id)}`}
      className="block group no-underline"
    >
      <article className="py-5 border-b border-border-card">
        {/* Overline: domain / kind */}
        <div className="flex items-center gap-3 mb-2">
          <span className="type-overline">{unit.domain}</span>
          <span className="type-overline text-text-faint">/</span>
          <span className="type-overline">{unit.kind}</span>
          {unit.brand && (
            <>
              <span className="type-overline text-text-faint">/</span>
              <span className="type-overline">{unit.brand}</span>
            </>
          )}
          <span className="ml-auto"><EnforcementBadge level={unit.enforcement} /></span>
        </div>

        {/* Title */}
        <h3 className="type-title mb-1.5">{unit.title}</h3>

        {/* Tags */}
        {unit.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unit.tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="type-overline px-2 py-0.5 rounded-pill bg-background-muted text-text-faint text-[0.5625rem] tracking-[0.05em]"
              >
                {t}
              </span>
            ))}
            {unit.tags.length > 5 && (
              <span className="type-overline text-text-faint py-0.5">
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
