import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsResponse, type SearchResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { ScoreBar } from '../components/ScoreBar';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--text-secondary)',
  fontSize: '0.8125rem',
  height: 36,
  padding: '0 14px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: 28,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};

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
    <div>
      {/* Page header */}
      <header className="mb-10">
        <p className="type-overline mb-3">Semantic</p>
        <h1 className="type-display">Search</h1>
      </header>

      {/* Controls */}
      <section className="mb-10">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-56">
            <label className="type-overline block mb-2">Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. accessibility, button labels, error messages..."
              className="w-full focus:outline-none"
              style={inputStyle}
            />
          </div>
          {stats && (
            <>
              <div>
                <label className="type-overline block mb-2">Domain</label>
                <select value={domain} onChange={(e) => setDomain(e.target.value)} className="focus:outline-none" style={selectStyle}>
                  <option value="">All</option>
                  {stats.domains.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="type-overline block mb-2">Brand</label>
                <select value={brand} onChange={(e) => setBrand(e.target.value)} className="focus:outline-none" style={selectStyle}>
                  <option value="">All</option>
                  {stats.brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="type-overline block mb-2">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              className="w-16 focus:outline-none"
              style={inputStyle}
            />
          </div>
          <button onClick={runSearch} disabled={loading || !query.trim()} className="btn btn-primary">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section>
          <div className="flex items-baseline gap-6 mb-2">
            <p className="type-overline">{result.total} results</p>
            <p className="type-mono" style={{ color: 'var(--text-faint)' }}>{result.timing.ms}ms</p>
          </div>
          <hr className="rule mb-0" />

          {result.results.map((r) => (
            <Link
              key={r.unit.id}
              to={`/units/${encodeURIComponent(r.unit.id)}`}
              className="block py-5"
              style={{ borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="type-overline">{r.unit.domain}</span>
                <span className="type-overline" style={{ color: 'var(--text-faint)' }}>/</span>
                <span className="type-overline">{r.unit.kind}</span>
                {r.unit.brand && (
                  <>
                    <span className="type-overline" style={{ color: 'var(--text-faint)' }}>/</span>
                    <span className="type-overline">{r.unit.brand}</span>
                  </>
                )}
                <span className="ml-auto"><EnforcementBadge level={r.unit.enforcement} /></span>
              </div>
              <h3 className="type-title mb-2">{r.unit.title}</h3>
              <ScoreBar score={r.score} />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
