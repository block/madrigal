import { useEffect, useState, useCallback, useRef } from 'react';
import {
  api,
  type ConfigResponse,
  type CoverageResponse,
  type CoverageDomain,
  type StatsResponse,
  type KnowledgeUnit,
} from '../api';
import { LayerCard } from '../components/LayerCard';
import { FilterBar } from '../components/FilterBar';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const DOMAIN_COLORS: Record<string, string> = {
  voice: '#4f8ff7',
  grammar: '#f59e0b',
  brand: '#ec4899',
  content: '#10b981',
  accessibility: '#8b5cf6',
  ux: '#6366f1',
  design: '#f97316',
};
const DEFAULT_DOMAIN_COLOR = '#94a3b8';

const ENFORCEMENT_ORDER = ['must', 'should', 'may', 'context', 'deprecated'];
const LIMIT = 200;

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain.toLowerCase()] ?? DEFAULT_DOMAIN_COLOR;
}

function packRows(domains: CoverageDomain[]): CoverageDomain[][] {
  if (domains.length === 0) return [];
  const sorted = [...domains].sort((a, b) => b.count - a.count);
  const totalCount = sorted.reduce((s, d) => s + d.count, 0);
  const targetRowCount = Math.max(totalCount / Math.max(Math.ceil(sorted.length / 4), 1), 1);

  const rows: CoverageDomain[][] = [];
  let currentRow: CoverageDomain[] = [];
  let currentSum = 0;

  for (const d of sorted) {
    currentRow.push(d);
    currentSum += Math.max(d.count, 1);
    if (currentSum >= targetRowCount && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentSum = 0;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

export function Layers() {
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [units, setUnits] = useState<KnowledgeUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({
    domain: '',
    kind: '',
    enforcement: '',
    brand: '',
    search: '',
  });

  const browserRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.getCoverage().then(setCoverage);
    api.getConfig().then(setConfig);
    api.getStats().then(setStats);
  }, []);

  useEffect(load, [load]);

  const fetchUnits = useCallback(async () => {
    const params: Record<string, string> = {
      limit: String(LIMIT),
      offset: String(offset),
    };
    if (filters.domain) params.domain = filters.domain;
    if (filters.kind) params.kind = filters.kind;
    if (filters.enforcement) params.enforcement = filters.enforcement;
    if (filters.brand) params.brand = filters.brand;
    if (filters.search) params.search = filters.search;

    const res = await api.getUnits(params);
    setUnits(res.units);
    setTotal(res.total);
  }, [filters, offset]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const reload = async () => {
    setReloading(true);
    await api.reload();
    load();
    await fetchUnits();
    setReloading(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const scrollToBrowser = (domain?: string) => {
    if (domain) {
      handleFilterChange('domain', domain);
    }
    setTimeout(() => {
      browserRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!coverage || !config || !stats) {
    return <p className="type-caption">Loading...</p>;
  }

  const { validation } = config;
  const hasActiveFilter =
    filters.domain || filters.kind || filters.enforcement || filters.brand || filters.search;

  const rows = packRows(coverage.domains);

  const groupedUnits: Record<string, KnowledgeUnit[]> = {};
  for (const level of ENFORCEMENT_ORDER) {
    groupedUnits[level] = [];
  }
  for (const u of units) {
    const key = ENFORCEMENT_ORDER.includes(u.enforcement) ? u.enforcement : 'context';
    if (!groupedUnits[key]) groupedUnits[key] = [];
    groupedUnits[key].push(u);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      {/* Page header */}
      <header className="mb-14">
        <div className="flex items-end justify-between mb-4">
          <p className="type-overline">Intelligence</p>
          <Button onClick={reload} disabled={reloading}>
            {reloading ? 'Reloading...' : 'Reload'}
          </Button>
        </div>
        <h1 className="type-display">Layers</h1>
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

      {/* Section A: Layer Map */}
      <section className="mb-16">
        <p className="type-overline mb-4">Coverage</p>
        <h2 className="type-section mb-4">Layer Map</h2>

        <div className="flex items-center gap-8 mb-8">
          <div>
            <span className="type-stat">{coverage.totalDomains}</span>
            <span className="type-overline ml-2">layers</span>
          </div>
          <div>
            <span className="type-stat text-2xl">{coverage.totalLayers}</span>
            <span className="type-overline ml-2">directives</span>
          </div>
          <div>
            <span className="type-mono text-text-faint">{coverage.governedDomains} of {coverage.totalDomains} governed</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((row, ri) => (
            <div
              key={ri}
              className="grid gap-2"
              style={{
                gridTemplateColumns: row
                  .map((d) => `${Math.max(d.count, 1)}fr`)
                  .join(' '),
              }}
            >
              {row.map((d) => {
                const color = domainColor(d.domain);
                const isSparse = d.count === 0;
                return (
                  <button
                    key={d.domain}
                    onClick={() => scrollToBrowser(d.domain)}
                    className="text-left p-4 rounded-card-sm transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer"
                    style={{
                      backgroundColor: `${color}12`,
                      border: isSparse
                        ? `1px dashed ${color}40`
                        : `1px solid ${color}30`,
                      minHeight: '100px',
                    }}
                  >
                    <p className="type-overline mb-1" style={{ color }}>
                      {d.domain}
                    </p>
                    <p className="type-stat text-text-default text-2xl mb-2">{d.count}</p>

                    {d.count > 0 && (
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                        {ENFORCEMENT_ORDER.map((level) => {
                          const n = d.byEnforcement[level];
                          if (!n) return null;
                          return (
                            <div
                              key={level}
                              className="h-full"
                              style={{
                                flex: n,
                                backgroundColor: `var(--enforcement-${level}-text)`,
                                opacity: 0.8,
                              }}
                              title={`${level}: ${n}`}
                            />
                          );
                        })}
                      </div>
                    )}

                    {d.description && (
                      <p className="type-caption text-text-faint mt-2 line-clamp-1">
                        {d.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <Separator className="mb-16" />

      {/* Section B: Layer Browser */}
      <section ref={browserRef}>
        <p className="type-overline mb-4">Browse</p>
        <h2 className="type-section mb-8">Directives</h2>

        <div className="mb-10">
          <FilterBar
            domains={stats.domains}
            kinds={Object.keys(stats.byKind)}
            enforcements={Object.keys(stats.byEnforcement)}
            brands={stats.brands}
            filters={filters}
            onChange={handleFilterChange}
          />
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <p className="type-overline">{total} directives</p>
          {totalPages > 1 && (
            <p className="type-overline text-text-faint">
              Page {currentPage} of {totalPages}
            </p>
          )}
        </div>
        <Separator className="mb-0" />

        {hasActiveFilter ? (
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
            {units.map((u) => (
              <LayerCard key={u.id} unit={u} />
            ))}
          </div>
        ) : (
          <div>
            {ENFORCEMENT_ORDER.filter((level) => groupedUnits[level]?.length > 0).map(
              (level) => {
                const group = groupedUnits[level];
                const isCollapsed = collapsed[level];
                return (
                  <div key={level} className="mb-6">
                    <button
                      onClick={() => toggleGroup(level)}
                      className="flex items-center gap-3 py-4 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <span
                        className="type-caption text-text-faint select-none transition-transform"
                        style={{
                          display: 'inline-block',
                          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        }}
                      >
                        ▼
                      </span>
                      <EnforcementBadge level={level} />
                      <span className="type-mono text-text-faint">{group.length}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
                        {group.map((u) => (
                          <LayerCard key={u.id} unit={u} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-4 justify-center pt-10">
            <Button
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <span className="type-overline text-text-faint">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
