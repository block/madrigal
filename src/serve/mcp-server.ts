/**
 * Madrigal MCP Server
 *
 * Serves compiled knowledge over the Model Context Protocol (MCP).
 * Enables AI assistants (Claude, Cursor, Goose) to search, query, and
 * review content against knowledge units.
 *
 * Requires: @modelcontextprotocol/sdk and zod as peer dependencies.
 */

import { readFileSync, existsSync } from 'node:fs';
import { build } from '../pipeline.js';
import { resolveForBrand } from '../resolver.js';
import { loadConfig } from '../config.js';
import { loadKnowledge } from '../loader.js';
import { skillMdFormat } from '../formats/skill-md.js';
import { BM25SearchAdapter } from '../search/adapter.js';
import { ENFORCEMENT_ORDER } from '../enforcement.js';
import type { KnowledgeUnit } from '../schema/index.js';
import type { MadrigalConfig } from '../config.js';

/**
 * Options for starting the MCP server.
 */
export interface ServeOptions {
  /** Base directory (defaults to cwd) */
  baseDir?: string;
  /** Path to a pre-built JSON bundle — skips build if provided */
  bundlePath?: string;
  /** Path to madrigal config file */
  configPath?: string;
}

/**
 * Start the Madrigal MCP server over stdio.
 *
 * Loads knowledge units (from bundle or by running the build pipeline),
 * creates a BM25 search index, and exposes tools for searching, querying,
 * and reviewing content against the knowledge base.
 */
