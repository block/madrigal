/**
 * Madrigal MCP Server
 *
 * Serves compiled knowledge over the Model Context Protocol (MCP).
 * Enables AI assistants (Claude, Cursor, Goose) to search, query, and
 * review content against knowledge units.
 *
 * Requires: @modelcontextprotocol/sdk and zod as peer dependencies.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { MadrigalConfig } from '../config.js';
import { loadConfig } from '../config.js';
import { ENFORCEMENT_ORDER, type Enforcement } from '../enforcement.js';
import { loadKnowledge } from '../loader.js';
import type { KnowledgeUnit } from '../schema/index.js';
import { BM25SearchAdapter } from '../search/adapter.js';

/**
 * Options for starting the MCP server.
 */
export interface ServeOptions {
  /** MCP server name shown to clients (default: 'madrigal') */
  name?: string;
  /** Base directory (defaults to cwd) */
  baseDir?: string;
  /** Path to a pre-built JSON bundle — skips build if provided */
  bundlePath?: string;
  /** Paths to additional pre-built JSON bundles to merge with bundlePath */
  bundlePaths?: string[];
  /** Path to madrigal config file */
  configPath?: string;
  /** Anthropic API key for review_content LLM synthesis (falls back to ANTHROPIC_API_KEY env var) */
  anthropicApiKey?: string;
  /** Claude model to use for review_content (default: claude-sonnet-4-6) */
  model?: string;
  /** Custom system prompt for review_content LLM synthesis. Overrides the default generic prompt. */
  reviewSystemPrompt?: string;
}

/**
 * Start the Madrigal MCP server over stdio.
 *
 * Loads knowledge units (from bundle or by running the build pipeline),
 * creates a BM25 search index, and exposes tools for searching, querying,
 * and reviewing content against the knowledge base.
 */
// "shared" and "global" are sentinel values meaning always-include,
// equivalent to a missing brand (null/undefined).
const isGlobal = (b: string | undefined | null): boolean =>
  !b || b === 'shared' || b === 'global';

