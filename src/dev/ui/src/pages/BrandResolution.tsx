import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsResponse, type ResolveResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';

export function BrandResolution() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [brand, setBrand] = useState('');
  const [data, setData] = useState<ResolveResponse | null>(null);
  const [overriddenOnly, setOverriddenOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  useEffect(() => {
    if (!brand) { setData(null); return; }
    setLoading(true);
    api.resolve(brand).then((r) => { setData(r); setLoading(false); });
  }, [brand]);

  const filteredUnits = data
    ? overriddenOnly
      ? data.units.filter((u) => u._overridden)
      : data.units
    : [];

  return (
    <div className="space-y-5 max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Brand Resolution</h2>

      <div className="flex gap-3 items-center">
        {stats && (
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
          >
            <option value="">Select brand…</option>
            {stats.brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={overriddenOnly}
            onChange={(e) => setOverriddenOnly(e.target.checked)}
            className="rounded bg-zinc-800 border-zinc-600"
          />
          Overridden only
        </label>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading…</p>}

      {data && !loading && (
        <>
          <p className="text-sm text-zinc-500">
            {filteredUnits.length} of {data.total} unit(s)
            {overriddenOnly && ` (${data.units.filter((u) => u._overridden).length} overridden)`}
          </p>

          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left bg-zinc-900/50">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Base</th>
                  <th className="px-4 py-3 font-medium">Resolved</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((u) => (
                  <tr key={u.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/30">
                    <td className="px-4 py-3">
                      <Link to={`/units/${encodeURIComponent(u.id)}`} className="text-violet-400 hover:text-violet-300">
                        {u.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{u.domain}</td>
                    <td className="px-4 py-3"><EnforcementBadge level={u._baseEnforcement} /></td>
                    <td className="px-4 py-3"><EnforcementBadge level={u.enforcement} /></td>
                    <td className="px-4 py-3">
                      {u._overridden ? (
                        <span className="text-xs text-amber-400 font-medium">overridden</span>
                      ) : (
                        <span className="text-xs text-zinc-600">inherited</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!brand && !loading && (
        <p className="text-zinc-500 text-sm">Select a brand to view resolution.</p>
      )}
    </div>
  );
}