export async function serveMcp(options: ServeOptions = {}): Promise<void> {
  // Dynamic imports for optional peer dependencies
  let McpServer: typeof import('@modelcontextprotocol/sdk/server/mcp.js').McpServer;
  let StdioServerTransport: typeof import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;
  let z: typeof import('zod');

  try {
    ({ McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js'));
    ({ StdioServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/stdio.js'
    ));
    z = await import('zod');
  } catch {
    console.error(
      'Missing dependencies for "madrigal serve".\n' +
        'Install them with: npm install @modelcontextprotocol/sdk zod',
    );
    process.exit(1);
  }

  const baseDir = options.baseDir ?? process.cwd();

  // Load units + config
  const { units, config } = await loadUnits(options, baseDir);

  if (units.length === 0) {
    console.error('No knowledge units found. Run "madrigal build" first or check your config.');
    process.exit(1);
  }

  // Build search adapter
  const search = new BM25SearchAdapter(units);

  // Create MCP server
  const server = new McpServer({
    name: 'madrigal',
    version: '0.1.0',
  });

  // --- Tool: search_knowledge ---
  server.tool(
    'search_knowledge',
    'Search the knowledge base by query text, tags, domain, enforcement, kind, or brand. Returns matching rules, guidelines, and patterns ranked by relevance.',
    {
      query: z.string().optional().describe('Free text search across titles and body content'),
      domain: z.string().optional().describe('Filter by domain'),
      brand: z.string().optional().describe('Filter by brand (omit for all)'),
      enforcement: z
        .array(z.enum(['must', 'should', 'may', 'context', 'deprecated']))
        .optional()
        .describe('Filter by enforcement levels'),
      kind: z.string().optional().describe('Filter by kind (e.g. rule, glossary, rubric)'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z.number().optional().describe('Max results (default: 10)'),
    },
    async ({ query, domain, brand, enforcement, kind, tags, limit }) => {
      let results: KnowledgeUnit[];

      if (query) {
        const scored = await search.semanticSearch(query, {
          domain,
          brand,
          minEnforcement: enforcement?.[enforcement.length - 1], // least strict as min
          limit: limit ?? 10,
        });
        // Post-filter by kind and tags if specified
        let filtered = scored;
        if (kind) filtered = filtered.filter((r) => r.unit.kind === kind);
        if (tags && tags.length > 0) {
          filtered = filtered.filter((r) =>
            tags.some((t) => r.unit.tags.includes(t)),
          );
        }
        results = filtered.map((r) => r.unit);
      } else {
        results = await search.exactMatch({
          domain,
          brand,
          enforcement: enforcement as any,
          kind,
          tags,
        });
        results = results.slice(0, limit ?? 10);
      }

      if (results.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No matching knowledge units found.' }] };
      }

      const text = results
        .map((u) => `### ${u.title} [${u.enforcement.toUpperCase()}]\n\nTags: ${u.tags.join(', ')}\n\n${u.body}`)
        .join('\n\n---\n\n');

      return {
        content: [{ type: 'text' as const, text: `Found ${results.length} result(s):\n\n${text}` }],
      };
    },
  );

  // --- Tool: get_knowledge_unit ---
  server.tool(
    'get_knowledge_unit',
    'Get a specific knowledge unit by its ID. Returns the full rule/guideline with all metadata.',
    {
      id: z.string().describe('The knowledge unit ID'),
    },
    async ({ id }) => {
      const unit = units.find((u) => u.id === id);
      if (!unit) {
        return {
          content: [{
            type: 'text' as const,
            text: `No knowledge unit found with ID "${id}". Available IDs: ${units.map((u) => u.id).join(', ')}`,
          }],
        };
      }

      const meta = [
        `**ID:** ${unit.id}`,
        `**Domain:** ${unit.domain}`,
        `**Kind:** ${unit.kind}`,
        `**Enforcement:** ${unit.enforcement}`,
        `**Tags:** ${unit.tags.join(', ')}`,
        unit.brand ? `**Brand:** ${unit.brand}` : null,
        unit.system ? `**System:** ${unit.system}` : null,
        `**Origin:** ${unit.provenance.origin} (confidence: ${unit.provenance.confidence})`,
      ].filter(Boolean).join('\n');

      return {
        content: [{ type: 'text' as const, text: `# ${unit.title}\n\n${meta}\n\n---\n\n${unit.body}` }],
      };
    },
  );

  // --- Tool: list_knowledge_units ---
  server.tool(
    'list_knowledge_units',
    'List all available knowledge units with their IDs, titles, enforcement, and tags. Useful for discovering what rules exist.',
    {
      domain: z.string().optional().describe('Filter by domain'),
      brand: z.string().optional().describe('Filter by brand'),
      enforcement: z
        .enum(['must', 'should', 'may', 'context', 'deprecated'])
        .optional()
        .describe('Filter by enforcement level'),
    },
    async ({ domain, brand, enforcement }) => {
      let filtered = [...units];
      if (domain) filtered = filtered.filter((u) => u.domain === domain);
      if (brand) filtered = filtered.filter((u) => !u.brand || u.brand === brand);
      if (enforcement) filtered = filtered.filter((u) => u.enforcement === enforcement);

      filtered.sort(
        (a, b) =>
          (ENFORCEMENT_ORDER[a.enforcement] ?? 99) -
          (ENFORCEMENT_ORDER[b.enforcement] ?? 99),
      );

      const text = filtered
        .map((u) => `- **${u.id}** [${u.enforcement.toUpperCase()}]: ${u.title} (${u.tags.join(', ')})`)
        .join('\n');

      return {
        content: [{ type: 'text' as const, text: `${filtered.length} knowledge unit(s):\n\n${text}` }],
      };
    },
  );

  // --- Tool: get_brand_rules ---
  server.tool(
    'get_brand_rules',
    'Get all design knowledge rules for a specific brand, with brand-specific enforcement overrides applied. Returns compiled skill-md output.',
    {
      brand: z.string().describe('Brand name'),
    },
    async ({ brand }) => {
      if (!config) {
        return {
          content: [{ type: 'text' as const, text: 'Config not available — serve was started from a bundle without config context.' }],
        };
      }

      const resolved = resolveForBrand({ units, config, brand, baseDir });
      if (resolved.length === 0) {
        const brands = Object.keys(config.brands);
        return {
          content: [{
            type: 'text' as const,
            text: `No rules found for brand "${brand}". Available brands: ${brands.join(', ')}`,
          }],
        };
      }

      const output = await skillMdFormat.compile(resolved, {
        platform: { format: 'skill-md' },
        config,
        brand,
      });

      return { content: [{ type: 'text' as const, text: output }] };
    },
  );

  // --- Tool: review_content ---
  server.tool(
    'review_content',
    'Review a piece of content against the knowledge base. Finds applicable rules by content similarity and presents them for compliance review.',
    {
      content: z.string().describe('The content text to review'),
      context: z.string().optional().describe('Where this content appears (e.g. "error message", "button label")'),
      brand: z.string().optional().describe('Brand context'),
    },
    async ({ content: contentText, context, brand }) => {
      // Build search query from content + context
      const query = context ? `${context} ${contentText}` : contentText;

      const scored = await search.semanticSearch(query, {
        brand,
        limit: 15,
      });

      if (scored.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No applicable rules found for this content.',
          }],
        };
      }

      const rulesText = scored
        .map((r) => `### ${r.unit.title} [${r.unit.enforcement.toUpperCase()}] (relevance: ${r.score})\n\n${r.unit.body}`)
        .join('\n\n---\n\n');

      const prompt = `Review this content against the design rules below.

**Content to review:** "${contentText}"
${context ? `**Context:** ${context}` : ''}
${brand ? `**Brand:** ${brand}` : ''}

**Applicable rules:**

${rulesText}

For each applicable rule, state whether the content follows it or violates it, with a brief explanation.`;

      return { content: [{ type: 'text' as const, text: prompt }] };
    },
  );

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// --- helpers ---

async function loadUnits(
  options: ServeOptions,
  baseDir: string,
): Promise<{ units: KnowledgeUnit[]; config: MadrigalConfig | null }> {
  // Path 1: pre-built JSON bundle
  if (options.bundlePath) {
    const absPath = options.bundlePath.startsWith('/')
      ? options.bundlePath
      : `${baseDir}/${options.bundlePath}`;

    if (!existsSync(absPath)) {
      console.error(`Bundle not found: ${absPath}`);
      process.exit(1);
    }

    const bundle = JSON.parse(readFileSync(absPath, 'utf-8')) as {
      units?: KnowledgeUnit[];
    };

    // Try to load config for brand resolution (optional)
    let config: MadrigalConfig | null = null;
    try {
      config = loadConfig(options.configPath);
    } catch {
      // Config not required when serving from bundle
    }

    return { units: bundle.units ?? [], config };
  }

  // Path 2: load from source files via config
  const config = loadConfig(options.configPath);
  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });

  return { units: loadResult.units, config };
}
