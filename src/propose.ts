import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadConfig } from './config.js';
import { loadKnowledge } from './loader.js';
import type { KnowledgeUnit } from './schema/index.js';
import type { MadrigalConfig } from './config.js';
import type { Severity } from './severity.js';

/**
 * A function that sends a prompt to an LLM and returns the text response.
 * Callers provide their own implementation, keeping the core vendor-agnostic.
 */
export type LlmCompletionFn = (prompt: string) => Promise<string>;

export interface ProposeOptions {
  /** The rough input text to turn into knowledge unit(s) */
  input: string;
  /** LLM completion function — caller provides their own implementation */
  complete: LlmCompletionFn;
  /** Hint: target domain */
  domain?: string;
  /** Hint: target brand (omit for global) */
  brand?: string;
  /** Hint: severity level */
  severity?: Severity;
  /** If true, decompose input into multiple KUs */
  batch?: boolean;
  /** Base directory (defaults to cwd) */
  baseDir?: string;
}

export interface ProposeResult {
  filePath: string;
  title: string;
  domain: string;
  severity: string;
  tags: string[];
  related: Array<{ id: string; reason: string }>;
  skipped: boolean;
}

interface ProposedUnit {
  filename: string;
  title: string;
  domain: string;
  brand?: string;
  system?: string;
  severity: string;
  tags: string[];
  body: string;
}

/**
 * Propose one or more knowledge units from rough input.
 */
export async function propose(options: ProposeOptions): Promise<ProposeResult[]> {
  const baseDir = options.baseDir || process.cwd();

  // Load repo context
  const config = loadConfig();
  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });
  const existingUnits = loadResult.units;

  // Build the prompt
  const prompt = buildPrompt(options, config, existingUnits);

  // Call LLM
  const response = await options.complete(prompt);

  // Parse response into proposed units
  const proposed = parseProposedUnits(response);

  // Write files and find related units
  const results: ProposeResult[] = [];
  for (const unit of proposed) {
    const result = writeProposedUnit(unit, existingUnits, config, baseDir);
    results.push(result);
  }

  return results;
}

function buildPrompt(
  options: ProposeOptions,
  config: MadrigalConfig,
  existingUnits: KnowledgeUnit[],
): string {
  const domains = Object.keys(config.domains);
  const brands = Object.keys(config.brands);

  const existingList = existingUnits
    .map((u) => `- ${u.id}: "${u.title}" (domain: ${u.domain}, severity: ${u.severity})`)
    .join('\n');

  // Pick 2 diverse examples from existing units
  const examples = pickExamples(existingUnits);
  const exampleSection = examples
    .map((u) => formatUnitAsFile(u))
    .join('\n---\n\n');

  const hints: string[] = [];
  if (options.domain) hints.push(`Domain hint: ${options.domain}`);
  if (options.brand) hints.push(`Brand hint: ${options.brand} (place in brands/${options.brand}/ directory)`);
  if (options.severity) hints.push(`Severity hint: ${options.severity}`);
  if (!options.brand) hints.push('No brand specified — this should be a global rule (no brand field in frontmatter)');

  const batchInstruction = options.batch
    ? `The input may contain multiple distinct guidelines. Propose a SEPARATE knowledge unit for each distinct concept. Output multiple <unit> blocks.`
    : `Propose exactly ONE knowledge unit from this input. Output one <unit> block.`;

  return `You are helping author knowledge units for a design knowledge base.

A knowledge unit is a single, atomic rule, guideline, or pattern stored as a markdown file with YAML frontmatter. Each unit should be focused on one concept — complete enough to stand alone but narrow enough to be about one thing.

## Repository context

Available domains: ${domains.join(', ')}
Available brands: ${brands.join(', ')} (omit brand field for global rules)
Severity levels: error (must fix, blocks CI), warning (should fix), info (suggestion), context (background)
${hints.join('\n')}

## Existing units in this repo

${existingList || '(none yet)'}

## Example knowledge unit files

These show the expected format and quality:

${exampleSection}

## Instructions

${batchInstruction}

For each proposed unit, output it inside <unit> tags with this exact structure:

<unit>
<filename>kebab-case-name.md</filename>
<frontmatter>
title: "Human-readable title — key detail"
domain: ${options.domain || 'the-appropriate-domain'}
${options.brand ? `brand: ${options.brand}` : '# brand omitted for global rules'}
tags:
  - tag1
  - tag2
  - tag3
severity: ${options.severity || 'warning'}
provenance:
  origin: system-proposed
  confidence: 0.85
</frontmatter>
<body>
# Heading

The body in markdown. Include:
- A clear explanation of the rule/guideline
- Guidelines section with actionable bullets
- Examples section with Don't/Do pairs where applicable
</body>
</unit>

## Quality rules

- Title should be descriptive and include the key constraint (e.g., "Button copy — verb+object, sentence case, max 20 chars")
- Body should start with a clear 1-2 sentence explanation
- Include Do/Don't examples when the guideline has concrete right/wrong applications
- Use **Don't:** / **Do:** format (bold, with colon) for example pairs
- Tags should be 3-5 specific terms, not generic
- Severity: use "error" only for compliance/legal/accessibility violations. Use "warning" for best practices. Use "info" for suggestions and reference patterns.
- Do NOT duplicate an existing unit. If the input overlaps with an existing unit, note it but still create the new unit focused on the distinct aspect.

## Input to process

${options.input}`;
}

