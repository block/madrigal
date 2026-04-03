import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Canvas } from '@react-three/fiber';
import type { TopologyView, TopologyData, SemanticQueryResult } from '../topology/types';
import { CAMERA_POSITION, CAMERA_FOV, CAMERA_FLY_OFFSET, VIEW_DESCRIPTIONS } from '../topology/constants';
import useShortestPath from '../topology/useShortestPath';
import Scene from '../topology/Scene';
import NodeDetail from '../topology/NodeDetail';
import SearchOverlay from '../topology/SearchOverlay';

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

const VIEW_KEYS: Record<string, TopologyView> = { '1': 'centralized', '2': 'decentralized', '3': 'distributed' };
const VIEW_LABELS: Record<TopologyView, string> = { centralized: '1 centralized', decentralized: '2 decentralized', distributed: '3 distributed' };

type CameraTarget = { position: [number, number, number]; lookAt: [number, number, number] } | null;

function computeFlyTarget(data: TopologyData, nodeId: string, view: TopologyView): CameraTarget {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const pos = node.positions[view];
  return { position: [pos[0], pos[1], pos[2] + CAMERA_FLY_OFFSET], lookAt: [pos[0], pos[1], pos[2]] };
}

type TopoStatus = { generated: boolean; unitCount: number; generatedAt: string | null; embeddingModel: string | null };

function TopologyTab() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [status, setStatus] = useState<TopoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<TopologyView>('centralized');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pathMode, setPathMode] = useState(false);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [semanticQuery, setSemanticQuery] = useState<SemanticQueryResult | null>(null);

  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');

  const pathResult = useShortestPath(data?.edges ?? [], pathStart, pathEnd);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.topologyStatus();
        setStatus(s);
        if (s.generated) {
          const d = await api.topologyGet();
          setData(d);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api.topologyGenerate({ provider: provider || undefined, apiKey: apiKey || undefined });
      const d = await api.topologyGet();
      setData(d);
      const s = await api.topologyStatus();
      setStatus(s);
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = useCallback((id: string | null) => {
    if (pathMode && id) {
      if (!pathStart) { setPathStart(id); setSelectedId(id); }
      else if (id !== pathStart) { setPathEnd(id); setSelectedId(id); }
      if (data) setCameraTarget(computeFlyTarget(data, id, view));
      return;
    }
    setSelectedId(id);
    if (id && data) setCameraTarget(computeFlyTarget(data, id, view));
  }, [data, view, pathMode, pathStart]);

  const exitPathMode = useCallback(() => { setPathMode(false); setPathStart(null); setPathEnd(null); }, []);
  const enterPathMode = useCallback(() => { setPathMode(true); setPathStart(selectedId); setPathEnd(null); }, [selectedId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const newView = VIEW_KEYS[e.key];
    if (newView) {
      setView(newView);
      setSelectedId(null);
      exitPathMode();
      setCameraTarget({ position: CAMERA_POSITION, lookAt: [0, 0, 0] });
      return;
    }
    if (e.key === '/') { e.preventDefault(); setSearchOpen(true); return; }
    if (e.key === 'p') { pathMode ? exitPathMode() : enterPathMode(); return; }
    if (e.key === 'Escape') {
      if (searchOpen) setSearchOpen(false);
      else if (pathMode) exitPathMode();
      else { setSelectedId(null); setCameraTarget({ position: CAMERA_POSITION, lookAt: [0, 0, 0] }); }
    }
  }, [searchOpen, pathMode, exitPathMode, enterPathMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const pathStatus = useMemo(() => {
    if (!pathMode) return null;
    if (!pathStart) return 'path: select start node';
    if (!pathEnd) return 'path: select end node';
    if (pathResult) return `path: ${pathResult.length} nodes`;
    return 'path: no route found';
  }, [pathMode, pathStart, pathEnd, pathResult]);

  if (loading) return <p className="type-caption text-text-muted">Loading topology status...</p>;

  if (!data) {
    return (
      <div className="max-w-[500px] pt-8">
        <p className="type-body mb-6">
          Generate a 3D semantic topology of your directives. This computes embeddings,
          clusters directives into themes, and builds a navigable graph of relationships.
        </p>

        {status && (
          <div className="type-mono text-text-muted mb-4 p-3 bg-background-muted rounded-card-sm">
            {status.unitCount} directives available
          </div>
        )}

        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className="type-overline block mb-2">
              Embedding provider (optional — uses TF-IDF fallback if empty)
            </label>
            <Select value={provider || undefined} onValueChange={(v) => setProvider(v === '__none__' ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None (TF-IDF pseudo-embeddings)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (TF-IDF pseudo-embeddings)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="voyage">Voyage AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider && (
            <div>
              <label className="type-overline block mb-2">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <div className="type-mono text-[10px] text-text-faint mt-1">
                Key is sent to the server for embedding generation only, not stored.
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleGenerate} disabled={generating || (!!provider && !apiKey)}>
          {generating ? 'Generating topology...' : 'Generate Topology'}
        </Button>

        {error && (
          <div className="mt-4 p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-card overflow-hidden" style={{ height: '70vh', background: '#0a0a14' }}>
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => { if (!pathMode) setSelectedId(null); }}>
        <Scene
          data={data}
          view={view}
          selectedId={selectedId}
          onSelect={handleSelect}
          cameraTarget={cameraTarget}
          onCameraComplete={() => setCameraTarget(null)}
          highlightedPath={pathResult}
          semanticQuery={semanticQuery}
        />
      </Canvas>

      {searchOpen && (
        <SearchOverlay data={data} onSelect={(id) => handleSelect(id)} onClose={() => setSearchOpen(false)} onSemanticResult={setSemanticQuery} />
      )}

      <div className="absolute bottom-4 left-4 z-10 font-mono text-[11px] leading-relaxed select-none">
        {(['centralized', 'decentralized', 'distributed'] as TopologyView[]).map((v) => (
          <div key={v} style={{ color: view === v ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>
            {VIEW_LABELS[v]}
          </div>
        ))}
        <div className="mt-2 text-[9px] max-w-[200px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
          {VIEW_DESCRIPTIONS[view]}
        </div>
      </div>

      {pathStatus && (
        <div className="absolute top-4 left-4 z-10 font-mono text-[11px]" style={{ color: '#2dd4bf' }}>
          {pathStatus} <span style={{ color: 'rgba(255,255,255,0.3)' }}>[p to exit]</span>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-10 font-mono text-[11px] text-right leading-relaxed" style={{ color: 'rgba(255,255,255,0.15)' }}>
        <div>{data.metadata.nodeCount} directives / {data.metadata.edgeCount} connections</div>
        <div>{data.metadata.embeddingModel}</div>
        <div>/ search / p path</div>
      </div>

      {selectedId && (
        <NodeDetail
          data={data}
          selectedId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelectNode={handleSelect}
          onFindPath={enterPathMode}
          onOpenUnit={(id) => window.open(`/layers/${id}`, '_blank')}
          pathMode={pathMode}
        />
      )}
    </div>
  );
}

export function Layers() {
  const [activeTab, setActiveTab] = useState('map');
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [units, setUnits] = useState<KnowledgeUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
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
      <header className="mb-8">
        <h1 className="type-display">Layers</h1>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-10">
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="topology">Topology</TabsTrigger>
        </TabsList>

        <TabsContent value="topology">
          <TopologyTab />
        </TabsContent>

        <TabsContent value="map">

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

        </TabsContent>
      </Tabs>
    </div>
  );
}
