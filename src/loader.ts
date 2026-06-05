import { readFileSync } from 'node:fs';
import { basename, extname, relative } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import type { MadrigalConfig, VocabularyConfig } from './config.js';
import type { Enforcement } from './enforcement.js';
import { parseEnforcement } from './enforcement.js';
import { createFileProvenance } from './provenance.js';
import type {
  KnowledgeFrontmatter,
  KnowledgeRelationship,
  KnowledgeUnit,
} from './schema/index.js';

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
  /** Path to the file or conflicting generated ID */
  filePath: string;
  /** Machine-readable error category */
  code?: string;
  /** Error message */
  message: string;
  /** Original error if available */
  error?: Error;
}

/**
 * Warning or lint violation about a loaded file.
 */
export interface LoadWarning {
  /** Path to the file */
  filePath: string;
  /** Machine-readable warning category */
  code?: string;
  /** Severity. Validate treats "error" as failing; build warns and continues. */
  severity?: 'warning' | 'error';
  /** Warning message */
  message: string;
  /** Field that caused the warning */
  field?: string;
  /** Knowledge unit ID, when available */
  unitId?: string;
}

/**
 * Result of loading knowledge units.
 */
export interface LoadResult {
  /** Successfully loaded knowledge units */
  units: KnowledgeUnit[];
  /** Files that failed to parse or invalid duplicate records that were excluded */
  errors: LoadError[];
  /** Files with validation warnings or lint violations */
  warnings: LoadWarning[];
}

type ParsedUnit = KnowledgeUnit & {
  _relationshipTargets?: Array<{
    relationship: KnowledgeRelationship;
    targetKey: string;
  }>;
};

const CORE_FRONTMATTER_KEYS = new Set([
  'id',
  'title',
  'domain',
  'kind',
  'type',
  'system',
  'brand',
  'tags',
  'enforcement',
  'severity',
  'attributes',
  'provenance',
  'body',
  'entries',
]);

/**
 * Load knowledge units from markdown and YAML files.
 */
