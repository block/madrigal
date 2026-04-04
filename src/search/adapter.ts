import type {
  RuleFilter,
  ScoredKnowledgeUnit,
  SearchAdapter,
  SemanticSearchOptions,
} from '../adapters/search.js';
import { ENFORCEMENT_ORDER } from '../enforcement.js';
import type { KnowledgeUnit } from '../schema/index.js';
import { BM25Index } from './bm25.js';

/**
 * SearchAdapter implementation backed by an in-memory BM25 index.
 *
 * Provides both deterministic exact-match filtering and BM25-ranked
 * semantic search over KnowledgeUnit arrays. Zero external dependencies.
 */
export class BM25SearchAdapter implements SearchAdapter {
  private readonly units: KnowledgeUnit[];
  private readonly index: BM25Index;

  constructor(units: KnowledgeUnit[]) {
    this.units = units;
    this.index = new BM25Index(units);
  }

  /**
   * Exact-match filtering by metadata fields.
   * If textQuery is provided, results are ranked by BM25 score.
   * Otherwise, results are sorted by enforcement (must first).
   */
  async exactMatch(filter: RuleFilter): Promise<KnowledgeUnit[]> {
    let results = this.applyFilters(this.units, filter);

    if (filter.textQuery) {
      // Build a temporary index over the filtered set for ranking
      const filtered = new BM25Index(results);
      const scored = filtered.search(filter.textQuery, results.length);
      results = scored.map((s) => s.unit);
    } else {
      // Sort by enforcement: must first
      results.sort(
        (a, b) =>
          (ENFORCEMENT_ORDER[a.enforcement] ?? 99) -
          (ENFORCEMENT_ORDER[b.enforcement] ?? 99),
      );
    }

    return results;
  }

  /**
   * BM25-ranked search with optional metadata post-filtering.
   *
   * Scores are normalized to 0-1 (top result = 1.0).
   * Enforceable rules (must, should) receive a small score boost.
   */
  async semanticSearch(
    query: string,
    options?: SemanticSearchOptions,
  ): Promise<ScoredKnowledgeUnit[]> {
    // Get raw BM25 results (generous limit, we'll filter and trim)
    const rawLimit = Math.max((options?.limit ?? 10) * 3, 50);
    const raw = this.index.search(query, rawLimit);

    if (raw.length === 0) return [];

    // Post-filter by metadata
    let results = raw;

    if (options?.domain) {
      results = results.filter((r) => r.unit.domain === options.domain);
    }

    if (options?.brand) {
      results = results.filter(
        (r) => !r.unit.brand || r.unit.brand === options.brand,
      );
    }

    if (options?.minEnforcement) {
      const minOrder = ENFORCEMENT_ORDER[options.minEnforcement] ?? 99;
      results = results.filter(
        (r) => (ENFORCEMENT_ORDER[r.unit.enforcement] ?? 99) <= minOrder,
      );
    }

    // Apply enforcement boost: enforceable rules score slightly higher
    results = results.map((r) => {
      let boosted = r.score;
      if (r.unit.enforcement === 'must') boosted *= 1.2;
      else if (r.unit.enforcement === 'should') boosted *= 1.1;
      return { unit: r.unit, score: boosted };
    });

    // Re-sort after boost
    results.sort((a, b) => b.score - a.score);

    // Normalize scores to 0-1
    const maxScore = results[0]?.score ?? 1;
    if (maxScore > 0) {
      results = results.map((r) => ({
        unit: r.unit,
        score: Math.round((r.score / maxScore) * 1000) / 1000,
      }));
    }

    // Apply minScore filter
    if (options?.minScore !== undefined) {
      const minScore = options.minScore;
      results = results.filter((r) => r.score >= minScore);
    }

    // Apply limit
    const limit = options?.limit ?? 10;
    return results.slice(0, limit);
  }

  /** Apply deterministic metadata filters. */
  private applyFilters(
    units: KnowledgeUnit[],
    filter: RuleFilter,
  ): KnowledgeUnit[] {
    let results = [...units];

    if (filter.domain) {
      results = results.filter((u) => u.domain === filter.domain);
    }

    if (filter.brand !== undefined) {
      if (filter.brand === null) {
        // null means global-only
        results = results.filter((u) => !u.brand);
      } else {
        results = results.filter((u) => !u.brand || u.brand === filter.brand);
      }
    }

    if (filter.enforcement && filter.enforcement.length > 0) {
      const allowed = new Set<string>(filter.enforcement);
      results = results.filter((u) => allowed.has(u.enforcement));
    }

    if (filter.kind) {
      results = results.filter((u) => u.kind === filter.kind);
    }

    if (filter.tags && filter.tags.length > 0) {
      // All specified tags must be present on the unit
      results = results.filter((u) =>
        filter.tags?.every((t) => u.tags.includes(t)),
      );
    }

    return results;
  }
}
