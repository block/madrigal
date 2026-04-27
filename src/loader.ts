import { readFileSync } from 'node:fs';
import { basename, extname, relative } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import type { FieldMapping, MadrigalConfig } from './config.js';
import { createFileProvenance } from './provenance.js';
import type { KnowledgeFrontmatter, KnowledgeUnit } from './schema/index.js';
import { defaultWeight, parseWeight } from './weight.js';

/**
 * Apply fieldMappings from config to a raw frontmatter/YAML object.
 *
 * For each entry in fieldMappings:
 *   - Simple form ("id": "key"): copies raw["key"] → raw["id"] if not already set
 *   - Complex form ("weight": { from: "status", values: { active: "must" } }):
 *     reads raw["status"], translates via values map, writes to raw["weight"]
 *
 * Modifies the object in place and returns it.
 */
export function applyFieldMappings(
  raw: Record<string, unknown>,
  mappings: Record<string, FieldMapping>,
): Record<string, unknown> {
  for (const [targetField, mapping] of Object.entries(mappings)) {
    if (typeof mapping === 'string') {
      // Simple rename: only apply if target not already populated
      if (raw[targetField] === undefined && raw[mapping] !== undefined) {
        raw[targetField] = raw[mapping];
      }
    } else {
      // Complex: rename + optional value translation
      const sourceValue = raw[mapping.from];
      if (raw[targetField] === undefined && sourceValue !== undefined) {
        const strValue = String(sourceValue);
        raw[targetField] =
          mapping.values?.[strValue] !== undefined
            ? mapping.values[strValue]
            : strValue;
      }
    }
  }
  return raw;
}

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
  const levels = config.levels;
  const fieldMappings = config.fieldMappings;

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
          levels,
          fieldMappings,
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
          levels,
          fieldMappings,
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

  // Detect duplicate IDs — silently taking the first would lose units in the BM25 index
  const idSeen = new Map<string, string>(); // id → first unit title
  for (const unit of units) {
    const first = idSeen.get(unit.id);
    if (first) {
      warnings.push({
        filePath: unit.id,
        message: `Duplicate ID "${unit.id}" (also used by "${first}"). Add explicit id: frontmatter to disambiguate. The second unit will be silently dropped by the search index.`,
      });
    } else {
      idSeen.set(unit.id, unit.title);
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
  levels: string[],
  fieldMappings: Record<string, FieldMapping>,
  warnings: LoadWarning[],
): KnowledgeUnit | null {
  const content = readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  applyFieldMappings(data as Record<string, unknown>, fieldMappings);
  const frontmatter = data as KnowledgeFrontmatter;

  // Validate required fields
  if (!frontmatter.title && !frontmatter.id) {
    warnings.push({
      filePath,
      message: 'Missing title and id in frontmatter; using filename',
    });
  }

  // Generate ID from filename if not provided.
  // Include brand prefix so cross-brand files with the same filename stay unique.
  const id =
    frontmatter.id || generateIdFromFilename(filePath, frontmatter.brand);
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

  // Parse weight (accepts weight:, weight:, severity: in that priority order)
  const fallbackWeight = defaultWeight(levels);
  let weight: string = fallbackWeight;
  const rawWeight =
    frontmatter.weight || frontmatter.weight || frontmatter.severity;
  if (rawWeight) {
    const parsed = parseWeight(rawWeight, levels);
    if (parsed) {
      weight = parsed;
    } else {
      warnings.push({
        filePath,
        field: 'weight',
        message: `Unknown weight "${rawWeight}". Using "${fallbackWeight}". Valid levels: ${levels.join(', ')}`,
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
    weight,
    enforcement: weight,
    attributes,
    provenance,
    sourcePath: relative(baseDir, filePath),
  };
}

/**
 * Generate a slug ID from a filename.
 * When a brand is provided, prefixes the slug with `{brand}-` so that
 * cross-brand files with the same filename (e.g. voice-principles.md in both
 * `shared/` and `tidal/`) produce unique IDs.
 */
function generateIdFromFilename(filePath: string, brand?: string): string {
  const ext = extname(filePath);
  const name = basename(filePath, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return brand ? `${brand}-${name}` : name;
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
  'weight',
  'weight', // deprecated alias
  'severity', // deprecated alias
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
  levels: string[],
  fieldMappings: Record<string, FieldMapping>,
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
  // Apply field mappings to the top-level object before parsing
  applyFieldMappings(parsed, fieldMappings);

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
        levels,
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
      levels,
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
  levels: string[],
  warnings: LoadWarning[],
): KnowledgeUnit {
  // Merge top-level defaults with entry overrides
  const merged = entry ? { ...topLevel, ...entry } : { ...topLevel };

  // Extract standard fields
  const topLevelBrand = topLevel.brand ? String(topLevel.brand) : undefined;
  const parentId = String(
    topLevel.id || generateIdFromFilename(filePath, topLevelBrand),
  );
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

  // Parse weight (accepts weight:, weight:, severity: in that priority order)
  const fallbackWeight = defaultWeight(levels);
  let weight: string = fallbackWeight;
  const rawWeight = (merged.weight || merged.weight || merged.severity) as
    | string
    | undefined;
  if (rawWeight) {
    const parsedWeight = parseWeight(String(rawWeight), levels);
    if (parsedWeight) {
      weight = parsedWeight;
    } else {
      warnings.push({
        filePath,
        field: 'weight',
        message: `Unknown weight "${rawWeight}" in YAML unit "${id}". Using "${fallbackWeight}". Valid levels: ${levels.join(', ')}`,
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
      'weight',
      'weight',
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
    weight,
    enforcement: weight,
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
  const levels = config.levels;
  const fieldMappings = config.fieldMappings;

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
          levels,
          fieldMappings,
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
          levels,
          fieldMappings,
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