export async function loadKnowledge(options: LoadOptions): Promise<LoadResult> {
  const { sources, config, baseDir = process.cwd() } = options;
  const files = await fg(sources, {
    cwd: baseDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  return loadFiles(files, config, baseDir);
}

/**
 * Synchronous version of loadKnowledge for simple use cases.
 */
export function loadKnowledgeSync(options: LoadOptions): LoadResult {
  const { sources, config, baseDir = process.cwd() } = options;
  const files = fg.sync(sources, {
    cwd: baseDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  return loadFiles(files, config, baseDir);
}

function loadFiles(
  files: string[],
  config: MadrigalConfig,
  baseDir: string,
): LoadResult {
  const units: ParsedUnit[] = [];
  const errors: LoadError[] = [];
  const warnings: LoadWarning[] = [];

  for (const filePath of files) {
    try {
      const ext = extname(filePath).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        units.push(
          ...parseKnowledgeYamlFile(filePath, baseDir, config, warnings),
        );
      } else {
        const unit = parseKnowledgeMarkdownFile(
          filePath,
          baseDir,
          config,
          warnings,
        );
        if (unit) units.push(unit);
      }
    } catch (err) {
      errors.push({
        filePath,
        code: 'parse-error',
        message: err instanceof Error ? err.message : String(err),
        error: err instanceof Error ? err : undefined,
      });
    }
  }

  const deduped = excludeDuplicateIds(units, errors);
  resolveRelationships(deduped, config, warnings);

  return {
    units: deduped.map(stripInternalFields),
    errors,
    warnings,
  };
}

function parseKnowledgeMarkdownFile(
  filePath: string,
  baseDir: string,
  config: MadrigalConfig,
  warnings: LoadWarning[],
): ParsedUnit | null {
  const content = readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  const frontmatter = { ...(data as KnowledgeFrontmatter) };

  return buildUnit({
    filePath,
    baseDir,
    config,
    frontmatter,
    body: body.trim(),
    warnings,
  });
}

function parseKnowledgeYamlFile(
  filePath: string,
  baseDir: string,
  config: MadrigalConfig,
  warnings: LoadWarning[],
): ParsedUnit[] {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(content) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    warnings.push({
      filePath,
      code: 'yaml-non-object',
      severity: 'error',
      message: 'YAML file parsed to null or non-object',
    });
    return [];
  }

  const entries = parsed.entries as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(entries)) {
    return [
      buildUnit({
        filePath,
        baseDir,
        config,
        frontmatter: { ...parsed },
        body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
        warnings,
      }),
    ];
  }

  return entries.map((entry, index) => {
    const frontmatter = { ...parsed, ...entry };
    delete frontmatter.entries;
    const body =
      typeof frontmatter.body === 'string'
        ? frontmatter.body.trim()
        : stringifyStructuredBody(entry);

    return buildUnit({
      filePath,
      baseDir,
      config,
      frontmatter,
      body,
      warnings,
      entryIndex: index,
    });
  });
}

function buildUnit(options: {
  filePath: string;
  baseDir: string;
  config: MadrigalConfig;
  frontmatter: Record<string, unknown>;
  body: string;
  warnings: LoadWarning[];
  entryIndex?: number;
}): ParsedUnit {
  const { filePath, baseDir, config, frontmatter, body, warnings, entryIndex } =
    options;
  const sourcePath = normalizePath(relative(baseDir, filePath));
  const schema = config.schema;
  const explicitIdField = schema.id?.field || 'id';
  const titleField = schema.title?.field || 'title';

  const rawExplicitId = frontmatter[explicitIdField];
  const baseId =
    typeof rawExplicitId === 'string' && rawExplicitId.trim()
      ? rawExplicitId.trim()
      : generateId(filePath, baseDir, config);
  const id = entryIndex === undefined ? baseId : `${baseId}--${entryIndex}`;

  const rawTitle = frontmatter[titleField];
  const title =
    typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : id;
  if (!rawTitle && !rawExplicitId) {
    warnings.push({
      filePath,
      code: 'missing-title',
      severity: 'warning',
      message:
        'Missing title and id in frontmatter; using generated ID as title',
      unitId: id,
    });
  }

  const kind = resolveKind(sourcePath, frontmatter, config);
  const tags = normalizeStringArray(frontmatter.tags);
  const attributes = buildAttributes(frontmatter, config);

  applyVocabularies(attributes, config.vocabularies, {
    filePath,
    unitId: id,
    warnings,
  });

  const domain = getString(attributes.domain);
  const brand = getString(attributes.brand);
  const system = getString(attributes.system);
  const enforcement = parseUnitEnforcement(frontmatter, warnings, filePath, id);

  if (config.domains && Object.keys(config.domains).length > 0 && domain) {
    if (!config.domains[domain]) {
      warnings.push({
        filePath,
        code: 'unknown-domain',
        severity: 'error',
        field: 'domain',
        unitId: id,
        message: `Unknown domain "${domain}". Known domains: ${Object.keys(config.domains).join(', ')}`,
      });
    }
  }

  if (config.kinds && Object.keys(config.kinds).length > 0 && kind) {
    if (!config.kinds[kind]) {
      warnings.push({
        filePath,
        code: 'unknown-kind',
        severity: 'error',
        field: 'kind',
        unitId: id,
        message: `Unknown kind "${kind}". Known kinds: ${Object.keys(config.kinds).join(', ')}`,
      });
    }
  }

  if (config.brands && Object.keys(config.brands).length > 0 && brand) {
    const brandNames = new Set([...Object.keys(config.brands), 'global']);
    if (!brandNames.has(brand)) {
      warnings.push({
        filePath,
        code: 'unknown-brand',
        severity: 'error',
        field: 'brand',
        unitId: id,
        message: `Unknown brand "${brand}". Known brands: ${Array.from(brandNames).join(', ')}`,
      });
    }
  }

  const provenance = frontmatter.provenance
    ? {
        ...createFileProvenance(),
        ...(frontmatter.provenance as Record<string, unknown>),
      }
    : createFileProvenance();

  const relationships = config.schema.relationships?.wikilinks
    ? extractWikiLinks(body)
    : [];

  const unit: ParsedUnit = {
    id,
    title,
    body,
    kind,
    tags,
    sourcePath,
    frontmatter,
    attributes,
    relationships,
    provenance,
    domain,
    system,
    brand,
    enforcement,
    _relationshipTargets: relationships.map((relationship) => ({
      relationship,
      targetKey: relationship.target,
    })),
  };

  validateRequiredFields(unit, config, warnings, filePath);

  return unit;
}

function buildAttributes(
  frontmatter: Record<string, unknown>,
  config: MadrigalConfig,
): Record<string, unknown> {
  const explicitAttrs =
    frontmatter.attributes && typeof frontmatter.attributes === 'object'
      ? (frontmatter.attributes as Record<string, unknown>)
      : {};
  const attributes: Record<string, unknown> = { ...explicitAttrs };

  if (config.schema.preserveUnknownFrontmatter !== false) {
    const extraCoreKeys = new Set<string>();
    extraCoreKeys.add(config.schema.id?.field || 'id');
    extraCoreKeys.add(config.schema.kind?.field || 'kind');
    extraCoreKeys.add(config.schema.title?.field || 'title');

    for (const [key, value] of Object.entries(frontmatter)) {
      if (
        !CORE_FRONTMATTER_KEYS.has(key) &&
        !extraCoreKeys.has(key) &&
        key !== 'attributes'
      ) {
        attributes[key] = value;
      }
    }
  }

  for (const key of ['domain', 'brand', 'system']) {
    if (frontmatter[key] !== undefined) attributes[key] = frontmatter[key];
  }

  return attributes;
}

function resolveKind(
  sourcePath: string,
  frontmatter: Record<string, unknown>,
  config: MadrigalConfig,
): string {
  const kindField = config.schema.kind?.field || 'kind';
  const fieldValue = frontmatter[kindField];
  if (typeof fieldValue === 'string' && fieldValue.trim()) {
    return fieldValue.trim();
  }

  for (const [pattern, kind] of Object.entries(
    config.schema.kind?.byPath || {},
  )) {
    if (matchesGlob(sourcePath, pattern)) return kind;
  }

  return config.schema.kind?.default || 'rule';
}

function parseUnitEnforcement(
  frontmatter: Record<string, unknown>,
  warnings: LoadWarning[],
  filePath: string,
  unitId: string,
): Enforcement | undefined {
  const raw = frontmatter.enforcement || frontmatter.severity;
  if (!raw) return undefined;

  const parsed = parseEnforcement(String(raw));
  if (parsed) return parsed;

  warnings.push({
    filePath,
    code: 'invalid-enforcement',
    severity: 'error',
    field: 'enforcement',
    unitId,
    message: `Invalid enforcement "${String(raw)}".`,
  });
  return undefined;
}

function applyVocabularies(
  attributes: Record<string, unknown>,
  vocabularies: Record<string, VocabularyConfig>,
  context: {
    filePath: string;
    unitId: string;
    warnings: LoadWarning[];
  },
): void {
  for (const [field, vocabulary] of Object.entries(vocabularies)) {
    if (attributes[field] === undefined) continue;
    attributes[field] = normalizeVocabularyValue(
      attributes[field],
      field,
      vocabulary,
      context,
    );
  }
}

function normalizeVocabularyValue(
  value: unknown,
  field: string,
  vocabulary: VocabularyConfig,
  context: {
    filePath: string;
    unitId: string;
    warnings: LoadWarning[];
  },
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeVocabularyValue(item, field, vocabulary, context),
    );
  }

  if (typeof value !== 'string') return value;

  const canonical = vocabulary.aliases?.[value] || value;
  const allowed = new Set(vocabulary.values || []);
  if (allowed.size > 0 && !allowed.has(canonical)) {
    context.warnings.push({
      filePath: context.filePath,
      code: 'invalid-vocabulary',
      severity: 'error',
      field,
      unitId: context.unitId,
      message: `Invalid ${field} value "${value}". Allowed values: ${Array.from(allowed).join(', ')}`,
    });
  }

  return canonical;
}

