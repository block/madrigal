/**
 * Madrigal init — scans knowledge source files and generates a suggested
 * madrigal.config.yaml, including fieldMappings and levels if the team's
 * frontmatter doesn't already use Madrigal's default vocabulary.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_WEIGHT_LEVELS } from './weight.js';

/** Madrigal's normalized field names. */
const MADRIGAL_FIELDS = new Set([
  'id',
  'title',
  'domain',
  'kind',
  'brand',
  'system',
  'tags',
  'weight',
  'enforcement', // deprecated alias
  'severity', // deprecated alias
  'attributes',
  'provenance',
  'body',
  'entries',
]);

/**
 * Fields that map to a Madrigal concept — used for heuristic detection.
 * Key = candidate field name, value = Madrigal target field.
 */
const FIELD_HEURISTICS: Record<string, string> = {
  // id candidates
  key: 'id',
  uid: 'id',
  slug: 'id',
  name: 'id',
  // title candidates
  label: 'title',
  heading: 'title',
  summary: 'title',
  // domain candidates
  category: 'domain',
  section: 'domain',
  area: 'domain',
  topic: 'domain',
  // brand candidates
  product: 'brand',
  team: 'brand',
  owner: 'brand',
  // kind candidates
  type: 'kind',
  format: 'kind',
  // weight candidates
  status: 'weight',
  severity: 'weight',
  priority: 'weight',
  level: 'weight',
  importance: 'weight',
  maturity: 'weight',
  // tags candidates
  keywords: 'tags',
  labels: 'tags',
};

/** Values commonly used for weight/enforcement — used for level detection. */
const KNOWN_WEIGHT_VOCABULARIES: Record<string, string[]> = {
  'design-system-maturity': ['stable', 'beta', 'experimental', 'deprecated'],
  'compliance-type': ['BASE', 'ADDON'],
  'status-lifecycle': ['active', 'draft', 'deprecated'],
  'priority-levels': ['critical', 'high', 'medium', 'low'],
  adoption: ['required', 'recommended', 'optional', 'deprecated'],
};

export interface FieldSummary {
  /** Field name found in frontmatter */
  name: string;
  /** Number of files that use this field */
  count: number;
  /** All distinct values seen */
  values: string[];
  /** Suggested Madrigal target field (if any) */
  suggestedMapping?: string;
}

export interface InitAnalysis {
  /** All frontmatter fields found, sorted by frequency */
  fields: FieldSummary[];
  /** Distinct domain values found */
  domains: string[];
  /** Distinct brand values found */
  brands: string[];
  /** Distinct kind values found */
  kinds: string[];
  /** Distinct weight/enforcement values found (from any weight-candidate field) */
  weightValues: string[];
  /** Field name that looks most like the weight field */
  weightField?: string;
  /** Total files scanned */
  fileCount: number;
}

/**
 * Scan knowledge source files and return an analysis of their frontmatter.
 */
export async function analyzeKnowledgeSources(
  sources: string[],
  baseDir: string = process.cwd(),
): Promise<InitAnalysis> {
  const files = await fg(sources, {
    cwd: baseDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  const fieldCounts = new Map<string, number>();
  const fieldValues = new Map<string, Set<string>>();

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = filePath.endsWith('.yaml') || filePath.endsWith('.yml');
      const data: Record<string, unknown> = ext
        ? ((parseYaml(content) as Record<string, unknown>) ?? {})
        : (matter(content).data as Record<string, unknown>);

      for (const [key, value] of Object.entries(data)) {
        if (key === 'entries' && Array.isArray(value)) {
          // Recurse into multi-unit YAML entries
          for (const entry of value as Record<string, unknown>[]) {
            for (const [ek, ev] of Object.entries(entry)) {
              addField(fieldCounts, fieldValues, ek, ev);
            }
          }
        } else {
          addField(fieldCounts, fieldValues, key, value);
        }
      }
    } catch {
      // Skip unparseable files
    }
  }

  const fields: FieldSummary[] = Array.from(fieldCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => {
      const values = Array.from(fieldValues.get(name) ?? []).slice(0, 20);
      const suggestedMapping = !MADRIGAL_FIELDS.has(name)
        ? FIELD_HEURISTICS[name.toLowerCase()]
        : undefined;
      return { name, count, values, suggestedMapping };
    });

  // Collect concept-specific values
  const domains = valuesFor(fieldValues, ['domain', 'category', 'section']);
  const brands = valuesFor(fieldValues, ['brand', 'product', 'team']);
  const kinds = valuesFor(fieldValues, ['kind', 'type', 'format']);

  // Detect weight field: prefer explicit 'weight'/'enforcement'/'severity', else heuristics
  const weightField = detectWeightField(fields);
  const weightValues = weightField
    ? Array.from(fieldValues.get(weightField) ?? [])
    : [];

  return {
    fields,
    domains,
    brands,
    kinds,
    weightValues,
    weightField,
    fileCount: files.length,
  };
}