function pickExamples(units: KnowledgeUnit[]): KnowledgeUnit[] {
  if (units.length === 0) return [];
  if (units.length <= 2) return units;

  // Pick one with do/don't examples and one without (for variety)
  const withExamples = units.find((u) => u.body.includes("**Don't:**") || u.body.includes("**Do:**"));
  const withoutExamples = units.find((u) => !u.body.includes("**Don't:**") && !u.body.includes("**Do:**"));

  const picked: KnowledgeUnit[] = [];
  if (withExamples) picked.push(withExamples);
  if (withoutExamples) picked.push(withoutExamples);
  if (picked.length === 0) picked.push(units[0]);

  return picked.slice(0, 2);
}

function formatUnitAsFile(unit: KnowledgeUnit): string {
  const frontmatter: Record<string, unknown> = {
    title: unit.title,
    domain: unit.domain,
  };
  if (unit.brand) frontmatter.brand = unit.brand;
  if (unit.system) frontmatter.system = unit.system;
  frontmatter.tags = unit.tags;
  frontmatter.severity = unit.severity;
  frontmatter.provenance = unit.provenance;

  const yaml = stringifyYaml(frontmatter);
  return `---\n${yaml}---\n\n${unit.body}`;
}

export function parseProposedUnits(response: string): ProposedUnit[] {
  const units: ProposedUnit[] = [];
  const unitRegex = /<unit>([\s\S]*?)<\/unit>/g;
  let match;

  while ((match = unitRegex.exec(response)) !== null) {
    const block = match[1];

    const filename = extractTag(block, 'filename')?.trim() || 'untitled.md';
    const frontmatterRaw = extractTag(block, 'frontmatter')?.trim() || '';
    const body = extractTag(block, 'body')?.trim() || '';

    // Parse frontmatter fields using yaml library
    const fm = (parseYaml(frontmatterRaw) || {}) as Record<string, unknown>;
    const title = String(fm.title || filename.replace('.md', ''));
    const domain = String(fm.domain || 'content');
    const brand = fm.brand ? String(fm.brand) : undefined;
    const system = fm.system ? String(fm.system) : undefined;
    const severity = String(fm.severity || 'warning');
    const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];

    units.push({ filename, title, domain, brand, system, severity, tags, body });
  }

  if (units.length === 0) {
    throw new Error('Could not parse any knowledge units from the AI response. Raw response:\n' + response.slice(0, 500));
  }

  return units;
}

function extractTag(text: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(text);
  return match ? match[1] : undefined;
}

function writeProposedUnit(
  unit: ProposedUnit,
  existingUnits: KnowledgeUnit[],
  config: MadrigalConfig,
  baseDir: string,
): ProposeResult {
  // Determine output directory
  let dir: string;
  if (unit.brand) {
    const subdir = unit.system || unit.domain;
    dir = join(baseDir, 'knowledge', 'brands', unit.brand, subdir);
  } else {
    dir = join(baseDir, 'knowledge', 'global', unit.domain);
  }

  const filePath = join(dir, unit.filename);
  const relPath = relative(baseDir, filePath);

  // Check if file already exists
  if (existsSync(filePath)) {
    return {
      filePath: relPath,
      title: unit.title,
      domain: unit.domain,
      severity: unit.severity,
      tags: unit.tags,
      related: [],
      skipped: true,
    };
  }

  // Build frontmatter
  const frontmatterLines: string[] = [
    '---',
    `title: "${unit.title}"`,
    `domain: ${unit.domain}`,
  ];
  if (unit.brand) frontmatterLines.push(`brand: ${unit.brand}`);
  if (unit.system) frontmatterLines.push(`system: ${unit.system}`);
  frontmatterLines.push('tags:');
  for (const tag of unit.tags) {
    frontmatterLines.push(`  - ${tag}`);
  }
  frontmatterLines.push(`severity: ${unit.severity}`);
  frontmatterLines.push('provenance:');
  frontmatterLines.push('  origin: system-proposed');
  frontmatterLines.push('  confidence: 0.85');
  frontmatterLines.push('---');

  const fileContent = frontmatterLines.join('\n') + '\n\n' + unit.body + '\n';

  // Write
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, fileContent, 'utf-8');

  // Find related existing units (by tag overlap)
  const related = findRelated(unit, existingUnits);

  return {
    filePath: relPath,
    title: unit.title,
    domain: unit.domain,
    severity: unit.severity,
    tags: unit.tags,
    related,
    skipped: false,
  };
}

export function findRelated(
  proposed: ProposedUnit,
  existingUnits: KnowledgeUnit[],
): Array<{ id: string; reason: string }> {
  const results: Array<{ id: string; reason: string; score: number }> = [];

  for (const existing of existingUnits) {
    let score = 0;
    const reasons: string[] = [];

    // Tag overlap
    const sharedTags = proposed.tags.filter((t) => existing.tags.includes(t));
    if (sharedTags.length > 0) {
      score += sharedTags.length;
      reasons.push(`tags overlap: ${sharedTags.join(', ')}`);
    }

    // Same domain
    if (proposed.domain === existing.domain) {
      score += 0.5;
    }

    // Title word overlap (crude but effective)
    const proposedWords = new Set(proposed.title.toLowerCase().split(/\W+/));
    const existingWords = new Set(existing.title.toLowerCase().split(/\W+/));
    const sharedWords = [...proposedWords].filter(
      (w) => existingWords.has(w) && w.length > 3
    );
    if (sharedWords.length >= 2) {
      score += sharedWords.length * 0.5;
      reasons.push('similar topic');
    }

    if (score >= 1.5) {
      results.push({ id: existing.id, reason: reasons.join('; '), score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ id, reason }) => ({ id, reason }));
}
