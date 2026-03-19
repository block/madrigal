import { readFileSync } from 'node:fs';
import { basename, relative } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import type { MadrigalConfig } from './config.js';
import type {
  KnowledgeUnit,
  KnowledgeFrontmatter,
} from './schema/index.js';
import type { Severity } from './severity.js';
import { createFileProvenance } from './provenance.js';
import { parseSeverity } from './severity.js';

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
  const brandNames = new Set(Object.keys(config.brands));
  brandNames.add('global'); // 'global' is always valid

  for (const filePath of files) {
    try {
      const unit = parseKnowledgeFile(
        filePath,
        baseDir,
        domainNames,
        brandNames,
        warnings
      );
      if (unit) {
        units.push(unit);
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
  brandNames: Set<string>,
  warnings: LoadWarning[]
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

  // Parse severity
  let severity: Severity = 'info';
  if (frontmatter.severity) {
    const parsed = parseSeverity(frontmatter.severity);
    if (parsed) {
      severity = parsed;
    } else {
      warnings.push({
        filePath,
        field: 'severity',
        message: `Invalid severity "${frontmatter.severity}". Using "info".`,
      });
    }
  }

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
    system: frontmatter.system,
    brand: frontmatter.brand,
    tags: frontmatter.tags || [],
    severity,
    provenance,
    sourcePath: relative(baseDir, filePath),
  };
}

/**
 * Generate a slug ID from a filename.
 */
function generateIdFromFilename(filePath: string): string {
  const name = basename(filePath, '.md');
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  const brandNames = new Set(Object.keys(config.brands));
  brandNames.add('global');

  for (const filePath of files) {
    try {
      const unit = parseKnowledgeFile(
        filePath,
        baseDir,
        domainNames,
        brandNames,
        warnings
      );
      if (unit) {
        units.push(unit);
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
