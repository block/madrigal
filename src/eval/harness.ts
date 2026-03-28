import { readFileSync } from 'node:fs';
import fg from 'fast-glob';
import matter from 'gray-matter';
import type { SearchAdapter } from '../adapters/search.js';

/**
 * A golden prompt defines a search query with expected results.
 * Stored as markdown files with YAML frontmatter.
 */
export interface GoldenPrompt {
  /** The query/content to search for */
  query: string;
  /** Expected unit IDs that should appear in results */
  expectedIds: string[];
  /** Optional: minimum score threshold for expected units */
  minScore?: number;
  /** Optional: expected units must appear within this rank position */
  maxRank?: number;
  /** Description of what this prompt tests */
  description?: string;
  /** Source file path */
  sourcePath?: string;
}

/**
 * Result of evaluating a single golden prompt.
 */
export interface EvalResult {
  prompt: GoldenPrompt;
  passed: boolean;
  /** IDs that were found in the results */
  foundIds: string[];
  /** IDs that were expected but not found */
  missedIds: string[];
  /** Scores for each found expected ID */
  scores: Record<string, number>;
  /** Rank positions for each found expected ID */
  ranks: Record<string, number>;
  /** Reason for failure, if any */
  failureReason?: string;
}

/**
 * Summary of a full eval run.
 */
export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: EvalResult[];
}

/**
 * Load golden prompts from a directory of markdown files.
 *
 * Expected frontmatter format:
 * ```yaml
 * ---
 * query: "error message for failed payment"
 * expectedIds:
 *   - error-messages-be-helpful
 *   - fdic-banking-disclosure
 * minScore: 0.1
 * maxRank: 3
 * ---
 * Optional description body.
 * ```
 */
export async function loadGoldenPrompts(
  goldenDir: string,
): Promise<GoldenPrompt[]> {
  const files = await fg('**/*.md', {
    cwd: goldenDir,
    absolute: true,
    onlyFiles: true,
  });

  const prompts: GoldenPrompt[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    if (!data.query || !Array.isArray(data.expectedIds)) {
      console.warn(
        `Skipping ${filePath}: missing required frontmatter (query, expectedIds)`,
      );
      continue;
    }

    prompts.push({
      query: String(data.query),
      expectedIds: data.expectedIds.map(String),
      minScore: typeof data.minScore === 'number' ? data.minScore : undefined,
      maxRank: typeof data.maxRank === 'number' ? data.maxRank : undefined,
      description: body.trim() || undefined,
      sourcePath: filePath,
    });
  }

  return prompts;
}

/**
 * Evaluate a single golden prompt against the search adapter.
 */
export async function evaluatePrompt(
  prompt: GoldenPrompt,
  searchAdapter: SearchAdapter,
): Promise<EvalResult> {
  const results = await searchAdapter.semanticSearch(prompt.query, {
    limit: Math.max(prompt.maxRank ?? 10, 10),
  });

  const resultIds = results.map((r) => r.unit.id);
  const resultScores = new Map(results.map((r) => [r.unit.id, r.score]));
  const resultRanks = new Map(results.map((r, i) => [r.unit.id, i + 1]));

  const foundIds: string[] = [];
  const missedIds: string[] = [];
  const scores: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const failures: string[] = [];

  for (const expectedId of prompt.expectedIds) {
    if (resultIds.includes(expectedId)) {
      foundIds.push(expectedId);
      scores[expectedId] = resultScores.get(expectedId) ?? 0;
      ranks[expectedId] = resultRanks.get(expectedId) ?? 999;

      // Check score threshold
      if (
        prompt.minScore !== undefined &&
        scores[expectedId] < prompt.minScore
      ) {
        failures.push(
          `${expectedId}: score ${scores[expectedId].toFixed(3)} < minScore ${prompt.minScore}`,
        );
      }

      // Check rank threshold
      if (
        prompt.maxRank !== undefined &&
        ranks[expectedId] > prompt.maxRank
      ) {
        failures.push(
          `${expectedId}: rank ${ranks[expectedId]} > maxRank ${prompt.maxRank}`,
        );
      }
    } else {
      missedIds.push(expectedId);
      failures.push(`${expectedId}: not found in results`);
    }
  }

  return {
    prompt,
    passed: failures.length === 0,
    foundIds,
    missedIds,
    scores,
    ranks,
    failureReason: failures.length > 0 ? failures.join('; ') : undefined,
  };
}

/**
 * Run the full eval suite: load golden prompts and evaluate all of them.
 */
export async function runEval(
  goldenDir: string,
  searchAdapter: SearchAdapter,
): Promise<EvalSummary> {
  const prompts = await loadGoldenPrompts(goldenDir);

  if (prompts.length === 0) {
    return { total: 0, passed: 0, failed: 0, passRate: 0, results: [] };
  }

  const results: EvalResult[] = [];

  for (const prompt of prompts) {
    const result = await evaluatePrompt(prompt, searchAdapter);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    total: results.length,
    passed,
    failed,
    passRate: Math.round((passed / results.length) * 100) / 100,
    results,
  };
}
