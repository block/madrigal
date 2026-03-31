/**
 * Hono app for the Madrigal dev server.
 *
 * API routes + static file serving (or Vite proxy in dev mode).
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getState, loadState } from './state.js';
import { resolveForBrand } from '../resolver.js';
import { build, buildPlatformByName } from '../pipeline.js';
import { ENFORCEMENT_ORDER } from '../enforcement.js';
import type { KnowledgeUnit } from '../schema/index.js';
import { generateTopology, createOpenAIProvider, createVoyageProvider, createProviderFromEnv } from './topology/index.js';
import type { TopologyData, EmbeddingProvider } from './topology/index.js';
import { buildPrompt, parseProposedUnits, findRelated } from '../propose.js';
import { checkCompliance } from '../compliance/checker.js';
import { createCompletionFn } from './llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiRoot = join(__dirname, 'ui');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function createApp(baseDir: string): Hono {
  const app = new Hono();

  app.use('/api/*', cors());

  // --- GET /api/config ---
  app.get('/api/config', (c) => {
    const state = getState();
    return c.json({
      config: state.config,
      validation: state.validation,
    });
  });

  // --- GET /api/stats ---
  app.get('/api/stats', (c) => {
    const { units, config } = getState();

    const byDomain: Record<string, number> = {};
    const byEnforcement: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    const byBrand: Record<string, number> = {};

    for (const u of units) {
      byDomain[u.domain] = (byDomain[u.domain] || 0) + 1;
      byEnforcement[u.enforcement] = (byEnforcement[u.enforcement] || 0) + 1;
      byKind[u.kind] = (byKind[u.kind] || 0) + 1;
      const brand = u.brand || 'global';
      byBrand[brand] = (byBrand[brand] || 0) + 1;
    }

    return c.json({
      total: units.length,
      byDomain,
      byEnforcement,
      byKind,
      byBrand,
      brands: Object.keys(config.brands),
      domains: Object.keys(config.domains),
      platforms: Object.keys(config.platforms),
    });
  });

  // --- GET /api/units ---
  app.get('/api/units', async (c) => {
    const { units, search } = getState();
    const domain = c.req.query('domain');
    const brand = c.req.query('brand');
    const kind = c.req.query('kind');
    const enforcement = c.req.query('enforcement');
    const query = c.req.query('search');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    if (query) {
      const scored = await search.semanticSearch(query, {
        domain,
        brand,
        limit: limit + offset,
      });

      let results = scored;
      if (kind) results = results.filter((r) => r.unit.kind === kind);
      if (enforcement) results = results.filter((r) => r.unit.enforcement === enforcement);

      const paged = results.slice(offset, offset + limit);
      return c.json({
        units: paged.map((r) => ({ ...r.unit, _score: r.score })),
        total: results.length,
      });
    }

    let filtered = [...units];
    if (domain) filtered = filtered.filter((u) => u.domain === domain);
    if (brand) filtered = filtered.filter((u) => !u.brand || u.brand === brand);
    if (kind) filtered = filtered.filter((u) => u.kind === kind);
    if (enforcement) filtered = filtered.filter((u) => u.enforcement === enforcement);

    filtered.sort(
      (a, b) =>
        (ENFORCEMENT_ORDER[a.enforcement] ?? 99) -
        (ENFORCEMENT_ORDER[b.enforcement] ?? 99),
    );

    return c.json({
      units: filtered.slice(offset, offset + limit),
      total: filtered.length,
    });
  });

  // --- GET /api/units/:id ---
  app.get('/api/units/:id', (c) => {
    const { units, config } = getState();
    const id = c.req.param('id');
    const unit = units.find((u) => u.id === id);

    if (!unit) {
      return c.json({ error: 'Unit not found' }, 404);
    }

    // Build brand resolution table
    const brandResolutions: Record<string, { enforcement: string; overridden: boolean }> = {};
    for (const brandName of Object.keys(config.brands)) {
      const resolved = resolveForBrand({ units, config, brand: brandName, baseDir });
      const resolvedUnit = resolved.find((u) => u.id === id);
      if (resolvedUnit) {
        brandResolutions[brandName] = {
          enforcement: resolvedUnit.enforcement,
          overridden: resolvedUnit.enforcement !== unit.enforcement,
        };
      }
    }

    return c.json({ unit, brandResolutions });
  });

  // --- POST /api/search ---
  app.post('/api/search', async (c) => {
    const { search } = getState();
    const body = await c.req.json<{
      query: string;
      domain?: string;
      brand?: string;
      limit?: number;
      minScore?: number;
    }>();

    const start = performance.now();
    const results = await search.semanticSearch(body.query, {
      domain: body.domain,
      brand: body.brand,
      limit: body.limit ?? 20,
      minScore: body.minScore,
    });
    const elapsed = Math.round((performance.now() - start) * 100) / 100;

    return c.json({
      results: results.map((r) => ({ unit: r.unit, score: r.score })),
      timing: { ms: elapsed },
      total: results.length,
    });
  });

  // --- POST /api/build ---
  app.post('/api/build', async (c) => {
    const body = await c.req.json<{ dryRun?: boolean }>().catch(() => ({}));
    const result = await build({ baseDir, dryRun: (body as any)?.dryRun ?? true });
    return c.json(result);
  });

  // --- GET /api/build/preview ---
  app.get('/api/build/preview', async (c) => {
    const platform = c.req.query('platform');
    if (!platform) {
      return c.json({ error: 'platform query parameter required' }, 400);
    }

    const results = await buildPlatformByName(platform, { baseDir });
    return c.json({ results });
  });

  // --- GET /api/resolve ---
  app.get('/api/resolve', (c) => {
    const { units, config } = getState();
    const brand = c.req.query('brand');

    if (!brand) {
      return c.json({ error: 'brand query parameter required' }, 400);
    }

    const resolved = resolveForBrand({ units, config, brand, baseDir });

    // Mark which units have been overridden
    const resolvedWithOverrides = resolved.map((ru) => {
      const original = units.find((u) => u.id === ru.id);
      return {
        ...ru,
        _baseEnforcement: original?.enforcement ?? ru.enforcement,
        _overridden: original ? original.enforcement !== ru.enforcement : false,
      };
    });

    return c.json({
      brand,
      units: resolvedWithOverrides,
      total: resolvedWithOverrides.length,
    });
  });

  // --- GET /api/coverage ---
  app.get('/api/coverage', (c) => {
    const { units, config } = getState();

    const enforcementWeights: Record<string, number> = {
      must: 1.0,
      should: 0.7,
      may: 0.4,
      context: 0.2,
      deprecated: 0,
    };

    // Group units by domain
    const domainMap = new Map<string, { count: number; byEnforcement: Record<string, number> }>();

    for (const u of units) {
      let entry = domainMap.get(u.domain);
      if (!entry) {
        entry = { count: 0, byEnforcement: {} };
        domainMap.set(u.domain, entry);
      }
      entry.count++;
      entry.byEnforcement[u.enforcement] = (entry.byEnforcement[u.enforcement] || 0) + 1;
    }

    // Include config domains with zero units (coverage gaps)
    for (const d of Object.keys(config.domains)) {
      if (!domainMap.has(d)) {
        domainMap.set(d, { count: 0, byEnforcement: {} });
      }
    }

    const domains = Array.from(domainMap.entries()).map(([domain, data]) => {
      // Coverage score: weighted enforcement sum normalized
      let weightedSum = 0;
      for (const [enf, count] of Object.entries(data.byEnforcement)) {
        weightedSum += (enforcementWeights[enf] ?? 0) * count;
      }
      const coverageScore = data.count > 0 ? Math.min(1, weightedSum / data.count) : 0;
      const desc = config.domains[domain];

      return {
        domain,
        description: desc?.description ?? '',
        count: data.count,
        byEnforcement: data.byEnforcement,
        coverageScore,
      };
    });

    // Sort by count descending
    domains.sort((a, b) => b.count - a.count);
    const governedDomains = domains.filter((d) => d.count > 0).length;

    return c.json({
      domains,
      totalLayers: units.length,
      totalDomains: domains.length,
      governedDomains,
    });
  });

  // --- POST /api/studio/activate ---
  app.post('/api/studio/activate', async (c) => {
    const body = await c.req.json<{
      content: string;
      brand?: string;
      domain?: string;
      limit?: number;
    }>();

    if (!body.content?.trim()) {
      return c.json({ error: 'content is required' }, 400);
    }

    const state = getState();
    const start = performance.now();

    // Run search and compliance in parallel
    const [searchResults, complianceResult] = await Promise.all([
      state.search.semanticSearch(body.content, {
        domain: body.domain,
        brand: body.brand,
        limit: body.limit ?? 30,
      }),
      checkCompliance({
        content: body.content,
        brand: body.brand,
        domain: body.domain,
        searchAdapter: state.search,
        units: state.units,
        config: state.config,
        baseDir,
      }),
    ]);

    const elapsed = Math.round((performance.now() - start) * 100) / 100;

    const serialize = (v: any) => ({
      unitId: v.knowledgeUnit.id,
      unitTitle: v.knowledgeUnit.title,
      enforcement: v.knowledgeUnit.enforcement,
      confidence: v.matchResult.confidence,
      message: v.message,
    });

    return c.json({
      layers: searchResults.map((r) => ({ unit: r.unit, score: r.score })),
      compliance: {
        passed: complianceResult.passed,
        violations: complianceResult.violations.map(serialize),
        warnings: complianceResult.warnings.map(serialize),
        info: complianceResult.info.map(serialize),
      },
      timing: { ms: elapsed },
    });
  });

  // --- Topology endpoints ---
  let cachedTopology: TopologyData | null = null;

  app.get('/api/topology', (c) => {
    if (!cachedTopology) {
      return c.json({ error: 'Topology not generated yet. POST /api/topology/generate to create it.' }, 404);
    }
    return c.json(cachedTopology);
  });

  app.get('/api/topology/status', (c) => {
    const { units } = getState();
    return c.json({
      generated: !!cachedTopology,
      unitCount: units.length,
      generatedAt: cachedTopology?.metadata.generatedAt ?? null,
      embeddingModel: cachedTopology?.metadata.embeddingModel ?? null,
      nodeCount: cachedTopology?.metadata.nodeCount ?? 0,
      edgeCount: cachedTopology?.metadata.edgeCount ?? 0,
    });
  });

  app.post('/api/topology/generate', async (c) => {
    const { units } = getState();
    const body = await c.req.json<{
      provider?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
      clusters?: number;
      neighbors?: number;
      skipLlm?: boolean;
    }>().catch(() => ({}));

    let embeddingProvider: EmbeddingProvider | undefined;

    // Priority: request body > env vars
    const provider = (body as any)?.provider ?? process.env.MADRIGAL_EMBEDDING_PROVIDER;
    const apiKey = (body as any)?.apiKey ?? process.env.MADRIGAL_API_KEY;

    if (provider && apiKey) {
      switch (provider) {
        case 'openai':
          embeddingProvider = createOpenAIProvider({
            apiKey,
            model: (body as any)?.model ?? process.env.MADRIGAL_EMBEDDING_MODEL,
            baseUrl: (body as any)?.baseUrl ?? process.env.MADRIGAL_EMBEDDING_BASE_URL,
          });
          break;
        case 'voyage':
          embeddingProvider = createVoyageProvider({
            apiKey,
            model: (body as any)?.model ?? process.env.MADRIGAL_EMBEDDING_MODEL,
          });
          break;
      }
    } else {
      embeddingProvider = createProviderFromEnv() ?? undefined;
    }

    try {
      cachedTopology = await generateTopology(units, {
        clusters: (body as any)?.clusters,
        neighbors: (body as any)?.neighbors,
        skipLlm: (body as any)?.skipLlm ?? true,
        embeddingProvider,
      });

      return c.json({
        success: true,
        nodes: cachedTopology.metadata.nodeCount,
        edges: cachedTopology.metadata.edgeCount,
        clusters: cachedTopology.metadata.clusterCount,
        model: cachedTopology.metadata.embeddingModel,
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // =============================================
  // Workbench endpoints
  // =============================================

  // --- POST /api/workbench/propose ---
  app.post('/api/workbench/propose', async (c) => {
    const body = await c.req.json<{
      input: string;
      provider: 'openai' | 'anthropic';
      apiKey: string;
      model?: string;
      baseUrl?: string;
      domain?: string;
      brand?: string;
      enforcement?: string;
      batch?: boolean;
    }>();

    if (!body.input?.trim()) {
      return c.json({ error: 'input is required' }, 400);
    }
    if (!body.provider || !body.apiKey) {
      return c.json({ error: 'provider and apiKey are required' }, 400);
    }

    const state = getState();
    const complete = createCompletionFn({
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
      baseUrl: body.baseUrl,
    });

    try {
      const prompt = buildPrompt(
        {
          input: body.input,
          complete,
          domain: body.domain,
          brand: body.brand,
          enforcement: body.enforcement as any,
          batch: body.batch,
        },
        state.config,
        state.units,
      );

      const response = await complete(prompt);
      const proposed = parseProposedUnits(response);

      const proposals = proposed.map((unit) => ({
        ...unit,
        related: findRelated(unit, state.units),
      }));

      return c.json({ proposals });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // --- POST /api/workbench/compliance ---
  app.post('/api/workbench/compliance', async (c) => {
    const body = await c.req.json<{
      content: string;
      brand?: string;
      domain?: string;
      limit?: number;
    }>();

    if (!body.content?.trim()) {
      return c.json({ error: 'content is required' }, 400);
    }

    const state = getState();

    try {
      const result = await checkCompliance({
        content: body.content,
        brand: body.brand,
        domain: body.domain,
        searchAdapter: state.search,
        units: state.units,
        config: state.config,
        baseDir,
        limit: body.limit,
      });

      // Serialize violations with slim unit references
      const serialize = (v: any) => ({
        unitId: v.knowledgeUnit.id,
        unitTitle: v.knowledgeUnit.title,
        enforcement: v.knowledgeUnit.enforcement,
        confidence: v.matchResult.confidence,
        message: v.message,
      });

      return c.json({
        passed: result.passed,
        violations: result.violations.map(serialize),
        warnings: result.warnings.map(serialize),
        info: result.info.map(serialize),
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // --- GET /api/workbench/audit ---
  app.get('/api/workbench/audit', (c) => {
    const state = getState();
    const origin = c.req.query('origin');
    const proposalStatus = c.req.query('proposalStatus');
    const minConfidence = parseFloat(c.req.query('minConfidence') || '0');
    const maxConfidence = parseFloat(c.req.query('maxConfidence') || '1');
    const sortBy = c.req.query('sortBy') || 'confidence';
    const sortDir = c.req.query('sortDir') || 'desc';

    let filtered = state.units.map((u) => ({
      id: u.id,
      title: u.title,
      domain: u.domain,
      brand: u.brand,
      enforcement: u.enforcement,
      sourcePath: u.sourcePath,
      provenance: u.provenance,
    }));

    if (origin) {
      filtered = filtered.filter((u) => u.provenance.origin === origin);
    }
    if (proposalStatus) {
      filtered = filtered.filter((u) => u.provenance.proposalStatus === proposalStatus);
    }
    filtered = filtered.filter(
      (u) => u.provenance.confidence >= minConfidence && u.provenance.confidence <= maxConfidence,
    );

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'confidence') {
        cmp = a.provenance.confidence - b.provenance.confidence;
      } else if (sortBy === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortBy === 'domain') {
        cmp = a.domain.localeCompare(b.domain);
      } else if (sortBy === 'origin') {
        cmp = a.provenance.origin.localeCompare(b.provenance.origin);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return c.json({ units: filtered, total: filtered.length });
  });

  // --- GET /api/workbench/validation ---
  app.get('/api/workbench/validation', (c) => {
    const state = getState();
    return c.json({
      loadErrors: state.loadErrors,
      loadWarnings: state.loadWarnings,
      configValidation: state.validation,
      unitCount: state.units.length,
    });
  });

  // --- POST /api/reload ---
  app.post('/api/reload', async (c) => {
    await loadState(baseDir);
    const state = getState();
    return c.json({
      success: true,
      units: state.units.length,
      errors: state.loadErrors.length,
      warnings: state.loadWarnings.length,
    });
  });

  // Serve static UI files from the built dist next to this compiled file
  app.get('/*', async (c) => {
    const urlPath = new URL(c.req.url).pathname;
    const filePath = join(uiRoot, urlPath === '/' ? 'index.html' : urlPath);

    try {
      const content = await readFile(filePath);
      const ext = extname(filePath);
      return new Response(content, {
        headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
      });
    } catch {
      // SPA fallback: serve index.html for unmatched routes
      try {
        const indexContent = await readFile(join(uiRoot, 'index.html'));
        return new Response(indexContent, {
          headers: { 'Content-Type': 'text/html' },
        });
      } catch {
        return c.text('UI not built. Run: cd src/dev/ui && npm run build', 404);
      }
    }
  });

  return app;
}