const EXCERPT_CHARS = 2000;
const DEFAULT_MODEL = 'claude-sonnet-4-6';

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

  // Optional Anthropic client for review_content synthesis
  let anthropic: import('@anthropic-ai/sdk').Anthropic | null = null;
  const apiKey = options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      anthropic = new Anthropic({ apiKey });
    } catch {
      console.error(
        'Warning: @anthropic-ai/sdk not installed. review_content will return a raw prompt.\n' +
          'Install with: npm install @anthropic-ai/sdk',
      );
    }
  }

  const baseDir = options.baseDir ?? process.cwd();

  // Load units + config
  const { units } = await loadUnits(options, baseDir);

  if (units.length === 0) {
    console.error(
      'No knowledge units found. Run "madrigal build" first or check your config.',
    );
    process.exit(1);
  }

  // Build search adapter
  const search = new BM25SearchAdapter(units);

  // Create MCP server
  const server = new McpServer({
    name: options.name ?? 'madrigal',
    version: '0.1.0',
  });

  // --- Tool: search_knowledge ---
  server.tool(
    'search_knowledge',
    'Search the knowledge base by query text, tags, domain, enforcement, kind, or brand. Returns matching rules, guidelines, and patterns ranked by relevance.',
    {
      query: z
        .string()
        .optional()
        .describe('Free text search across titles and body content'),
      domain: z.string().optional().describe('Filter by domain'),
      brand: z.string().optional().describe('Filter by brand (omit for all)'),
      enforcement: z
        .array(z.enum(['must', 'should', 'may', 'context', 'deprecated']))
        .optional()
        .describe('Filter by enforcement levels'),
      kind: z
        .string()
        .optional()
        .describe('Filter by kind (e.g. rule, glossary, rubric)'),
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
          enforcement: enforcement as Enforcement[] | undefined,
          kind,
          tags,
        });
        results = results.slice(0, limit ?? 10);
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No matching knowledge units found.',
            },
          ],
        };
      }

      const lines = results.map((u) => {
        const tags = u.tags.length ? ` (${u.tags.slice(0, 3).join(', ')})` : '';
        // Include a short excerpt from the body (first 150 chars) for context
        const excerpt = u.body
          .replace(/^#+\s+/gm, '')
          .replace(/\n+/g, ' ')
          .trim()
          .slice(0, 150);
        return `- [${u.enforcement.toUpperCase()}] **${u.id}**${tags}\n  ${u.title}${excerpt ? `\n  _${excerpt}…_` : ''}`;
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${results.length} result(s):\n\n${lines.join('\n\n')}\n\nUse get_knowledge_unit(id) to read the full content of any result.`,
          },
        ],
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
          content: [
            {
              type: 'text' as const,
              text: `No knowledge unit found with ID "${id}". Available IDs: ${units.map((u) => u.id).join(', ')}`,
            },
          ],
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
      ]
        .filter(Boolean)
        .join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `# ${unit.title}\n\n${meta}\n\n---\n\n${unit.body}`,
          },
        ],
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
      if (brand)
        filtered = filtered.filter(
          (u) => isGlobal(u.brand) || u.brand === brand,
        );
      if (enforcement)
        filtered = filtered.filter((u) => u.enforcement === enforcement);

      filtered.sort(
        (a, b) =>
          (ENFORCEMENT_ORDER[a.enforcement] ?? 99) -
          (ENFORCEMENT_ORDER[b.enforcement] ?? 99),
      );

      const text = filtered
        .map(
          (u) =>
            `- **${u.id}** [${u.enforcement.toUpperCase()}]: ${u.title} (${u.tags.join(', ')})`,
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `${filtered.length} knowledge unit(s):\n\n${text}`,
          },
        ],
      };
    },
  );

  // --- Tool: get_brand_rules ---
  server.tool(
    'get_brand_rules',
    'List all knowledge units for a specific brand, sorted by enforcement. Returns an index of IDs, titles, and enforcement levels. Use get_knowledge_unit(id) to read a full unit.',
    {
      brand: z.string().describe('Brand name'),
    },
    async ({ brand }) => {
      // Filter to units for this brand (including shared/global units)
      const brandUnits = units.filter(
        (u) => isGlobal(u.brand) || u.brand === brand,
      );

      if (brandUnits.length === 0) {
        const availableBrands = [
          ...new Set(units.map((u) => u.brand).filter(Boolean)),
        ];
        return {
          content: [
            {
              type: 'text' as const,
              text: `No units found for brand "${brand}". Available brands: ${availableBrands.join(', ')}`,
            },
          ],
        };
      }

      // Sort by enforcement (must first), then title
      const order: Record<string, number> = {
        must: 0,
        should: 1,
        may: 2,
        context: 3,
        deprecated: 4,
      };
      brandUnits.sort(
        (a, b) =>
          (order[a.enforcement] ?? 9) - (order[b.enforcement] ?? 9) ||
          a.title.localeCompare(b.title),
      );

      const lines = brandUnits.map(
        (u) =>
          `- [${u.enforcement.toUpperCase()}] **${u.id}** — ${u.title}${u.tags.length ? ` (${u.tags.slice(0, 3).join(', ')})` : ''}`,
      );

      const text = `${brandUnits.length} knowledge unit(s) for brand "${brand}":\n\n${lines.join('\n')}\n\nUse get_knowledge_unit(id) to read the full content of any unit.`;

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // --- Tool: review_content ---
  server.tool(
    'review_content',
    'Review a piece of content against the knowledge base. Finds applicable rules by content similarity and presents them for compliance review.',
    {
      content: z.string().describe('The content text to review'),
      context: z
        .string()
        .optional()
        .describe(
          'Where this content appears (e.g. "error message", "button label")',
        ),
      brand: z.string().optional().describe('Brand context'),
    },
    async ({ content: contentText, context, brand }) => {
      // Prepend brand to query for natural BM25 weighting — brand is a relevance
      // signal here, not a hard filter, so we search across all units and let
      // the LLM determine cross-brand applicability.
      const brandPrefix = brand ? `${brand} ` : '';
      const query = `${brandPrefix}${context ? `${context} ` : ''}${contentText}`;

      const scored = await search.semanticSearch(query, { limit: 15 });

      if (scored.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No applicable rules found for this content.',
            },
          ],
        };
      }

      const rulesText = scored
        .map((r) => {
          const brandTag = r.unit.brand ? ` [${r.unit.brand}]` : '';
          const excerpt =
            r.unit.body.length > EXCERPT_CHARS
              ? `${r.unit.body.slice(0, EXCERPT_CHARS)}\n[…truncated]`
              : r.unit.body;
          return `### ${r.unit.title} [${r.unit.enforcement.toUpperCase()}]${brandTag}\n**ID:** ${r.unit.id}\n\n${excerpt}`;
        })
        .join('\n\n---\n\n');

      const brandLine = brand ? `\n**Brand context:** ${brand}` : '';
      const contextLine = context ? `\n**Context:** ${context}` : '';

      if (anthropic) {
        const model = options.model ?? DEFAULT_MODEL;
        const message = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          system:
            options.reviewSystemPrompt ??
            `You are a content reviewer. You review content against brand and product guidelines.

The guidelines retrieved may come from different brands or sources. Use judgment to determine whether a guideline applies to the content being reviewed — a guideline from one brand may still be relevant for another if no brand-specific standard exists.

When reviewing content, you:
1. Identify which rules apply to the content based on the guidelines provided
2. State clearly whether the content follows or violates each applicable rule
3. Note the source brand of each guideline when it differs from the content's brand
4. Explain any violations concisely and suggest corrections
5. Flag "must" violations — these are non-negotiable

Format your response as:
- A brief overall assessment (1–2 sentences)
- A bulleted list of findings (rule name, PASS/FAIL/WARN/N/A, brief explanation)
- If violations exist: specific correction suggestions`,
          messages: [
            {
              role: 'user',
              content: `Review this content against the guidelines below.

**Content:** "${contentText}"${contextLine}${brandLine}

**Guidelines retrieved (${scored.length}) — may include shared and cross-brand rules; apply judgment on relevance:**

${rulesText}`,
            },
          ],
        });

        const responseText = (
          message.content as Array<{ type: string; text?: string }>
        )
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('');

        return { content: [{ type: 'text' as const, text: responseText }] };
      }

      // Fallback when no Anthropic client is configured: return the raw prompt
      const prompt = `Review this content against the design rules below.

**Content to review:** "${contentText}"${contextLine}${brandLine}

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
  // Path 1: pre-built JSON bundle(s)
  const allPaths = [
    ...(options.bundlePath ? [options.bundlePath] : []),
    ...(options.bundlePaths ?? []),
  ];

  if (allPaths.length > 0) {
    const allUnits: KnowledgeUnit[] = [];

    for (const bundlePath of allPaths) {
      const absPath = bundlePath.startsWith('/')
        ? bundlePath
        : `${baseDir}/${bundlePath}`;

      if (!existsSync(absPath)) {
        console.error(`Bundle not found: ${absPath}`);
        process.exit(1);
      }

      const bundle = JSON.parse(readFileSync(absPath, 'utf-8')) as {
        units?: KnowledgeUnit[];
      };
      allUnits.push(...(bundle.units ?? []));
    }

    // Try to load config for brand resolution (optional)
    let config: MadrigalConfig | null = null;
    try {
      config = loadConfig(options.configPath);
    } catch {
      // Config not required when serving from bundle
    }

    return { units: allUnits, config };
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
