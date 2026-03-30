import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type StatsResponse, type ResolveResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

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
      <header className="mb-12">
        <p className="type-overline mb-4">Resolution</p>
        <h1 className="type-display">Brands</h1>
      </header>

      {/* Controls */}
      <section className="mb-10">
        <div className="flex gap-3 items-center">
          {stats && (
            <Select value={brand || undefined} onValueChange={(v) => setBrand(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select brand...</SelectItem>
                {stats.brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <label className="flex items-center gap-2 type-caption cursor-pointer">
            <input
              type="checkbox"
              checked={overriddenOnly}
              onChange={(e) => setOverriddenOnly(e.target.checked)}
              className="accent-text-muted"
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
              <p className="type-mono text-text-faint">
                {data.units.filter((u) => u._overridden).length} overridden
              </p>
            )}
          </div>
          <Separator className="mb-0" />

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
                      to={`/units/${encodeURIComponent(u.id)}`}
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
        </section>
      )}

      {!brand && !loading && (
        <p className="type-caption mt-6">Select a brand to view resolution.</p>
      )}
    </div>
  );
}