function validateRequiredFields(
  unit: KnowledgeUnit,
  config: MadrigalConfig,
  warnings: LoadWarning[],
  filePath: string,
): void {
  const required = config.kinds[unit.kind]?.required || [];
  for (const field of required) {
    const value = getUnitFieldValue(unit, field);
    if (isMissing(value)) {
      warnings.push({
        filePath,
        code: 'missing-required-field',
        severity: 'error',
        field,
        unitId: unit.id,
        message: `Missing required field "${field}" for kind "${unit.kind}".`,
      });
    }
  }
}

function getUnitFieldValue(unit: KnowledgeUnit, field: string): unknown {
  if (field === 'id') return unit.id;
  if (field === 'title') return unit.title;
  if (field === 'kind') return unit.kind;
  if (field === 'body') return unit.body;
  if (field === 'tags') return unit.tags;
  if (field === 'domain') return unit.domain ?? unit.attributes.domain;
  if (field === 'brand') return unit.brand ?? unit.attributes.brand;
  if (field === 'system') return unit.system ?? unit.attributes.system;
  if (field === 'enforcement') return unit.enforcement;
  if (unit.attributes[field] !== undefined) return unit.attributes[field];
  return unit.frontmatter[field];
}

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function excludeDuplicateIds(
  units: ParsedUnit[],
  errors: LoadError[],
): ParsedUnit[] {
  const byId = new Map<string, ParsedUnit[]>();
  for (const unit of units) {
    const existing = byId.get(unit.id) || [];
    existing.push(unit);
    byId.set(unit.id, existing);
  }

  const duplicateIds = new Set<string>();
  for (const [id, records] of byId.entries()) {
    if (records.length <= 1) continue;
    duplicateIds.add(id);
    errors.push({
      filePath: id,
      code: 'duplicate-id',
      message: `Duplicate ID "${id}" across: ${records.map((u) => u.sourcePath).join(', ')}. Conflicting records were excluded.`,
    });
  }

  return units.filter((unit) => !duplicateIds.has(unit.id));
}