function addField(
  counts: Map<string, number>,
  values: Map<string, Set<string>>,
  key: string,
  value: unknown,
): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
  if (!values.has(key)) values.set(key, new Set());
  if (value !== null && value !== undefined) {
    if (Array.isArray(value)) {
      for (const v of value) values.get(key)!.add(String(v));
    } else {
      values.get(key)!.add(String(value));
    }
  }
}

function valuesFor(
  fieldValues: Map<string, Set<string>>,
  candidates: string[],
): string[] {
  for (const c of candidates) {
    const v = fieldValues.get(c);
    if (v && v.size > 0) return Array.from(v);
  }
  return [];
}

function detectWeightField(fields: FieldSummary[]): string | undefined {
  // Explicit weight/enforcement/severity fields take priority
  for (const name of ['weight', 'enforcement', 'severity']) {
    if (fields.some((f) => f.name === name)) return name;
  }
  // Then check heuristic candidates
  for (const f of fields) {
    if (FIELD_HEURISTICS[f.name.toLowerCase()] === 'weight') return f.name;
  }
  return undefined;
}

/**
 * Detect weight level vocabulary from a set of observed values.
 * Returns the matching named vocabulary, or null if not recognized.
 */
export function detectWeightVocabulary(
  values: string[],
): { name: string; levels: string[] } | null {
  const lower = values.map((v) => v.toLowerCase());
  for (const [name, levels] of Object.entries(KNOWN_WEIGHT_VOCABULARIES)) {
    const lowerLevels = levels.map((l) => l.toLowerCase());
    if (lower.some((v) => lowerLevels.includes(v))) {
      return { name, levels };
    }
  }
  return null;
}

/**
 * Generate a suggested madrigal.config.yaml from an analysis.
 */
