import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type {
  StatsResponse,
  ProposeResponse,
  ProposedUnitDTO,
  AuditResponse,
} from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
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
        Add directives to the intelligence stack with LLM assistance. Describe a design
        guideline or rule, and an LLM will propose well-formed directives. Nothing is
        written to disk.
      </p>

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

      <div>
        <label className="type-overline block mb-2">Rough Input</label>
        <textarea
          className="w-full min-h-[160px] border border-border-input rounded-md px-3 py-2 text-sm bg-background-default text-text-default placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a design guideline, rule, or pattern in plain language..."
        />
      </div>

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
            Batch (multiple directives)
          </label>
        </div>
      </div>

      <Button
        onClick={handlePropose}
        disabled={loading || !provider || !apiKey || !input.trim()}
      >
        {loading ? 'Proposing directives...' : 'Propose'}
      </Button>

      {error && (
        <div className="p-3 bg-[var(--enforcement-must-bg)] border border-[var(--enforcement-must-border)] rounded-card-sm type-mono text-[12px] text-[var(--enforcement-must-text)]">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Separator />
          <p className="type-overline">
            {result.proposals.length} directive{result.proposals.length !== 1 ? 's' : ''} proposed
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
              <Link to={`/layers/${r.id}`} className="text-text-muted hover:text-text-default underline">
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
        Audit provenance and approval status across all directives.
      </p>

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
          <p className="type-mono text-text-faint text-xs">{data.total} directives</p>
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
                      to={`/layers/${u.id}`}
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

export function Author() {
  return (
    <>
      <header className="mb-8">
        <p className="type-overline mb-4">Authoring</p>
        <h1 className="type-display">Author</h1>
      </header>

      <Tabs defaultValue="author">
        <TabsList>
          <TabsTrigger value="author">Author</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="author" className="mt-6">
          <AuthorTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
