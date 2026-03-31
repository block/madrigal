import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type StatsResponse,
  type StudioActivateResponse,
  type BuildResult,
  type PipelineResult,
  type ResolveResponse,
  type ComplianceViolationDTO,
} from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { ScoreBar } from '../components/ScoreBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const ENFORCEMENT_ORDER: Record<string, number> = { must: 0, should: 1, may: 2, context: 3 };

export function Studio() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [content, setContent] = useState('');
  const [domain, setDomain] = useState('');
  const [brand, setBrand] = useState('');
  const [activateResult, setActivateResult] = useState<StudioActivateResponse | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    setActivateResult(null);
    try {
      const res = await api.studioActivate({
        content,
        brand: brand || undefined,
        domain: domain || undefined,
      });
      setActivateResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setActivating(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <p className="type-overline mb-4">Compose</p>
        <h1 className="type-display">Studio</h1>
        <p className="type-body text-text-muted mt-2">
          Test content against your intelligence layers. See which directives activate, how they resolve, and what gets compiled.
        </p>
      </header>

      <section className="mb-8 space-y-4">
        <textarea
          className="w-full min-h-[160px] border border-border-input rounded-md px-3 py-2 text-sm bg-background-default text-text-default placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste content to test against your intelligence layers and see which directives activate..."
        />

        <div className="flex gap-3 items-end flex-wrap">
          <div className="w-40">
            <label className="type-overline block mb-2">Domain</label>
            <Select value={domain || undefined} onValueChange={(v) => setDomain(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {stats?.domains.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <label className="type-overline block mb-2">Brand</label>
            <Select value={brand || undefined} onValueChange={(v) => setBrand(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {stats?.brands.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleActivate} disabled={activating || !content.trim()}>
            {activating ? 'Activating...' : 'Activate'}
          </Button>
        </div>
      </section>

      {error && (
        <div className="mb-6 p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
          {error}
        </div>
      )}

      <Tabs defaultValue="layers">
        <TabsList>
          <TabsTrigger value="layers">Directives</TabsTrigger>
          <TabsTrigger value="compiled">Compiled</TabsTrigger>
          <TabsTrigger value="resolution">Resolution</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
        </TabsList>

        <TabsContent value="layers" className="mt-6">
          <LayersTab result={activateResult} />
        </TabsContent>

        <TabsContent value="compiled" className="mt-6">
          <CompiledTab stats={stats} />
        </TabsContent>

        <TabsContent value="resolution" className="mt-6">
          <ResolutionTab stats={stats} />
        </TabsContent>

        <TabsContent value="build" className="mt-6">
          <BuildTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── Layers Tab ──────────────────────────────────────────────

function LayersTab({ result }: { result: StudioActivateResponse | null }) {
  if (!result) {
    return <p className="type-caption text-text-muted">Activate content above to see which directives fire.</p>;
  }

  const { compliance, layers, timing } = result;

  const violationIds = new Set(compliance.violations.map((v) => v.unitId));
  const warningIds = new Set(compliance.warnings.map((v) => v.unitId));

  const sorted = [...layers].sort((a, b) => {
    const ea = ENFORCEMENT_ORDER[a.unit.enforcement] ?? 99;
    const eb = ENFORCEMENT_ORDER[b.unit.enforcement] ?? 99;
    if (ea !== eb) return ea - eb;
    return b.score - a.score;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-semibold ${
            compliance.passed
              ? 'bg-[var(--enforcement-may-bg)] text-[var(--enforcement-may-text)] border border-[var(--enforcement-may-border)]'
              : 'bg-[var(--enforcement-must-bg)] text-[var(--enforcement-must-text)] border border-[var(--enforcement-must-border)]'
          }`}
        >
          {compliance.passed ? 'PASSED' : 'FAILED'}
        </div>
        <span className="text-sm text-text-muted">
          {layers.length} directive{layers.length !== 1 ? 's' : ''} activated in {timing.ms}ms
        </span>
      </div>

      <div className="flex gap-4 text-xs text-text-muted">
        <span>{compliance.violations.length} violation{compliance.violations.length !== 1 ? 's' : ''}</span>
        <span>{compliance.warnings.length} warning{compliance.warnings.length !== 1 ? 's' : ''}</span>
        <span>{compliance.info.length} info</span>
      </div>

      <Separator />

      <div className="space-y-2">
        {sorted.map(({ unit, score }) => (
          <div key={unit.id} className="flex items-center gap-3 py-2 border-b border-border-card last:border-0">
            {violationIds.has(unit.id) && (
              <span className="w-2 h-2 rounded-full bg-[var(--enforcement-must-text)] shrink-0" />
            )}
            {warningIds.has(unit.id) && !violationIds.has(unit.id) && (
              <span className="w-2 h-2 rounded-full bg-[var(--enforcement-should-text)] shrink-0" />
            )}
            {!violationIds.has(unit.id) && !warningIds.has(unit.id) && (
              <span className="w-2 h-2 shrink-0" />
            )}
            <Link
              to={`/layers/${encodeURIComponent(unit.id)}`}
              className="text-sm text-text-default font-medium hover:underline min-w-0 truncate"
            >
              {unit.title}
            </Link>
            <EnforcementBadge level={unit.enforcement} />
            <span className="type-caption text-text-faint shrink-0">{unit.domain}</span>
            <div className="w-24 shrink-0 ml-auto">
              <ScoreBar score={score} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Compiled Tab ────────────────────────────────────────────

function CompiledTab({ stats }: { stats: StatsResponse | null }) {
  const [platform, setPlatform] = useState('');
  const [brand, setBrand] = useState('');
  const [results, setResults] = useState<BuildResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!platform) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.buildPreview(platform, brand || undefined);
      setResults(res.results);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-end flex-wrap">
        <div className="w-48">
          <label className="type-overline block mb-2">Platform</label>
          <Select value={platform || undefined} onValueChange={(v) => setPlatform(v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select platform..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select platform...</SelectItem>
              {stats?.platforms.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="type-overline block mb-2">Brand</label>
          <Select value={brand || undefined} onValueChange={(v) => setBrand(v === '__all__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {stats?.brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handlePreview} disabled={loading || !platform}>
          {loading ? 'Loading...' : 'Preview'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <ResultPanel key={i} result={r} />
          ))}
          {results.length === 0 && (
            <p className="type-caption text-text-muted">No results for this platform.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Resolution Tab ──────────────────────────────────────────

function ResolutionTab({ stats }: { stats: StatsResponse | null }) {
  const [brand, setBrand] = useState('');
  const [overriddenOnly, setOverriddenOnly] = useState(false);
  const [data, setData] = useState<ResolveResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <div className="w-48">
          <label className="type-overline block mb-2">Brand</label>
          <Select value={brand || undefined} onValueChange={(v) => setBrand(v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select brand..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select brand...</SelectItem>
              {stats?.brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer mt-6">
            <input
              type="checkbox"
              checked={overriddenOnly}
              onChange={(e) => setOverriddenOnly(e.target.checked)}
              className="accent-text-muted"
            />
            Overridden only
          </label>
        </div>
      </div>

      {loading && <p className="type-caption text-text-muted">Loading...</p>}

      {!brand && !loading && (
        <p className="type-caption text-text-muted">Select a brand to view resolution.</p>
      )}

      {data && !loading && (
        <>
          <p className="type-mono text-text-faint text-xs">{filteredUnits.length} of {data.total} units</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="type-overline font-normal">Title</TableHead>
                <TableHead className="type-overline font-normal">Domain</TableHead>
                <TableHead className="type-overline font-normal">Base</TableHead>
                <TableHead className="type-overline font-normal">Resolved</TableHead>
                <TableHead className="type-overline font-normal">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      to={`/layers/${encodeURIComponent(u.id)}`}
                      className="type-body text-text-default font-medium underline underline-offset-[3px] decoration-border-default"
                    >
                      {u.title}
                    </Link>
                  </TableCell>
                  <TableCell className="type-caption">{u.domain}</TableCell>
                  <TableCell><EnforcementBadge level={u._baseEnforcement} /></TableCell>
                  <TableCell><EnforcementBadge level={u.enforcement} /></TableCell>
                  <TableCell>
                    {u._overridden ? (
                      <span className="type-overline text-[var(--enforcement-should-text)]">Overridden</span>
                    ) : (
                      <span className="type-overline text-text-faint">Inherited</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

// ─── Build Tab ───────────────────────────────────────────────

function BuildTab() {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBuild = async (dryRun: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.build(dryRun);
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => runBuild(true)} disabled={loading}>
          {loading ? 'Running...' : 'Dry Run'}
        </Button>
        <Button onClick={() => runBuild(false)} disabled={loading}>
          {loading ? 'Building...' : 'Build All'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-semibold ${
                result.success
                  ? 'bg-[var(--enforcement-may-bg)] text-[var(--enforcement-may-text)] border border-[var(--enforcement-may-border)]'
                  : 'bg-[var(--enforcement-must-bg)] text-[var(--enforcement-must-text)] border border-[var(--enforcement-must-border)]'
              }`}
            >
              {result.success ? 'SUCCEEDED' : 'FAILED'}
            </div>
            <span className="type-mono text-text-faint">{result.totalUnits} units</span>
          </div>

          {result.configWarnings.length > 0 && (
            <div className="p-3 bg-[var(--enforcement-should-bg)] border border-[var(--enforcement-should-border)] rounded-card-sm">
              {result.configWarnings.map((w, i) => (
                <p key={i} className="type-mono text-[12px] text-[var(--enforcement-should-text)]">{w}</p>
              ))}
            </div>
          )}

          {result.loadErrors.length > 0 && (
            <div className="p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm">
              <p className="type-overline mb-2">Load Errors</p>
              {result.loadErrors.map((e, i) => (
                <p key={i} className="type-mono text-[12px] text-[var(--enforcement-must-text)]">
                  <span className="font-semibold">{e.filePath}</span>: {e.message}
                </p>
              ))}
            </div>
          )}

          {result.loadWarnings.length > 0 && (
            <div className="p-3 bg-[var(--enforcement-should-bg)] border border-[var(--enforcement-should-border)] rounded-card-sm">
              <p className="type-overline mb-2">Load Warnings</p>
              {result.loadWarnings.map((w, i) => (
                <p key={i} className="type-mono text-[12px] text-[var(--enforcement-should-text)]">
                  <span className="font-semibold">{w.filePath}</span>: {w.message}
                </p>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            {result.results.map((r, i) => (
              <ResultPanel key={i} result={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────

function ResultPanel({ result }: { result: BuildResult }) {
  const [expanded, setExpanded] = useState(false);
  const label = result.group ? `${result.platform}/${result.group}` : result.platform;

  return (
    <div className="border-b border-border-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <div className="flex items-baseline gap-4">
          <span className="type-title">{label}</span>
          <span className="type-overline text-text-faint">{result.format}</span>
          <span className="type-mono text-text-faint">{result.unitCount} units</span>
        </div>
        <span className="type-mono text-text-faint">
          {expanded ? '\u2212' : '+'}
        </span>
      </button>
      {expanded && result.output && (
        <pre className="pb-6 overflow-x-auto max-h-96 font-mono text-[0.6875rem] leading-[1.7] text-text-muted whitespace-pre-wrap">
          {result.output}
        </pre>
      )}
      {expanded && !result.output && (
        <p className="type-caption pb-6">No output (dry run)</p>
      )}
    </div>
  );
}
