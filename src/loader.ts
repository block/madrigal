import { readFileSync } from 'node:fs';
import { basename, extname, relative } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import type { MadrigalConfig } from './config.js';
import type { Enforcement } from './enforcement.js';
import { parseEnforcement } from './enforcement.js';
import { createFileProvenance } from './provenance.js';
import type { KnowledgeFrontmatter, KnowledgeUnit } from './schema/index.js';

/**
 * Options for loading knowledge units.
 */
export interface LoadOptions {
  /** Glob patterns from config sources */
  sources: string[];
  /** The Madrigal configuration */
  config: MadrigalConfig;
  /** Base directory for resolving globs (defaults to cwd) */
  baseDir?: string;
}

/**
 * Error that occurred while loading a file.
 */
export interface LoadError {
  /** Path to the file */
  filePath: string;
  /** Error message */
  message: string;
  /** Original error if available */
  error?: Error;
}

/**
 * Warning about a loaded file.
 */
export interface LoadWarning {
  /** Path to the file */
  filePath: string;
  /** Warning message */
  message: string;
  /** Field that caused the warning */
  field?: string;
}

/**
 * Result of loading knowledge units.
 */
export interface LoadResult {
  /** Successfully loaded knowledge units */
  units: KnowledgeUnit[];
  /** Files that failed to parse */
  errors: LoadError[];
  /** Files with validation warnings */
  warnings: LoadWarning[];
}

/**
 * Load knowledge units from markdown files.
 *
 * @param options - Load options including source patterns and config
 * @returns Loaded units with any errors and warnings
 */
