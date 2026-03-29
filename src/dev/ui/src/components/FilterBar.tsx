interface FilterBarProps {
  domains: string[];
  kinds: string[];
  enforcements: string[];
  brands: string[];
  filters: {
    domain: string;
    kind: string;
    enforcement: string;
    brand: string;
    search: string;
  };
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ domains, kinds, enforcements, brands, filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        type="text"
        placeholder="Search units…"
        value={filters.search}
        onChange={(e) => onChange('search', e.target.value)}
        className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 w-64"
      />
      <Select label="Domain" value={filters.domain} options={domains} onChange={(v) => onChange('domain', v)} />
      <Select label="Kind" value={filters.kind} options={kinds} onChange={(v) => onChange('kind', v)} />
      <Select label="Enforcement" value={filters.enforcement} options={enforcements} onChange={(v) => onChange('enforcement', v)} />
      <Select label="Brand" value={filters.brand} options={brands} onChange={(v) => onChange('brand', v)} />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
    >
      <option value="">All {label}s</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
