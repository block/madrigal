import { useEffect, useState } from 'react';
import { api, type ConfigResponse, type StatsResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';

export function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [reloading, setReloading] = useState(false);

  const load = () => {
    api.getStats().then(setStats);
    api.getConfig().then(setConfig);
  };

  useEffect(load, []);

  const reload = async () => {
    setReloading(true);
    await api.reload();
    load();
    setReloading(false);
  };

  if (!stats || !config) {
    return <p className="type-caption">Loading...</p>;
  }

  const { validation } = config;

  return (
    <div>
      {/* Page header */}
      <header className="mb-12">
        <div className="flex items-end justify-between mb-3">
          <p className="type-overline">Overview</p>
          <button onClick={reload} disabled={reloading} className="btn btn-primary">
            {reloading ? 'Reloading...' : 'Reload'}
          </button>
        </div>
        <h1 className="type-display">Dashboard</h1>
      </header>

      {/* Validation alerts */}
      {!validation.valid && (
        <section className="mb-10 p-5" style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--enforcement-must-bg)',
          border: '1px solid var(--enforcement-must-border)',
        }}>
          <p className="type-overline mb-3" style={{ color: 'var(--enforcement-must-text)' }}>Errors</p>
          {validation.errors.map((e, i) => (
            <p key={i} className="type-body" style={{ color: 'var(--enforcement-must-text)' }}>
              <span className="type-mono">{e.path}</span> {e.message}
            </p>
          ))}
        </section>
      )}
      {validation.warnings.length > 0 && (
        <section className="mb-10 p-5" style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--enforcement-should-bg)',
          border: '1px solid var(--enforcement-should-border)',
        }}>
          <p className="type-overline mb-3" style={{ color: 'var(--enforcement-should-text)' }}>Warnings</p>
          {validation.warnings.map((w, i) => (
            <p key={i} className="type-body" style={{ color: 'var(--enforcement-should-text)' }}>
              <span className="type-mono">{w.path}</span> {w.message}
            </p>
          ))}
        </section>
      )}

      {/* Stats — large editorial numbers */}
      <section className="mb-14">
        <div className="grid grid-cols-4 gap-px" style={{ background: 'var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <StatCard label="Units" value={stats.total} />
          <StatCard label="Domains" value={Object.keys(stats.byDomain).length} />
          <StatCard label="Brands" value={stats.brands.length} />
          <StatCard label="Platforms" value={stats.platforms.length} />
        </div>
      </section>

      {/* Breakdowns */}
      <section className="mb-14">
        <p className="type-overline mb-6">Breakdowns</p>
        <hr className="rule mb-8" />
        <div className="grid grid-cols-2 gap-x-12 gap-y-10">
          <BreakdownTable title="Domain" data={stats.byDomain} />
          <BreakdownTable
            title="Enforcement"
            data={stats.byEnforcement}
            renderKey={(k) => <EnforcementBadge level={k} />}
          />
          <BreakdownTable title="Kind" data={stats.byKind} />
          <BreakdownTable title="Brand" data={stats.byBrand} />
        </div>
      </section>

      {/* Configuration */}
      <section>
        <p className="type-overline mb-6">Configuration</p>
        <hr className="rule mb-6" />
        <dl className="grid grid-cols-[120px_1fr] gap-y-4">
          <ConfigRow label="Sources" value={config.config.sources.join(', ')} />
          <ConfigRow label="Domains" value={Object.keys(config.config.domains).join(', ')} />
          <ConfigRow label="Brands" value={Object.keys(config.config.brands).join(', ')} />
          <ConfigRow label="Platforms" value={Object.keys(config.config.platforms).join(', ')} />
        </dl>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-6 py-6" style={{ background: 'var(--bg)' }}>
      <p className="type-stat">{value}</p>
      <p className="type-overline mt-2">{label}</p>
    </div>
  );
}

function BreakdownTable({
  title,
  data,
  renderKey,
}: {
  title: string;
  data: Record<string, number>;
  renderKey?: (key: string) => React.ReactNode;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="type-overline mb-4" style={{ color: 'var(--text-faint)' }}>{title}</p>
      <div>
        {entries.map(([key, count]) => (
          <div
            key={key}
            className="flex items-center justify-between py-2"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span>{renderKey ? renderKey(key) : <span className="type-body">{key}</span>}</span>
            <span className="type-mono" style={{ color: 'var(--text-faint)' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="type-overline pt-0.5">{label}</dt>
      <dd className="type-body">{value}</dd>
    </>
  );
}