export async function loadKnowledge(options: LoadOptions): Promise<LoadResult> {
  const { sources, config, baseDir = process.cwd() } = options;
  const units: KnowledgeUnit[] = [];
  const errors: LoadError[] = [];
  const warnings: LoadWarning[] = [];

  // Find all matching files
  const files = await fg(sources, {
    cwd: baseDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  const domainNames = new Set(Object.keys(config.domains));
  const kindNames = new Set(Object.keys(config.kinds));
  const brandNames = new Set(Object.keys(config.brands));
  brandNames.add('global'); // 'global' is always valid

  for (const filePath of files) {
    try {
      const ext = extname(filePath).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        const parsed = parseKnowledgeYamlFile(
          filePath,
          baseDir,
          domainNames,
          kindNames,
          brandNames,
          warnings,
        );
        units.push(...parsed);
      } else {
        const unit = parseKnowledgeFile(
          filePath,
          baseDir,
          domainNames,
          kindNames,
          brandNames,
          warnings,
        );
        if (unit) {
          units.push(unit);
        }
      }
    } catch (err) {
      errors.push({
        filePath,
        message: err instanceof Error ? err.message : String(err),
        error: err instanceof Error ? err : undefined,
      });
    }
  }

  return { units, errors, warnings };
}

/**
 * Parse a single knowledge markdown file.
 */
function parseKnowledgeFile(
  filePath: string,
  baseDir: string,
  domainNames: Set<string>,
  kindNames: Set<string>,
  brandNames: Set<string>,
  warnings: LoadWarning[],
): KnowledgeUnit | null {
  const content = readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  const frontmatter = data as KnowledgeFrontmatter;

  // Validate required fields
  if (!frontmatter.title && !frontmatter.id) {
    warnings.push({
      filePath,
      message: 'Missing title and id in frontmatter; using filename',
    });
  }

  // Generate ID from filename if not provided
  const id = frontmatter.id || generateIdFromFilename(filePath);
  const title = frontmatter.title || id;

  // Validate domain
  const domain = frontmatter.domain || 'default';
  if (!domainNames.has(domain) && domainNames.size > 0) {
    warnings.push({
      filePath,
      field: 'domain',
      message: `Unknown domain "${domain}". Known domains: ${Array.from(domainNames).join(', ')}`,
    });
  }

  // Validate brand
  if (frontmatter.brand && !brandNames.has(frontmatter.brand)) {
    warnings.push({
      filePath,
      field: 'brand',
      message: `Unknown brand "${frontmatter.brand}". Known brands: ${Array.from(brandNames).join(', ')}`,
    });
  }

  // Parse kind (default: 'rule')
  const kind = frontmatter.kind || 'rule';
  if (frontmatter.kind && kindNames.size > 0 && !kindNames.has(kind)) {
    warnings.push({
      filePath,
      field: 'kind',
      message: `Unknown kind "${kind}". Known kinds: ${Array.from(kindNames).join(', ')}`,
    });
  }

  // Parse enforcement (with backward compat for 'severity' field)
  let enforcement: Enforcement = 'may';
  const rawEnforcement = frontmatter.enforcement || frontmatter.severity;
  if (rawEnforcement) {
    const parsed = parseEnforcement(rawEnforcement);
    if (parsed) {
      enforcement = parsed;
    } else {
      warnings.push({
        filePath,
        field: 'enforcement',
        message: `Invalid enforcement "${rawEnforcement}". Using "may".`,
      });
    }
  }

  // Parse attributes
  const attributes =
    ((frontmatter as Record<string, unknown>).attributes as Record<
      string,
      unknown
    >) || {};

  // Build provenance
  const provenance = frontmatter.provenance
    ? {
        ...createFileProvenance(),
        ...frontmatter.provenance,
      }
    : createFileProvenance();

  return {
    id,
    title,
    body: body.trim(),
    domain,
    kind,
    system: frontmatter.system,
    brand: frontmatter.brand,
    tags: frontmatter.tags || [],
    enforcement,
    attributes,
    provenance,
    sourcePath: relative(baseDir, filePath),
  };
}

/**
 * Generate a slug ID from a filename.
 */
function generateIdFromFilename(filePath: string): string {
  const ext = extname(filePath);
  const name = basename(filePath, ext);
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Known metadata keys in YAML knowledge files.
 * Everything else goes into attributes.
 */
const KNOWN_YAML_KEYS = new Set([
  'id',
  'title',
  'domain',
  'kind',
  'system',
  'brand',
  'tags',
  'enforcement',
  'severity',
  'provenance',
  'body',
  'entries',
]);

/**
 * Parse a YAML knowledge file.
 *
 * Supports two modes:
 * - Single-unit: top-level YAML becomes one KnowledgeUnit
 * - Multi-unit: when an `entries` array key exists, each entry becomes its own unit,
 *   inheriting top-level metadata as defaults
 */
function parseKnowledgeYamlFile(
  filePath: string,
  baseDir: string,
  domainNames: Set<string>,
  kindNames: Set<string>,
  brandNames: Set<string>,
  warnings: LoadWarning[],
): KnowledgeUnit[] {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(content) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    warnings.push({
      filePath,
      message: 'YAML file parsed to null or non-object',
    });
    return [];
  }

  const entries = parsed.entries as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(entries)) {
    // Multi-unit mode: each entry becomes a unit, inheriting top-level defaults
    return entries.map((entry, index) =>
      buildYamlUnit(
        filePath,
        baseDir,
        parsed,
        entry,
        index,
        domainNames,
        kindNames,
        brandNames,
        warnings,
      ),
    );
  }

  // Single-unit mode
  return [
    buildYamlUnit(
      filePath,
      baseDir,
      parsed,
      undefined,
      0,
      domainNames,
      kindNames,
      brandNames,
      warnings,
    ),
  ];
}

/**
 * Build a KnowledgeUnit from YAML data, with optional entry override.
 */
