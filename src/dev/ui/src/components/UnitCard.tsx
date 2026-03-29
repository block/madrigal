import { Link } from 'react-router-dom';
import { EnforcementBadge } from './EnforcementBadge';
import { ScoreBar } from './ScoreBar';
import type { KnowledgeUnit } from '../api';

export function UnitCard({ unit }: { unit: KnowledgeUnit }) {
  return (
    <Link
      to={`/units/${encodeURIComponent(unit.id)}`}
      className="block border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-zinc-100 truncate">{unit.title}</h3>
          <p className="text-xs text-zinc-500 mt-1 truncate">
            {unit.domain} · {unit.kind}
            {unit.brand && <> · {unit.brand}</>}
          </p>
        </div>
        <EnforcementBadge level={unit.enforcement} />
      </div>
      {unit.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {unit.tags.slice(0, 5).map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {t}
            </span>
          ))}
          {unit.tags.length > 5 && (
            <span className="text-xs text-zinc-600">+{unit.tags.length - 5}</span>
          )}
        </div>
      )}
      {unit._score !== undefined && (
        <div className="mt-3">
          <ScoreBar score={unit._score} />
        </div>
      )}
    </Link>
  );
}
