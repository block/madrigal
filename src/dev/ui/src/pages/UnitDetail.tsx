import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type UnitDetailResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { Markdown } from '../components/Markdown';

export function UnitDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UnitDetailResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getUnit(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-zinc-500">Loading…</p>;

  const { unit, brandResolutions } = data;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/explorer" className="text-sm text-violet-400 hover:text-violet-300">&larr; Back to Explorer</Link>

      <div>
        <div className="flex items-start gap-3">
          <h2 className="text-xl font-semibold text-white flex-1">{unit.title}</h2>
          <EnforcementBadge level={unit.enforcement} />
        </div>
        <p className="text-sm text-zinc-500 mt-1">{unit.id}</p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-sm border border-zinc-800 rounded-lg p-4">
        <div>
          <span className="text-zinc-500">Domain</span>
          <p className="text-zinc-200">{unit.domain}</p>
        </div>
        <div>
          <span className="text-zinc-500">Kind</span>
          <p className="text-zinc-200">{unit.kind}</p>
        </div>
        {unit.brand && (
          <div>
            <span className="text-zinc-500">Brand</span>
            <p className="text-zinc-200">{unit.brand}</p>
          </div>
        )}
        {unit.system && (
          <div>
            <span className="text-zinc-500">System</span>
            <p className="text-zinc-200">{unit.system}</p>
          </div>
        )}
        <div>
          <span className="text-zinc-500">Origin</span>
          <p className="text-zinc-200">{unit.provenance.origin} ({unit.provenance.confidence})</p>
        </div>
        <div>
          <span className="text-zinc-500">Tags</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {unit.tags.map((t) => (
              <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="border border-zinc-800 rounded-lg p-5">
        <Markdown>{unit.body}</Markdown>
      </div>

      {/* Brand resolution table */}
      {Object.keys(brandResolutions).length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Brand Resolution</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-left">
                <th className="pb-2 font-medium">Brand</th>
                <th className="pb-2 font-medium">Enforcement</th>
                <th className="pb-2 font-medium">Overridden</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(brandResolutions).map(([brand, res]) => (
                <tr key={brand} className="border-t border-zinc-800/50">
                  <td className="py-2 text-zinc-300">{brand}</td>
                  <td className="py-2"><EnforcementBadge level={res.enforcement} /></td>
                  <td className="py-2">
                    {res.overridden && (
                      <span className="text-xs text-amber-400">overridden</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
