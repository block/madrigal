import { useEffect, useState, useCallback } from 'react';
import { api, type StatsResponse, type KnowledgeUnit } from '../api';
import { UnitCard } from '../components/UnitCard';
import { FilterBar } from '../components/FilterBar';

const LIMIT = 30;

export function Explorer() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [units, setUnits] = useState<KnowledgeUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    domain: '',
    kind: '',
    enforcement: '',
    brand: '',
    search: '',
  });

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

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

  if (!stats) return <p className="text-zinc-500">Loading…</p>;

  const enforcements = Object.keys(stats.byEnforcement);
  const kinds = Object.keys(stats.byKind);
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-5 max-w-5xl">
      <h2 className="text-xl font-semibold text-white">Explorer</h2>

      <FilterBar
        domains={stats.domains}
        kinds={kinds}
        enforcements={enforcements}
        brands={stats.brands}
        filters={filters}
        onChange={handleFilterChange}
      />

      <p className="text-sm text-zinc-500">{total} unit(s) found</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {units.map((u) => (
          <UnitCard key={u.id} unit={u} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 justify-center pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="px-3 py-1 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="px-3 py-1 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
