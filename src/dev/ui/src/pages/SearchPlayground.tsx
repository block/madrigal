import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsResponse, type SearchResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { ScoreBar } from '../components/ScoreBar';

export function SearchPlayground() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [brand, setBrand] = useState('');
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const res = await api.search({
      query,
      domain: domain || undefined,
      brand: brand || undefined,
      limit,
    });
    setResult(res);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch();
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <h2 className="text-xl font-semibold text-white">Search Playground</h2>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-64">
          <label className="block text-xs text-zinc-500 mb-1">Query</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. accessibility, button labels, error messages…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        {stats && (
          <>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Domain</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-2 text-sm text-zinc-300">
                <option value="">All</option>
                {stats.domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Brand</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-2 text-sm text-zinc-300">
                <option value="">All</option>
                {stats.brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Limit</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
            className="w-20 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-2 text-sm text-zinc-300"
          />
        </div>
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 text-sm rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>{result.total} result(s)</span>
            <span>{result.timing.ms}ms</span>
          </div>

          <div className="space-y-2">
            {result.results.map((r) => (
              <Link
                key={r.unit.id}
                to={`/units/${encodeURIComponent(r.unit.id)}`}
                className="block border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-100">{r.unit.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {r.unit.domain} · {r.unit.kind}
                      {r.unit.brand && <> · {r.unit.brand}</>}
                    </p>
                  </div>
                  <EnforcementBadge level={r.unit.enforcement} />
                </div>
                <div className="mt-3">
                  <ScoreBar score={r.score} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