function resolveRelationships(
  units: ParsedUnit[],
  config: MadrigalConfig,
  warnings: LoadWarning[],
): void {
  if (!config.schema.relationships?.wikilinks) return;

  const index = buildRelationshipIndex(units, config);

  for (const unit of units) {
    for (const pending of unit._relationshipTargets || []) {
      const targetId = index.get(normalizeLookupKey(pending.targetKey));
      if (targetId) {
        pending.relationship.targetId = targetId;
        pending.relationship.resolved = true;
      } else {
        pending.relationship.resolved = false;
        warnings.push({
          filePath: unit.sourcePath || unit.id,
          code: 'unresolved-relationship',
          severity: 'error',
          unitId: unit.id,
          message: `Unresolved wikilink target "${pending.targetKey}".`,
        });
      }
    }
  }
}

function buildRelationshipIndex(
  units: KnowledgeUnit[],
  config: MadrigalConfig,
): Map<string, string> {
  const index = new Map<string, string>();
  const aliasToCanonical = new Map<string, string>();
  for (const vocabulary of Object.values(config.vocabularies)) {
    for (const [alias, canonical] of Object.entries(vocabulary.aliases || {})) {
      aliasToCanonical.set(normalizeLookupKey(alias), canonical);
    }
  }

  for (const unit of units) {
    addLookup(index, unit.id, unit.id);
    addLookup(index, unit.title, unit.id);
    addLookup(index, slug(unit.title), unit.id);
    if (unit.sourcePath) {
      const withoutExt = unit.sourcePath.replace(/\.[^.]+$/, '');
      addLookup(index, withoutExt, unit.id);
      addLookup(index, basename(withoutExt), unit.id);
      addLookup(index, slug(basename(withoutExt)), unit.id);
    }
  }

  for (const [aliasKey, canonical] of aliasToCanonical.entries()) {
    const targetId =
      index.get(normalizeLookupKey(canonical)) ||
      index.get(normalizeLookupKey(slug(canonical)));
    if (targetId && !index.has(aliasKey)) index.set(aliasKey, targetId);
  }

  return index;
}

function addLookup(index: Map<string, string>, key: string, id: string): void {
  const normalized = normalizeLookupKey(key);
  if (normalized && !index.has(normalized)) index.set(normalized, id);
}

function extractWikiLinks(body: string): KnowledgeRelationship[] {
  const relationships: KnowledgeRelationship[] = [];
  const seen = new Set<string>();
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  for (const match of body.matchAll(regex)) {
    const target = match[1].trim();
    const label = match[2]?.trim();
    const key = `${target}|${label || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    relationships.push({
      type: 'wikilink',
      target,
      label,
      resolved: false,
    });
  }

  return relationships;
}

function stripInternalFields(unit: ParsedUnit): KnowledgeUnit {
  const { _relationshipTargets, ...clean } = unit;
  return clean;
}

function generateId(
  filePath: string,
  baseDir: string,
  config: MadrigalConfig,
): string {
  const strategy = config.schema.id?.strategy || 'path';
  if (strategy === 'filename') {
    return slug(basename(filePath, extname(filePath)));
  }

  const sourcePath = normalizePath(relative(baseDir, filePath));
  const withoutExtension = sourcePath.replace(/\.[^.]+$/, '');
  const segments = withoutExtension.split('/');
  const last = segments[segments.length - 1];
  if (last === 'index' || last === '_index') {
    segments.pop();
  }

  return slug(segments.join('/'));
}

function stringifyStructuredBody(entry: Record<string, unknown>): string {
  const bodyData = { ...entry };
  for (const key of CORE_FRONTMATTER_KEYS) delete bodyData[key];

  return Object.entries(bodyData)
    .map(([k, v]) => `**${k}:** ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join('\n\n');
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function matchesGlob(path: string, pattern: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);
  const regex = new RegExp(`^${globToRegex(normalizedPattern)}$`);
  return regex.test(normalizedPath);
}

function globToRegex(pattern: string): string {
  let output = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const next = pattern[i + 1];
    if (char === '*' && next === '*') {
      output += '.*';
      i++;
    } else if (char === '*') {
      output += '[^/]*';
    } else if (char === '?') {
      output += '[^/]';
    } else {
      output += escapeRegex(char);
    }
  }
  return output;
}

function escapeRegex(char: string): string {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}
