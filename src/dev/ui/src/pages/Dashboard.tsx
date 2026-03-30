import { useEffect, useState } from 'react';
import { api, type ConfigResponse, type StatsResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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
      <header className="mb-14">
        <div className="flex items-end justify-between mb-4">
          <p className="type-overline">Overview</p>
          <Button onClick={reload} disabled={reloading}>
            {reloading ? 'Reloading...' : 'Reload'}
          </Button>
        </div>
        <h1 className="type-display">Dashboard</h1>
      </header>

      {/* Validation alerts */}
      {!validation.valid && (
        <section className="mb-12 p-5 rounded-card bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)]">
          <p className="type-overline mb-3 text-[var(--enforcement-must-text)]">Errors</p>
          {validation.errors.map((e, i) => (
            <p key={i} className="type-body text-[var(--enforcement-must-text)]">
              <span className="type-mono">{e.path}</span> {e.message}
            </p>
          ))}
        </section>
      )}
      {validation.warnings.length > 0 && (
        <section className="mb-12 p-5 rounded-card bg-[var(--enforcement-should-bg)] border border-[var(--enforcement-should-border)]">
          <p className="type-overline mb-3 text-[var(--enforcement-should-text)]">Warnings</p>
          {validation.warnings.map((w, i) => (
            <p key={i} className="type-body text-[var(--enforcement-should-text)]">
              <span className="type-mono">{w.path}</span> {w.message}
            </p>
          ))}
        </section>
      )}

      {/* Stats */}
      <section className="mb-16">
        <div className="grid grid-cols-4 gap-px bg-border-default rounded-card overflow-hidden">
          <StatCard label="Units" value={stats.total} />
          <StatCard label="Domains" value={Object.keys(stats.byDomain).length} />
          <StatCard label="Brands" value={stats.brands.length} />
          <StatCard label="Platforms" value={stats.platforms.length} />
        </div>
      </section>

      {/* Breakdowns */}
      <section className="mb-16">
        <p className="type-overline mb-4">Breakdowns</p>
        <h2 className="type-section mb-8">By category</h2>
        <Separator className="mb-10" />
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
        <p className="type-overline mb-4">Configuration</p>
        <h2 className="type-section mb-8">Sources & targets</h2>
        <Separator className="mb-8" />
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
    <div className="px-6 py-6 bg-background-default">
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
      <p className="type-title mb-4">{title}</p>
      <div>
        {entries.map(([key, count]) => (
          <div
            key={key}
            className="flex items-center justify-between py-2 border-b border-border-card"
          >
            <span>{renderKey ? renderKey(key) : <span className="type-body">{key}</span>}</span>
            <span className="type-mono text-text-faint">{count}</span>
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
