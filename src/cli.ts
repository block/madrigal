#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, type MadrigalConfig, validateConfig } from './config.js';
import { defaultRegistry } from './formats/index.js';
import { loadKnowledge } from './loader.js';
import { build } from './pipeline.js';
import {
  type LlmCompletionFn,
  type ProposeOptions,
  propose,
} from './propose.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

// Load .env file if present (simple loader, no dependency needed)
function loadDotenv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = resolve(process.cwd(), name);
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const raw = trimmed.slice(eqIdx + 1).trim();
        // Strip matching surrounding quotes
        const value =
          (raw.startsWith('"') && raw.endsWith('"')) ||
          (raw.startsWith("'") && raw.endsWith("'"))
            ? raw.slice(1, -1)
            : raw;
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadDotenv();

const args = process.argv.slice(2);
const command = args[0];

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    process.exit(0);
  }

  if (hasFlag('--version') || hasFlag('-v')) {
    console.log(`madrigal v${pkg.version}`);
    process.exit(0);
  }

  switch (command) {
    case 'build':
      return runBuild();
    case 'validate':
      return runValidate();
    case 'propose':
      return runPropose();
    case 'dev':
      return runDev();
    case 'serve':
      return runServe();
    case 'check':
      return runCheck();
    case 'eval':
      return runEvalCmd();
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

function printUsage() {
  console.log(`madrigal v${pkg.version} — knowledge compiler

Commands:
  build       Compile knowledge units to all platforms
  validate    Check config and knowledge units for errors
  propose     Scaffold a new knowledge unit from rough input
  dev         Start the web-based knowledge explorer
  serve       Start an MCP server over stdio
  check       Check content against knowledge base for compliance
  eval        Evaluate search quality against golden prompts

Options:
  build [--platform <name>] [--dry-run]
  validate
  propose [--domain <d>] [--brand <b>] [--enforcement <e>] [--batch] <input>
  dev [--port <number>] [--open]
  serve [--bundle <path>]
  check [--brand <b>] [--domain <d>] [--format markdown|json|sarif] <input>
  eval [--golden-dir <path>]

Environment:
  ANTHROPIC_API_KEY   Required for 'propose' command (default provider)
`);
}

/**
 * madrigal build [--platform <name>] [--dry-run]
 */
async function runBuild() {
  const platform = parseFlag('--platform');
  const dryRun = hasFlag('--dry-run');
  const baseDir = process.cwd();

  const result = await build({ platform, dryRun, baseDir });

  if (!result.success) {
    console.error('Build failed:');
    for (const w of result.configWarnings) console.error(`  ${w}`);
    process.exit(1);
  }

  console.log(`Loaded ${result.totalUnits} knowledge unit(s)`);

  if (result.loadErrors.length > 0) {
    console.warn(`  ${result.loadErrors.length} load error(s):`);
    for (const e of result.loadErrors)
      console.warn(`    ${e.filePath}: ${e.message}`);
  }
  if (result.loadWarnings.length > 0) {
    for (const w of result.loadWarnings)
      console.warn(`    ${w.filePath}: ${w.message}`);
  }
  if (result.configWarnings.length > 0) {
    for (const w of result.configWarnings) console.warn(`  ${w}`);
  }

  console.log(`\nCompiled ${result.results.length} output(s):\n`);

  for (const r of result.results) {
    const label = r.group ? `${r.platform}/${r.group}` : r.platform;
    console.log(`  ${label} (${r.format}) — ${r.unitCount} unit(s)`);

    if (!dryRun) {
      // Write output files
      const outDir = r.group
        ? join('publish', `to-${r.platform}`, r.group)
        : join('publish', `to-${r.platform}`);
      mkdirSync(outDir, { recursive: true });

      const ext = r.format.includes('json') ? '.json' : '.md';
      const outFile = join(outDir, `knowledge${ext}`);
      writeFileSync(outFile, r.output, 'utf-8');
      console.log(`    → ${outFile}`);
    }
  }

  console.log('\nBuild complete.');
}

/**
 * madrigal validate
 */
async function runValidate() {
  const baseDir = process.cwd();

  let config: MadrigalConfig;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`Config error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const validation = validateConfig(config, defaultRegistry.list());
  if (validation.errors.length > 0) {
    console.error('Config errors:');
    for (const e of validation.errors)
      console.error(`  ${e.path}: ${e.message}`);
  }
  if (validation.warnings.length > 0) {
    console.warn('Config warnings:');
    for (const w of validation.warnings)
      console.warn(`  ${w.path}: ${w.message}`);
  }

  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });

  console.log(`${loadResult.units.length} knowledge unit(s) loaded`);

  if (loadResult.errors.length > 0) {
    console.error(`\n${loadResult.errors.length} load error(s):`);
    for (const e of loadResult.errors)
      console.error(`  ${e.filePath}: ${e.message}`);
  }
  if (loadResult.warnings.length > 0) {
    console.warn(`\n${loadResult.warnings.length} load warning(s):`);
    for (const w of loadResult.warnings)
      console.warn(`  ${w.filePath}: ${w.message}`);
  }

  const hasErrors =
    validation.errors.length > 0 || loadResult.errors.length > 0;
  if (hasErrors) {
    console.error('\nValidation failed.');
    process.exit(1);
  } else {
    console.log('\nValidation passed.');
  }
}

/**
 * Create an LLM completion function using the Anthropic API.
 */
function createAnthropicCompletion(apiKey: string): LlmCompletionFn {
  return async (prompt: string): Promise<string> => {
    const model = process.env.MADRIGAL_MODEL || 'claude-sonnet-4-20250514';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = data.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('No text in API response');
    return textBlock.text;
  };
}

/**
 * madrigal propose [--domain <d>] [--brand <b>] [--enforcement <e>] [--batch] <input>
 */
async function runPropose() {
  const domain = parseFlag('--domain');
  const brand = parseFlag('--brand');
  const enforcement = parseFlag('--enforcement');
  const batch = hasFlag('--batch');

  // Collect input: from args first, fall back to stdin
  const flagsToSkip = new Set([
    '--domain',
    '--brand',
    '--enforcement',
    '--batch',
    'propose',
  ]);
  let input = '';

  // Try to collect non-flag args as input
  const inputParts: string[] = [];
  for (let i = 1; i < args.length; i++) {
    if (flagsToSkip.has(args[i])) {
      if (args[i] !== '--batch' && args[i] !== 'propose') i++; // skip flag value
      continue;
    }
    inputParts.push(args[i]);
  }
  input = inputParts.join(' ');

  // If no args, try stdin (only if piped, not interactive)
  if (!input.trim() && !process.stdin.isTTY) {
    input = await readStdin();
  }

  if (!input.trim()) {
    console.error(
      'No input provided. Pass text as arguments or pipe via stdin.',
    );
    console.error('  madrigal propose "Button labels should use verb+object"');
    console.error('  cat notes.md | madrigal propose --batch');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      'ANTHROPIC_API_KEY environment variable is required for propose.',
    );
    process.exit(1);
  }

  const options: ProposeOptions = {
    input,
    complete: createAnthropicCompletion(apiKey),
    domain,
    brand,
    enforcement: enforcement as ProposeOptions['enforcement'],
    batch,
    baseDir: process.cwd(),
  };

  try {
    const results = await propose(options);

    for (const result of results) {
      if (result.skipped) {
        console.log(`  Skipped: ${result.filePath} (already exists)`);
        continue;
      }
      console.log(`\nProposed: ${result.filePath}`);
      console.log(`  title:       "${result.title}"`);
      console.log(`  domain:      ${result.domain}`);
      console.log(`  enforcement: ${result.enforcement}`);
      console.log(`  tags:        ${result.tags.join(', ')}`);
      if (result.related.length > 0) {
        console.log(`\n  Related existing units:`);
        for (const r of result.related) {
          console.log(`    - ${r.id} (${r.reason})`);
        }
      }
    }

    console.log(
      `\n${results.filter((r) => !r.skipped).length} file(s) written. Edit, then commit when ready.`,
    );
  } catch (err) {
    console.error(
      `Propose failed: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

/**
 * madrigal dev [--port <number>] [--open]
 */
async function runDev() {
  const port = parseInt(parseFlag('--port') || '4567', 10);
  const open = hasFlag('--open');
  const { startDevServer } = await import('./dev/index.js');
  await startDevServer({ baseDir: process.cwd(), port, open });
}

/**
 * madrigal serve [--bundle <path>]
 */
async function runServe() {
  const bundlePath = parseFlag('--bundle');

  const { serveMcp } = await import('./serve/mcp-server.js');
  await serveMcp({
    baseDir: process.cwd(),
    bundlePath: bundlePath || undefined,
  });
}

/**
 * madrigal check [--brand <b>] [--domain <d>] [--format markdown|json|sarif] <input>
 */
async function runCheck() {
  const brand = parseFlag('--brand');
  const domain = parseFlag('--domain');
  const format = (parseFlag('--format') || 'markdown') as
    | 'markdown'
    | 'json'
    | 'sarif';
  const baseDir = process.cwd();

  // Collect input from args or stdin
  const flagsToSkip = new Set(['--brand', '--domain', '--format', 'check']);
  const inputParts: string[] = [];
  for (let i = 1; i < args.length; i++) {
    if (flagsToSkip.has(args[i])) {
      if (args[i] !== 'check') i++;
      continue;
    }
    inputParts.push(args[i]);
  }
  let input = inputParts.join(' ');

  if (!input.trim() && !process.stdin.isTTY) {
    input = await readStdin();
  }

  if (!input.trim()) {
    console.error(
      'No input provided. Pass text as arguments or pipe via stdin.',
    );
    console.error('  madrigal check "The transaction failed"');
    console.error('  echo "button text" | madrigal check --brand cashapp');
    process.exit(1);
  }

  const config = loadConfig();
  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });

  const { BM25SearchAdapter } = await import('./search/adapter.js');
  const { checkCompliance } = await import('./compliance/checker.js');
  const { formatReport } = await import('./compliance/report.js');

  const searchAdapter = new BM25SearchAdapter(loadResult.units);
  const result = await checkCompliance({
    content: input,
    brand: brand || undefined,
    domain: domain || undefined,
    searchAdapter,
    units: loadResult.units,
    config,
    baseDir,
  });

  const report = formatReport(result, {
    format,
    includeSuggestions: true,
    includeContext: false,
  });

  console.log(report);

  if (!result.passed) {
    process.exit(1);
  }
}

