import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <div className="flex flex-wrap gap-2.5 items-center">
      <Input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={(e) => onChange('search', e.target.value)}
        className="w-52"
      />
      <FilterSelect label="Domain" value={filters.domain} options={domains} onChange={(v) => onChange('domain', v)} />
      <FilterSelect label="Kind" value={filters.kind} options={kinds} onChange={(v) => onChange('kind', v)} />
      <FilterSelect label="Enforcement" value={filters.enforcement} options={enforcements} onChange={(v) => onChange('enforcement', v)} />
      <FilterSelect label="Brand" value={filters.brand} options={brands} onChange={(v) => onChange('brand', v)} />
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v === '__all__' ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder={`All ${label}s`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {label}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