export function generateConfig(
  analysis: InitAnalysis,
  sourcesGlob: string = 'knowledge/**/*.md',
): string {
  const lines: string[] = [];

  lines.push('# Generated by madrigal init');
  lines.push('# Review and adjust before committing.');
  lines.push('');
  lines.push(`sources:`);
  lines.push(`  - "${sourcesGlob}"`);
  lines.push('');

  // Domains
  if (analysis.domains.length > 0) {
    lines.push('domains:');
    for (const d of analysis.domains.slice(0, 20)) {
      lines.push(`  ${d}:`);
      lines.push(`    description: ""`);
    }
  } else {
    lines.push('domains: {}');
  }
  lines.push('');

  // Brands
  if (analysis.brands.length > 0) {
    lines.push('brands:');
    for (const b of analysis.brands.slice(0, 10)) {
      lines.push(`  ${b}: {}`);
    }
  } else {
    lines.push('brands: {}');
  }
  lines.push('');

  // Kinds
  if (analysis.kinds.length > 0) {
    lines.push('kinds:');
    for (const k of analysis.kinds.slice(0, 10)) {
      lines.push(`  ${k}:`);
      lines.push(`    description: ""`);
    }
  } else {
    lines.push('kinds: {}');
  }
  lines.push('');

  lines.push('platforms: {}');
  lines.push('');

  // Weight levels
  const vocab = detectWeightVocabulary(analysis.weightValues);
  const isDefaultVocab =
    analysis.weightValues.length === 0 ||
    analysis.weightValues.every((v) =>
      (DEFAULT_WEIGHT_LEVELS as readonly string[]).includes(v),
    );

  if (!isDefaultVocab && analysis.weightValues.length > 0) {
    lines.push(
      '# Weight levels define how strongly a unit should influence decisions.',
    );
    lines.push('# Listed from highest to lowest importance.');
    if (vocab) {
      lines.push(`# Detected vocabulary: ${vocab.name}`);
      lines.push('levels:');
      for (const l of vocab.levels) {
        lines.push(`  - ${l}`);
      }
    } else {
      lines.push("# Adjust this ordering to match your team's convention.");
      lines.push('levels:');
      for (const v of analysis.weightValues.slice(0, 10)) {
        lines.push(`  - ${v}`);
      }
    }
    lines.push('');
  }

  // Field mappings
  const mappings: Array<{ target: string; source: string }> = [];
  for (const field of analysis.fields) {
    if (field.suggestedMapping) {
      mappings.push({ target: field.suggestedMapping, source: field.name });
    }
  }

  // Add weight field mapping if needed
  if (
    analysis.weightField &&
    analysis.weightField !== 'weight' &&
    !mappings.some((m) => m.target === 'weight')
  ) {
    mappings.push({ target: 'weight', source: analysis.weightField });
  }

  if (mappings.length > 0) {
    lines.push(
      "# fieldMappings: map your existing frontmatter field names to Madrigal's.",
    );
    lines.push(
      "# Remove any mappings where your field name already matches Madrigal's.",
    );
    lines.push('fieldMappings:');
    for (const { target, source } of mappings) {
      lines.push(`  ${target}: ${source}`);
    }

    // If the weight field has non-default values, suggest a value mapping
    if (
      analysis.weightField &&
      analysis.weightField !== 'weight' &&
      !isDefaultVocab &&
      analysis.weightValues.length > 0
    ) {
      lines.push('  # To translate your weight values, use the long form:');
      lines.push(`  # weight:`);
      lines.push(`  #   from: ${analysis.weightField}`);
      lines.push(`  #   values:`);
      for (const v of analysis.weightValues.slice(0, 8)) {
        lines.push(`  #     ${v}: must  # adjust target value`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Print a human-readable summary of the analysis to stdout.
 */
export function printAnalysisSummary(analysis: InitAnalysis): void {
  console.log(`\nScanned ${analysis.fileCount} files.\n`);

  const nonMadrigal = analysis.fields.filter(
    (f) => !MADRIGAL_FIELDS.has(f.name),
  );

  if (nonMadrigal.length > 0) {
    console.log('Non-standard fields found (candidates for fieldMappings):');
    for (const f of nonMadrigal) {
      const hint = f.suggestedMapping ? ` → ${f.suggestedMapping}` : '';
      const sample = f.values.slice(0, 4).join(', ');
      console.log(
        `  ${f.name} (${f.count} files)${hint}${sample ? ` — e.g. ${sample}` : ''}`,
      );
    }
    console.log('');
  }

  if (analysis.weightField && analysis.weightField !== 'weight') {
    const vocab = detectWeightVocabulary(analysis.weightValues);
    console.log(
      `Weight field detected: "${analysis.weightField}" with values: ${analysis.weightValues.join(', ')}`,
    );
    if (vocab) {
      console.log(`  Matched known vocabulary: ${vocab.name}`);
    } else {
      console.log(
        `  No known vocabulary match — review the suggested levels in the config.`,
      );
    }
    console.log('');
  }

  if (analysis.domains.length > 0) {
    console.log(`Domains: ${analysis.domains.join(', ')}`);
  }
  if (analysis.brands.length > 0) {
    console.log(`Brands: ${analysis.brands.join(', ')}`);
  }
  if (analysis.kinds.length > 0) {
    console.log(`Kinds: ${analysis.kinds.join(', ')}`);
  }

  const existing = analysis.fields.filter((f) => MADRIGAL_FIELDS.has(f.name));
  if (existing.length > 0) {
    console.log(
      `\nMadrigal fields already present: ${existing.map((f) => f.name).join(', ')}`,
    );
  }
}

/**
 * Run the init wizard: scan files, print summary, write suggested config.
 */
export async function runInit(options: {
  sources?: string[];
  baseDir?: string;
  output?: string;
  dryRun?: boolean;
}): Promise<void> {
  const baseDir = options.baseDir ?? process.cwd();
  const sources = options.sources ?? ['**/*.md', '**/*.yaml', '**/*.yml'];
  const output = options.output ?? 'madrigal.config.yaml';
  const outputPath = resolve(baseDir, output);

  console.log(`Scanning sources: ${sources.join(', ')}`);

  const analysis = await analyzeKnowledgeSources(sources, baseDir);
  printAnalysisSummary(analysis);

  const config = generateConfig(analysis, sources[0]);

  if (options.dryRun) {
    console.log('\n--- Suggested config (--dry-run) ---\n');
    console.log(config);
  } else {
    const { writeFileSync, existsSync } = await import('node:fs');
    if (existsSync(outputPath)) {
      console.log(
        `\n${output} already exists. Use --output to specify a different path, or --dry-run to preview.`,
      );
      return;
    }
    writeFileSync(outputPath, config, 'utf-8');
    console.log(`\nWrote suggested config to ${output}`);
    console.log(
      'Review it, adjust field mappings and levels, then run: madrigal build',
    );
  }
}