/**
 * madrigal eval [--golden-dir <path>]
 */
async function runEvalCmd() {
  const goldenDir = parseFlag('--golden-dir') || 'eval/golden-prompts';
  const baseDir = process.cwd();

  const config = loadConfig();
  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });

  if (loadResult.units.length === 0) {
    console.error('No knowledge units found.');
    process.exit(1);
  }

  const { BM25SearchAdapter } = await import('./search/adapter.js');
  const { runEval } = await import('./eval/harness.js');

  const searchAdapter = new BM25SearchAdapter(loadResult.units);
  const summary = await runEval(goldenDir, searchAdapter);

  if (summary.total === 0) {
    console.log(`No golden prompts found in ${goldenDir}/`);
    process.exit(0);
  }

  console.log(
    `Eval: ${summary.passed}/${summary.total} passed (${Math.round(summary.passRate * 100)}%)\n`,
  );

  for (const result of summary.results) {
    const icon = result.passed ? 'PASS' : 'FAIL';
    const label = result.prompt.description || result.prompt.query.slice(0, 60);
    console.log(`  [${icon}] ${label}`);

    if (!result.passed && result.failureReason) {
      console.log(`         ${result.failureReason}`);
    }
  }

  if (summary.failed > 0) {
    console.log(`\n${summary.failed} eval(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll evals passed.');
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
