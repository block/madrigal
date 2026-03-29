import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsResponse, type ResolveResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--text-secondary)',
  fontSize: '0.8125rem',
  height: 36,
  padding: '0 14px',
  paddingRight: 28,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};

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
    <div>
      {/* Page header */}
      <header className="mb-10">
        <p className="type-overline mb-3">Resolution</p>
        <h1 className="type-display">Brands</h1>
      </header>

      {/* Controls */}
      <section className="mb-8">
        <div className="flex gap-3 items-center">
          {stats && (
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="focus:outline-none"
              style={selectStyle}
            >
              <option value="">Select brand...</option>
              {stats.brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 type-caption" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={overriddenOnly}
              onChange={(e) => setOverriddenOnly(e.target.checked)}
              style={{ accentColor: 'var(--text-muted)' }}
            />
            Overridden only
          </label>
        </div>
      </section>

      {loading && <p className="type-caption">Loading...</p>}

      {data && !loading && (
        <section>
          <div className="flex items-baseline gap-6 mb-2">
            <p className="type-overline">{filteredUnits.length} of {data.total} units</p>
            {overriddenOnly && (
              <p className="type-mono" style={{ color: 'var(--text-faint)' }}>
                {data.units.filter((u) => u._overridden).length} overridden
              </p>
            )}
          </div>
          <hr className="rule mb-0" />

          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                <th className="type-overline text-left py-3 font-normal">Title</th>
                <th className="type-overline text-left py-3 font-normal">Domain</th>
                <th className="type-overline text-left py-3 font-normal">Base</th>
                <th className="type-overline text-left py-3 font-normal">Resolved</th>
                <th className="type-overline text-left py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="py-3">
                    <Link
                      to={`/units/${encodeURIComponent(u.id)}`}
                      className="type-body"
                      style={{
                        color: 'var(--text)',
                        fontWeight: 500,
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                        textDecorationColor: 'var(--border)',
                      }}
                    >
                      {u.title}
                    </Link>
                  </td>
                  <td className="type-caption py-3">{u.domain}</td>
                  <td className="py-3"><EnforcementBadge level={u._baseEnforcement} /></td>
                  <td className="py-3"><EnforcementBadge level={u.enforcement} /></td>
                  <td className="py-3">
                    {u._overridden ? (
                      <span className="type-overline" style={{ color: 'var(--enforcement-should-text)' }}>
                        Overridden
                      </span>
                    ) : (
                      <span className="type-overline" style={{ color: 'var(--text-faint)' }}>
                        Inherited
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!brand && !loading && (
        <p className="type-caption mt-6">Select a brand to view resolution.</p>
      )}
    </div>
  );
}
