import { useEffect, useState, useCallback } from 'react';
import { api, type StatsResponse, type KnowledgeUnit } from '../api';
import { UnitCard } from '../components/UnitCard';
import { FilterBar } from '../components/FilterBar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

  if (!stats) return <p className="type-caption">Loading...</p>;

  const enforcements = Object.keys(stats.byEnforcement);
  const kinds = Object.keys(stats.byKind);
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      {/* Page header */}
      <header className="mb-12">
        <p className="type-overline mb-4">Browse</p>
        <h1 className="type-display">Explorer</h1>
      </header>

      {/* Filters */}
      <section className="mb-10">
        <FilterBar
          domains={stats.domains}
          kinds={kinds}
          enforcements={enforcements}
          brands={stats.brands}
          filters={filters}
          onChange={handleFilterChange}
        />
      </section>

      {/* Results meta */}
      <div className="flex items-baseline justify-between mb-2">
        <p className="type-overline">{total} units</p>
        {totalPages > 1 && (
          <p className="type-overline text-text-faint">
            Page {currentPage} of {totalPages}
          </p>
        )}
      </div>
      <Separator className="mb-0" />

      {/* Unit list */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
        {units.map((u) => (
          <UnitCard key={u.id} unit={u} />
        ))}
      </div>

      {/* Pagination */}
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
    </div>
  );
}
