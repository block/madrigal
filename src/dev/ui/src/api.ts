const BASE = '/api';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface ConfigResponse {
  config: {
    sources: string[];
    domains: Record<string, { description: string }>;
    kinds: Record<string, { description: string }>;
    brands: Record<string, { systems?: string[]; include?: string[] }>;
    platforms: Record<string, { format: string; groupBy?: string }>;
  };
  validation: {
    valid: boolean;
    errors: { path: string; message: string }[];
    warnings: { path: string; message: string }[];
  };
}

export interface StatsResponse {
  total: number;
  byDomain: Record<string, number>;
  byEnforcement: Record<string, number>;
  byKind: Record<string, number>;
  byBrand: Record<string, number>;
  brands: string[];
  domains: string[];
  platforms: string[];
}

export interface KnowledgeUnit {
  id: string;
  title: string;
  body: string;
  domain: string;
  kind: string;
  system?: string;
  brand?: string;
  tags: string[];
  enforcement: string;
  attributes: Record<string, unknown>;
  provenance: {
    origin: string;
    confidence: number;
  };
  _score?: number;
}

export interface UnitsResponse {
  units: KnowledgeUnit[];
  total: number;
}

export interface UnitDetailResponse {
  unit: KnowledgeUnit;
  brandResolutions: Record<string, { enforcement: string; overridden: boolean }>;
}

export interface SearchResponse {
  results: { unit: KnowledgeUnit; score: number }[];
  timing: { ms: number };
  total: number;
}

export interface BuildResult {
  platform: string;
  format: string;
  output: string;
  unitCount: number;
  group?: string;
  warnings: string[];
}

export interface PipelineResult {
  results: BuildResult[];
  totalUnits: number;
  loadErrors: { filePath: string; message: string }[];
  loadWarnings: { filePath: string; message: string }[];
  configWarnings: string[];
  success: boolean;
}

export interface ResolveResponse {
  brand: string;
  units: (KnowledgeUnit & { _baseEnforcement: string; _overridden: boolean })[];
  total: number;
}

export const api = {
  getConfig: () => fetchJson<ConfigResponse>('/config'),
  getStats: () => fetchJson<StatsResponse>('/stats'),
  getUnits: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<UnitsResponse>(`/units${qs}`);
  },
  getUnit: (id: string) => fetchJson<UnitDetailResponse>(`/units/${encodeURIComponent(id)}`),
  search: (body: { query: string; domain?: string; brand?: string; limit?: number; minScore?: number }) =>
    fetchJson<SearchResponse>('/search', { method: 'POST', body: JSON.stringify(body) }),
  build: (dryRun = true) =>
    fetchJson<PipelineResult>('/build', { method: 'POST', body: JSON.stringify({ dryRun }) }),
  buildPreview: (platform: string, brand?: string) => {
    const params = new URLSearchParams({ platform });
    if (brand) params.set('brand', brand);
    return fetchJson<{ results: BuildResult[] }>(`/build/preview?${params}`);
  },
  resolve: (brand: string) => fetchJson<ResolveResponse>(`/resolve?brand=${encodeURIComponent(brand)}`),
  reload: () => fetchJson<{ success: boolean; units: number; errors: number; warnings: number }>('/reload', { method: 'POST' }),
};
