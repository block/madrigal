import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type {
  StatsResponse,
  ProposeResponse,
  ProposedUnitDTO,
  ComplianceResponse,
  ComplianceViolationDTO,
  AuditUnit,
  AuditResponse,
  ValidationResponse,
} from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { ScoreBar } from '../components/ScoreBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

// ─── Author Tab ─────────────────────────────────────────────

function AuthorTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [input, setInput] = useState('');
  const [domain, setDomain] = useState('');
  const [brand, setBrand] = useState('');
  const [enforcement, setEnforcement] = useState('');
  const [batch, setBatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  const handlePropose = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.propose({
        input,
        provider,
        apiKey,
        model: model || undefined,
        domain: domain || undefined,
        brand: brand || undefined,
        enforcement: enforcement || undefined,
        batch,
      });
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="type-body text-text-muted">
        Draft knowledge units with LLM assistance. Provide rough input and an LLM
        will propose well-formed units. Nothing is written to disk.
      </p>

      {/* BYOK */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="type-overline block mb-2">LLM Provider</label>
          <Select
            value={provider || undefined}
            onValueChange={(v) => setProvider(v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a provider..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="type-overline block mb-2">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="w-48">
              <label className="type-overline block mb-2">Model (optional)</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini'}
              />
            </div>
          </div>
        )}

        {provider && (
          <div className="type-mono text-[10px] text-text-faint">
            Key is sent to the server for LLM completion only, not stored.
          </div>
        )}
      </div>

      <Separator />

      {/* Input */}
      <div>
        <label className="type-overline block mb-2">Rough Input</label>
        <textarea
          className="w-full min-h-[160px] border border-border-input rounded-md px-3 py-2 text-sm bg-background-default text-text-default placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a design guideline, rule, or pattern in plain language..."
        />
      </div>

      {/* Hints */}
      <div className="flex gap-3 flex-wrap">
        <div className="w-40">
          <label className="type-overline block mb-2">Domain hint</label>
          <Select value={domain || undefined} onValueChange={(v) => setDomain(v === '__all__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              {stats?.domains.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="type-overline block mb-2">Brand hint</label>
          <Select value={brand || undefined} onValueChange={(v) => setBrand(v === '__all__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Global" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Global</SelectItem>
              {stats?.brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="type-overline block mb-2">Enforcement hint</label>
          <Select value={enforcement || undefined} onValueChange={(v) => setEnforcement(v === '__all__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Default</SelectItem>
              <SelectItem value="must">must</SelectItem>
              <SelectItem value="should">should</SelectItem>
              <SelectItem value="may">may</SelectItem>
              <SelectItem value="context">context</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={batch}
              onChange={(e) => setBatch(e.target.checked)}
              className="rounded"
            />
            Batch (multiple units)
          </label>
        </div>
      </div>

      <Button
        onClick={handlePropose}
        disabled={loading || !provider || !apiKey || !input.trim()}
      >
        {loading ? 'Proposing units...' : 'Propose'}
      </Button>

      {error && (
        <div className="p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <Separator />
          <p className="type-overline">
            {result.proposals.length} unit{result.proposals.length !== 1 ? 's' : ''} proposed
          </p>
          {result.proposals.map((p, i) => (
            <ProposalCard key={i} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: ProposedUnitDTO }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-card rounded-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-text-default">{proposal.title}</span>
            <EnforcementBadge level={proposal.enforcement} />
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{proposal.domain}</span>
            {proposal.brand && <span>/ {proposal.brand}</span>}
            {proposal.system && <span>/ {proposal.system}</span>}
          </div>
        </div>
        <span className="type-mono text-[10px] text-text-faint shrink-0">{proposal.filename}</span>
      </div>

      {proposal.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {proposal.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-text-muted hover:text-text-default transition-colors"
      >
        {expanded ? 'Hide body' : 'Show body'}
      </button>

      {expanded && (
        <pre className="text-xs text-text-muted bg-background-muted p-3 rounded-card-sm overflow-x-auto whitespace-pre-wrap">
          {proposal.body}
        </pre>
      )}

      {proposal.related.length > 0 && (
        <div className="text-xs text-text-faint">
          <span className="type-overline">Related: </span>
          {proposal.related.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ', '}
              <Link to={`/units/${r.id}`} className="text-text-muted hover:text-text-default underline">
                {r.id}
              </Link>
              <span className="text-text-faint"> ({r.reason})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compliance Tab ─────────────────────────────────────────

function ComplianceTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [content, setContent] = useState('');
  const [brand, setBrand] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplianceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.checkCompliance({
        content,
        brand: brand || undefined,
        domain: domain || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="type-body text-text-muted">
        Check content against the knowledge base for compliance. Paste design content, code,
        or a prompt to see which rules match and at what confidence.
      </p>

      <div>
        <label className="type-overline block mb-2">Content to check</label>
        <textarea
          className="w-full min-h-[160px] border border-border-input rounded-md px-3 py-2 text-sm bg-background-default text-text-default placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste design content, code snippet, or prompt to check..."
        />
      </div>

      <div className="flex gap-3">
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
      </div>

      <Button onClick={handleCheck} disabled={loading || !content.trim()}>
        {loading ? 'Checking...' : 'Check Compliance'}
      </Button>

      {error && (
        <div className="p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Separator />

          {/* Pass/fail */}
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-semibold ${
                result.passed
                  ? 'bg-[var(--enforcement-may-bg)] text-[var(--enforcement-may-text)] border border-[var(--enforcement-may-border)]'
                  : 'bg-[var(--enforcement-must-bg)] text-[var(--enforcement-must-text)] border border-[var(--enforcement-must-border)]'
              }`}
            >
              {result.passed ? 'PASSED' : 'FAILED'}
            </div>
            <span className="text-sm text-text-muted">
              {result.violations.length} violation{result.violations.length !== 1 ? 's' : ''},
              {' '}{result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''},
              {' '}{result.info.length} info
            </span>
          </div>

          {/* Violations */}
          {result.violations.length > 0 && (
            <ViolationSection
              title="Violations"
              items={result.violations}
              colorVar="must"
            />
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <ViolationSection
              title="Warnings"
              items={result.warnings}
              colorVar="should"
            />
          )}

          {/* Info */}
          {result.info.length > 0 && (
            <ViolationSection
              title="Info"
              items={result.info}
              colorVar="may"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ViolationSection({
  title,
  items,
  colorVar,
}: {
  title: string;
  items: ComplianceViolationDTO[];
  colorVar: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-2"
      >
        <span className="type-overline">{title}</span>
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        <span className="text-xs text-text-faint">{open ? '(collapse)' : '(expand)'}</span>
      </button>
      {open && (
        <div className={`space-y-2 p-3 rounded-card-sm border border-[var(--enforcement-${colorVar}-border)] bg-[var(--enforcement-${colorVar}-bg)]`}>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Link
                  to={`/units/${item.unitId}`}
                  className={`text-sm font-medium text-[var(--enforcement-${colorVar}-text)] hover:underline`}
                >
                  {item.unitTitle}
                </Link>
                <EnforcementBadge level={item.enforcement} />
              </div>
              <ScoreBar score={item.confidence} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Audit Tab ──────────────────────────────────────────────

function AuditTab() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [proposalStatus, setProposalStatus] = useState('');
  const [sortBy, setSortBy] = useState('confidence');
  const [sortDir, setSortDir] = useState('desc');

  const load = (params?: Record<string, string>) => {
    setLoading(true);
    const query: Record<string, string> = {};
    const o = params?.origin ?? origin;
    const ps = params?.proposalStatus ?? proposalStatus;
    if (o) query.origin = o;
    if (ps) query.proposalStatus = ps;
    query.sortBy = params?.sortBy ?? sortBy;
    query.sortDir = params?.sortDir ?? sortDir;
    api.getAudit(query).then((res) => {
      setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleSort = (col: string) => {
    const newDir = sortBy === col && sortDir === 'desc' ? 'asc' : 'desc';
    setSortBy(col);
    setSortDir(newDir);
    load({ sortBy: col, sortDir: newDir });
  };

  const handleOriginChange = (v: string) => {
    const val = v === '__all__' ? '' : v;
    setOrigin(val);
    load({ origin: val });
  };

  const handleStatusChange = (v: string) => {
    const val = v === '__all__' ? '' : v;
    setProposalStatus(val);
    load({ proposalStatus: val });
  };

  const sortIndicator = (col: string) =>
    sortBy === col ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  return (
    <div className="space-y-6">
      <p className="type-body text-text-muted">
        Audit provenance and approval status across all knowledge units.
      </p>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="w-48">
          <label className="type-overline block mb-2">Origin</label>
          <Select value={origin || undefined} onValueChange={handleOriginChange}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              <SelectItem value="human-authored">human-authored</SelectItem>
              <SelectItem value="system-proposed">system-proposed</SelectItem>
              <SelectItem value="extracted">extracted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <label className="type-overline block mb-2">Proposal Status</label>
          <Select value={proposalStatus || undefined} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              <SelectItem value="draft">draft</SelectItem>
              <SelectItem value="pending-review">pending-review</SelectItem>
              <SelectItem value="approved">approved</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="type-mono text-text-muted">Loading...</p>
      ) : data && (
        <>
          <p className="type-mono text-text-faint text-xs">{data.total} units</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('title')}
                >
                  Title{sortIndicator('title')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('domain')}
                >
                  Domain{sortIndicator('domain')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('origin')}
                >
                  Origin{sortIndicator('origin')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('confidence')}
                >
                  Confidence{sortIndicator('confidence')}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      to={`/units/${u.id}`}
                      className="text-sm text-text-default hover:underline"
                    >
                      {u.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-muted text-xs">{u.domain}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {u.provenance.origin}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="type-mono text-xs">
                      {u.provenance.confidence.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {u.provenance.proposalStatus ? (
                      <Badge
                        variant={u.provenance.proposalStatus === 'approved' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {u.provenance.proposalStatus}
                      </Badge>
                    ) : (
                      <span className="text-text-faint text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-text-muted text-xs">
                    {u.provenance.approvedBy || '-'}
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

// ─── Validate Tab ───────────────────────────────────────────

function ValidateTab() {
  const [data, setData] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getValidation().then((res) => {
      setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevalidate = async () => {
    setLoading(true);
    await api.reload();
    load();
  };

  if (loading) {
    return <p className="type-mono text-text-muted">Loading validation results...</p>;
  }

  if (!data) return null;

  const hasErrors = data.loadErrors.length > 0 || !data.configValidation.valid;
  const hasWarnings = data.loadWarnings.length > 0 || data.configValidation.warnings.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="type-body text-text-muted">
          Validation results from loading knowledge units and configuration.
        </p>
        <Button variant="outline" onClick={handleRevalidate} disabled={loading}>
          {loading ? 'Revalidating...' : 'Re-validate'}
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="p-3 bg-background-muted rounded-card-sm text-center min-w-[100px]">
          <div className="type-mono text-lg font-bold text-text-default">{data.unitCount}</div>
          <div className="type-overline text-text-faint">Units</div>
        </div>
        <div className={`p-3 rounded-card-sm text-center min-w-[100px] ${data.loadErrors.length > 0 ? 'bg-[var(--enforcement-must-bg)]' : 'bg-background-muted'}`}>
          <div className="type-mono text-lg font-bold text-text-default">{data.loadErrors.length}</div>
          <div className="type-overline text-text-faint">Errors</div>
        </div>
        <div className={`p-3 rounded-card-sm text-center min-w-[100px] ${data.loadWarnings.length > 0 ? 'bg-[var(--enforcement-should-bg)]' : 'bg-background-muted'}`}>
          <div className="type-mono text-lg font-bold text-text-default">{data.loadWarnings.length}</div>
          <div className="type-overline text-text-faint">Warnings</div>
        </div>
      </div>

      {!hasErrors && !hasWarnings && (
        <div className="p-3 bg-[var(--enforcement-may-bg)] border border-[var(--enforcement-may-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-may-text)]">
          All clear — no errors or warnings.
        </div>
      )}

      {/* Load errors */}
      {data.loadErrors.length > 0 && (
        <div>
          <p className="type-overline mb-2 flex items-center gap-2">
            Load Errors
            <Badge variant="destructive" className="text-[10px]">{data.loadErrors.length}</Badge>
          </p>
          <div className="space-y-1 p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm">
            {data.loadErrors.map((e, i) => (
              <div key={i} className="type-mono text-[12px] text-[var(--enforcement-must-text)]">
                <span className="font-semibold">{e.filePath}</span>: {e.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Load warnings */}
      {data.loadWarnings.length > 0 && (
        <div>
          <p className="type-overline mb-2 flex items-center gap-2">
            Load Warnings
            <Badge variant="secondary" className="text-[10px]">{data.loadWarnings.length}</Badge>
          </p>
          <div className="space-y-1 p-3 bg-[var(--enforcement-should-bg)] border border-[var(--enforcement-should-border)] rounded-card-sm">
            {data.loadWarnings.map((w, i) => (
              <div key={i} className="type-mono text-[12px] text-[var(--enforcement-should-text)]">
                <span className="font-semibold">{w.filePath}</span>
                {w.field && <span> [{w.field}]</span>}: {w.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config validation */}
      {(data.configValidation.errors.length > 0 || data.configValidation.warnings.length > 0) && (
        <div>
          <Separator className="my-4" />
          <p className="type-overline mb-3">Config Validation</p>

          {data.configValidation.errors.length > 0 && (
            <div className="space-y-1 p-3 mb-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm">
              {data.configValidation.errors.map((e, i) => (
                <div key={i} className="type-mono text-[12px] text-[var(--enforcement-must-text)]">
                  <span className="font-semibold">{e.path}</span>: {e.message}
                </div>
              ))}
            </div>
          )}

          {data.configValidation.warnings.length > 0 && (
            <div className="space-y-1 p-3 bg-[var(--enforcement-should-bg)] border border-[var(--enforcement-should-border)] rounded-card-sm">
              {data.configValidation.warnings.map((w, i) => (
                <div key={i} className="type-mono text-[12px] text-[var(--enforcement-should-text)]">
                  <span className="font-semibold">{w.path}</span>: {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function Workbench() {
  return (
    <>
      <header className="mb-8">
        <p className="type-overline mb-4">Testing</p>
        <h1 className="type-display">Workbench</h1>
      </header>

      <Tabs defaultValue="compliance">
        <TabsList>
          <TabsTrigger value="author">Author</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="validate">Validate</TabsTrigger>
        </TabsList>

        <TabsContent value="author" className="mt-6">
          <AuthorTab />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditTab />
        </TabsContent>

        <TabsContent value="validate" className="mt-6">
          <ValidateTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
