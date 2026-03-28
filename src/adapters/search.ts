import type { KnowledgeUnit, Domain } from '../schema/knowledge-unit.js';
import type { Enforcement } from '../enforcement.js';

/**
 * Filter for exact rule matching (deterministic search).
 */
export interface RuleFilter {
  /** Filter by domain */
  domain?: Domain;

  /** Filter by brand (use null for global rules only) */
  brand?: string | null;

  /** Filter by enforcement levels */
  enforcement?: Enforcement[];

  /** Filter by tags (all must match) */
  tags?: string[];

  /** Full-text search on title and body */
  textQuery?: string;
}

/**
 * Options for semantic (vector) search.
 */
export interface SemanticSearchOptions {
  /** Filter by domain before searching */
  domain?: Domain;

  /** Filter by brand before searching */
  brand?: string;

  /** Filter by minimum enforcement level */
  minEnforcement?: Enforcement;

  /** Maximum number of results to return */
  limit?: number;

  /** Minimum similarity score (0-1) */
  minScore?: number;
}

/**
 * A knowledge unit with its similarity score from semantic search.
 */
export interface ScoredKnowledgeUnit {
  /** The matching knowledge unit */
  unit: KnowledgeUnit;

  /** Similarity score from 0-1 (1 = exact match) */
  score: number;
}

/**
 * SearchAdapter defines the interface for searching knowledge units.
 * Supports both deterministic (exact) matching and semantic (vector) search.
 */
export interface SearchAdapter {
  /**
   * Exact match search using filters.
   * Returns all knowledge units matching the specified criteria.
   */
  exactMatch(filter: RuleFilter): Promise<KnowledgeUnit[]>;

  /**
   * Semantic search using vector similarity.
   * Returns knowledge units ranked by relevance to the query.
   */
  semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<ScoredKnowledgeUnit[]>;
}
