import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type UnitDetailResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { Markdown } from '../components/Markdown';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

export function UnitDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UnitDetailResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getUnit(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="type-body text-[var(--enforcement-must-text)]">{error}</p>;
  if (!data) return <p className="type-caption">Loading...</p>;

  const { unit, brandResolutions } = data;

  return (
    <div>
      {/* Back link */}
      <Link
        to="/explorer"
        className="type-overline inline-block mb-12 text-text-muted no-underline hover:text-text-default"
      >
        &larr; Explorer
      </Link>

      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="type-overline">{unit.domain}</span>
          <span className="type-overline text-text-faint">/</span>
          <span className="type-overline">{unit.kind}</span>
          <span className="ml-auto"><EnforcementBadge level={unit.enforcement} /></span>
        </div>
        <h1 className="type-display mb-3">{unit.title}</h1>
        <p className="type-mono">{unit.id}</p>
      </header>

      {/* Metadata */}
      <section className="mb-14">
        <p className="type-overline mb-4">Metadata</p>
        <h2 className="type-section mb-6">Properties</h2>
        <Separator className="mb-0" />
        <dl className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr_100px_1fr]">
          <MetaField label="Domain" value={unit.domain} />
          <MetaField label="Kind" value={unit.kind} />
          {unit.brand && <MetaField label="Brand" value={unit.brand} />}
          {unit.system && <MetaField label="System" value={unit.system} />}
          <MetaField label="Origin" value={`${unit.provenance.origin} (${unit.provenance.confidence})`} />
          {unit.tags.length > 0 && (
            <>
              <dt className="type-overline py-4 border-b border-border-card">Tags</dt>
              <dd className="py-4 flex flex-wrap gap-1.5 items-center border-b border-border-card">
                {unit.tags.map((t) => (
                  <span
                    key={t}
                    className="type-overline px-2 py-0.5 rounded-pill bg-background-muted text-text-muted text-[0.5625rem] tracking-[0.05em]"
                  >
                    {t}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </section>

      {/* Body */}
      <section className="mb-14">
        <p className="type-overline mb-4">Content</p>
        <h2 className="type-section mb-6">Body</h2>
        <Separator className="mb-8" />
        <Markdown>{unit.body}</Markdown>
      </section>

      {/* Brand resolution */}
      {Object.keys(brandResolutions).length > 0 && (
        <section>
          <p className="type-overline mb-4">Brand Resolution</p>
          <h2 className="type-section mb-6">Overrides</h2>
          <Separator className="mb-0" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="type-overline font-normal">Brand</TableHead>
                <TableHead className="type-overline font-normal">Enforcement</TableHead>
                <TableHead className="type-overline font-normal">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(brandResolutions).map(([brand, res]) => (
                <TableRow key={brand}>
                  <TableCell className="type-body">{brand}</TableCell>
                  <TableCell><EnforcementBadge level={res.enforcement} /></TableCell>
                  <TableCell>
                    {res.overridden && (
                      <span className="type-overline text-[var(--enforcement-should-text)]">Overridden</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="type-overline py-4 border-b border-border-card">{label}</dt>
      <dd className="type-body py-4 border-b border-border-card">{value}</dd>
    </>
  );
}
