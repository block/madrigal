import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type UnitDetailResponse } from '../api';
import { EnforcementBadge } from '../components/EnforcementBadge';
import { Markdown } from '../components/Markdown';

export function UnitDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UnitDetailResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getUnit(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="type-body" style={{ color: 'var(--enforcement-must-text)' }}>{error}</p>;
  if (!data) return <p className="type-caption">Loading...</p>;

  const { unit, brandResolutions } = data;

  return (
    <div>
      {/* Back link */}
      <Link
        to="/explorer"
        className="type-overline inline-block mb-10"
        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        &larr; Explorer
      </Link>

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <span className="type-overline">{unit.domain}</span>
          <span className="type-overline" style={{ color: 'var(--text-faint)' }}>/</span>
          <span className="type-overline">{unit.kind}</span>
          <span className="ml-auto"><EnforcementBadge level={unit.enforcement} /></span>
        </div>
        <h1 className="type-display mb-2">{unit.title}</h1>
        <p className="type-mono">{unit.id}</p>
      </header>

      {/* Metadata */}
      <section className="mb-12">
        <p className="type-overline mb-5">Metadata</p>
        <hr className="rule mb-0" />
        <dl className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr_100px_1fr]">
          <MetaField label="Domain" value={unit.domain} />
          <MetaField label="Kind" value={unit.kind} />
          {unit.brand && <MetaField label="Brand" value={unit.brand} />}
          {unit.system && <MetaField label="System" value={unit.system} />}
          <MetaField label="Origin" value={`${unit.provenance.origin} (${unit.provenance.confidence})`} />
          {unit.tags.length > 0 && (
            <>
              <dt
                className="type-overline py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                Tags
              </dt>
              <dd
                className="py-4 flex flex-wrap gap-1.5 items-center"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                {unit.tags.map((t) => (
                  <span
                    key={t}
                    className="type-overline px-2 py-0.5"
                    style={{
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--bg-muted)',
                      color: 'var(--text-muted)',
                      fontSize: '0.5625rem',
                      letterSpacing: '0.05em',
                    }}
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
      <section className="mb-12">
        <p className="type-overline mb-5">Content</p>
        <hr className="rule mb-6" />
        <Markdown>{unit.body}</Markdown>
      </section>

      {/* Brand resolution */}
      {Object.keys(brandResolutions).length > 0 && (
        <section>
          <p className="type-overline mb-5">Brand Resolution</p>
          <hr className="rule mb-0" />
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                <th className="type-overline text-left py-3 font-normal">Brand</th>
                <th className="type-overline text-left py-3 font-normal">Enforcement</th>
                <th className="type-overline text-left py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(brandResolutions).map(([brand, res]) => (
                <tr key={brand} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="type-body py-3">{brand}</td>
                  <td className="py-3"><EnforcementBadge level={res.enforcement} /></td>
                  <td className="py-3">
                    {res.overridden && (
                      <span className="type-overline" style={{ color: 'var(--enforcement-should-text)' }}>
                        Overridden
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="type-overline py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {label}
      </dt>
      <dd className="type-body py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {value}
      </dd>
    </>
  );
}
