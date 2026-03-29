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
    return <p className="text-zinc-500">Loading…</p>;
  }

  const { validation } = config;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Dashboard</h2>
        <button
          onClick={reload}
          disabled={reloading}
          className="px-3 py-1.5 text-sm rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
        >
          {reloading ? 'Reloading…' : 'Reload'}
        </button>
      </div>

      {/* Validation status */}
      {!validation.valid && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-400 mb-2">Validation Errors</h3>
          {validation.errors.map((e, i) => (
            <p key={i} className="text-sm text-red-300">{e.path}: {e.message}</p>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-400 mb-2">Warnings</h3>
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-300">{w.path}: {w.message}</p>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Units" value={stats.total} />
        <StatCard label="Domains" value={Object.keys(stats.byDomain).length} />
        <StatCard label="Brands" value={stats.brands.length} />
        <StatCard label="Platforms" value={stats.platforms.length} />
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-2 gap-6">
        <BreakdownTable title="By Domain" data={stats.byDomain} />
        <BreakdownTable
          title="By Enforcement"
          data={stats.byEnforcement}
          renderKey={(k) => <EnforcementBadge level={k} />}
        />
        <BreakdownTable title="By Kind" data={stats.byKind} />
        <BreakdownTable title="By Brand" data={stats.byBrand} />
      </div>

      {/* Config summary */}
      <div className="border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Configuration</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-500">Sources</dt>
          <dd className="text-zinc-300">{config.config.sources.join(', ')}</dd>
          <dt className="text-zinc-500">Domains</dt>
          <dd className="text-zinc-300">{Object.keys(config.config.domains).join(', ')}</dd>
          <dt className="text-zinc-500">Brands</dt>
          <dd className="text-zinc-300">{Object.keys(config.config.brands).join(', ')}</dd>
          <dt className="text-zinc-500">Platforms</dt>
          <dd className="text-zinc-300">{Object.keys(config.config.platforms).join(', ')}</dd>
        </dl>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
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
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">{title}</h3>
      <div className="space-y-1.5">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span>{renderKey ? renderKey(key) : <span className="text-zinc-400">{key}</span>}</span>
            <span className="text-zinc-500 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
