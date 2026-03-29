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

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--text-secondary)',
  fontSize: '0.8125rem',
  height: 36,
  padding: '0 14px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: 28,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};

export function FilterBar({ domains, kinds, enforcements, brands, filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2.5 items-center">
      <input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={(e) => onChange('search', e.target.value)}
        className="w-52 focus:outline-none"
        style={inputStyle}
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
      className="focus:outline-none"
      style={selectStyle}
    >
      <option value="">All {label}s</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