function buildYamlUnit(
  filePath: string,
  baseDir: string,
  topLevel: Record<string, unknown>,
  entry: Record<string, unknown> | undefined,
  index: number,
  domainNames: Set<string>,
  kindNames: Set<string>,
  brandNames: Set<string>,
  warnings: LoadWarning[],
): KnowledgeUnit {
  // Merge top-level defaults with entry overrides
  const merged = entry ? { ...topLevel, ...entry } : { ...topLevel };

  // Extract standard fields
  const parentId = String(topLevel.id || generateIdFromFilename(filePath));
  const id = entry ? String(entry.id || `${parentId}--${index}`) : parentId;
  const title = String(merged.title || id);
  const domain = String(merged.domain || 'default');
  const kind = String(merged.kind || 'rule');
  const system = merged.system ? String(merged.system) : undefined;
  const brand = merged.brand ? String(merged.brand) : undefined;
  const tags = Array.isArray(merged.tags)
    ? (merged.tags as unknown[]).map(String)
    : [];

  // Validate domain
  if (domainNames.size > 0 && !domainNames.has(domain)) {
    warnings.push({
      filePath,
      field: 'domain',
      message: `Unknown domain "${domain}" in YAML unit "${id}"`,
    });
  }

  // Validate kind
  if (kindNames.size > 0 && !kindNames.has(kind)) {
    warnings.push({
      filePath,
      field: 'kind',
      message: `Unknown kind "${kind}" in YAML unit "${id}"`,
    });
  }

  // Validate brand
  if (brand && !brandNames.has(brand)) {
    warnings.push({
      filePath,
      field: 'brand',
      message: `Unknown brand "${brand}" in YAML unit "${id}"`,
    });
  }

  // Parse enforcement
  let enforcement: Enforcement = 'may';
  const rawEnforcement = (merged.enforcement || merged.severity) as
    | string
    | undefined;
  if (rawEnforcement) {
    const parsed = parseEnforcement(String(rawEnforcement));
    if (parsed) {
      enforcement = parsed;
    } else {
      warnings.push({
        filePath,
        field: 'enforcement',
        message: `Invalid enforcement "${rawEnforcement}" in YAML unit "${id}". Using "may".`,
      });
    }
  }

  // Collect attributes: everything that's not a known metadata key
  const attributes: Record<string, unknown> = {};
  const mergedAttrs = (merged.attributes || {}) as Record<string, unknown>;
  // Explicit attributes field takes priority
  Object.assign(attributes, mergedAttrs);
  // Also collect any unknown top-level keys from the entry as attributes
  if (entry) {
    for (const [key, value] of Object.entries(entry)) {
      if (!KNOWN_YAML_KEYS.has(key) && key !== 'attributes') {
        attributes[key] = value;
      }
    }
  }

  // Build provenance
  const rawProvenance = merged.provenance as
    | Partial<import('./provenance.js').Provenance>
    | undefined;
  const provenance = rawProvenance
    ? { ...createFileProvenance(), ...rawProvenance }
    : createFileProvenance();

  // Body: use explicit body field, or stringify the entry data for structured entries
  let body = '';
  if (typeof merged.body === 'string') {
    body = merged.body.trim();
  } else if (entry) {
    // For structured entries without explicit body, create a readable representation
    const bodyData = { ...entry };
    for (const key of [
      'id',
      'title',
      'domain',
      'kind',
      'system',
      'brand',
      'tags',
      'enforcement',
      'severity',
      'provenance',
      'body',
    ]) {
      delete bodyData[key];
    }
    if (Object.keys(bodyData).length > 0) {
      body = Object.entries(bodyData)
        .map(
          ([k, v]) =>
            `**${k}:** ${Array.isArray(v) ? v.join(', ') : String(v)}`,
        )
        .join('\n\n');
    }
  }

  return {
    id,
    title,
    body,
    domain,
    kind,
    system,
    brand,
    tags,
    enforcement,
    attributes,
    provenance,
    sourcePath: relative(baseDir, filePath),
  };
}

/**
 * Synchronous version of loadKnowledge for simple use cases.
 */
export function loadKnowledgeSync(options: LoadOptions): LoadResult {
  const { sources, config, baseDir = process.cwd() } = options;
  const units: KnowledgeUnit[] = [];
  const errors: LoadError[] = [];
  const warnings: LoadWarning[] = [];

  // Find all matching files (sync)
  const files = fg.sync(sources, {
    cwd: baseDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  const domainNames = new Set(Object.keys(config.domains));
  const kindNames = new Set(Object.keys(config.kinds));
  const brandNames = new Set(Object.keys(config.brands));
  brandNames.add('global');

  for (const filePath of files) {
    try {
      const ext = extname(filePath).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        const parsed = parseKnowledgeYamlFile(
          filePath,
          baseDir,
          domainNames,
          kindNames,
          brandNames,
          warnings,
        );
        units.push(...parsed);
      } else {
        const unit = parseKnowledgeFile(
          filePath,
          baseDir,
          domainNames,
          kindNames,
          brandNames,
          warnings,
        );
        if (unit) {
          units.push(unit);
        }
      }
    } catch (err) {
      errors.push({
        filePath,
        message: err instanceof Error ? err.message : String(err),
        error: err instanceof Error ? err : undefined,
      });
    }
  }

  return { units, errors, warnings };
}
