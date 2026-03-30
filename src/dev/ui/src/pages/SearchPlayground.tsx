import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsResponse, type SearchResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { ScoreBar } from '../components/ScoreBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
      <header className="mb-12">
        <p className="type-overline mb-4">Semantic</p>
        <h1 className="type-display">Search</h1>
      </header>

      {/* Controls */}
      <section className="mb-12">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-56">
            <label className="type-overline block mb-2">Query</label>
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. accessibility, button labels, error messages..."
              className="w-full"
            />
          </div>
          {stats && (
            <>
              <div>
                <label className="type-overline block mb-2">Domain</label>
                <Select value={domain || undefined} onValueChange={(v) => setDomain(v === '__all__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    {stats.domains.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="type-overline block mb-2">Brand</label>
                <Select value={brand || undefined} onValueChange={(v) => setBrand(v === '__all__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    {stats.brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div>
            <label className="type-overline block mb-2">Limit</label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              className="w-16"
            />
          </div>
          <Button onClick={runSearch} disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section>
          <div className="flex items-baseline gap-6 mb-2">
            <p className="type-overline">{result.total} results</p>
            <p className="type-mono text-text-faint">{result.timing.ms}ms</p>
          </div>
          <Separator className="mb-0" />

          {result.results.map((r) => (
            <Link
              key={r.unit.id}
              to={`/units/${encodeURIComponent(r.unit.id)}`}
              className="block py-5 border-b border-border-card no-underline"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="type-overline">{r.unit.domain}</span>
                <span className="type-overline text-text-faint">/</span>
                <span className="type-overline">{r.unit.kind}</span>
                {r.unit.brand && (
                  <>
                    <span className="type-overline text-text-faint">/</span>
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
