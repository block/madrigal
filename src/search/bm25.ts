import type { KnowledgeUnit } from '../schema/index.js';
import type { ScoredKnowledgeUnit } from '../adapters/search.js';

/**
 * Options for the BM25 index.
 */
export interface BM25Options {
  /** Term frequency saturation parameter (default: 1.2) */
  k1?: number;
  /** Document length normalization (default: 0.75) */
  b?: number;
  /** Weight multiplier for title terms (default: 2.0) */
  titleBoost?: number;
  /** Weight multiplier for tag terms (default: 1.5) */
  tagBoost?: number;
}

/**
 * Common English stop words filtered during tokenization.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
  'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'just', 'should', 'now', 'also', 'been', 'being', 'do', 'does',
  'did', 'doing', 'would', 'could', 'ought', 'am', 'were', 'if', 'or',
  'because', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again',
  'then', 'once', 'here', 'there', 'these', 'those', 'up', 'down',
]);

/**
 * Tokenize text into lowercase terms, filtering stop words and short tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/** Internal document representation for the BM25 index. */
interface IndexedDoc {
  unitId: string;
  /** Weighted term frequencies (title terms get titleBoost, tag terms get tagBoost) */
  termFreqs: Map<string, number>;
  /** Total weighted term count (used as document length) */
  length: number;
}

/**
 * BM25 full-text search index over KnowledgeUnit arrays.
 *
 * Zero dependencies. Operates entirely in memory.
 * Suitable for corpora of tens to low thousands of units.
 */
export class BM25Index {
  private readonly k1: number;
  private readonly b: number;
  private readonly titleBoost: number;
  private readonly tagBoost: number;

  private docs: IndexedDoc[] = [];
  private unitMap = new Map<string, number>(); // unitId → docs index
  private units: KnowledgeUnit[] = [];

  /** Number of documents containing each term */
  private docFreq = new Map<string, number>();
  /** Average document length across corpus */
  private avgdl = 0;

  constructor(units: KnowledgeUnit[], options?: BM25Options) {
    this.k1 = options?.k1 ?? 1.2;
    this.b = options?.b ?? 0.75;
    this.titleBoost = options?.titleBoost ?? 2.0;
    this.tagBoost = options?.tagBoost ?? 1.5;

    for (const unit of units) {
      this.addInternal(unit);
    }
    this.recomputeGlobals();
  }

  /** Number of indexed documents. */
  get size(): number {
    return this.docs.length;
  }

  /**
   * Add a unit to the index. Rebuilds global stats (IDF, avgdl).
   */
  add(unit: KnowledgeUnit): void {
    this.addInternal(unit);
    this.recomputeGlobals();
  }

  /**
   * Search the index, returning units ranked by BM25 score.
   */
  search(query: string, limit = 10): ScoredKnowledgeUnit[] {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0 || this.docs.length === 0) return [];

    const scores: Array<{ idx: number; score: number }> = [];

    for (let i = 0; i < this.docs.length; i++) {
      const s = this.scoreDoc(queryTerms, i);
      if (s > 0) {
        scores.push({ idx: i, score: s });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, limit).map(({ idx, score }) => ({
      unit: this.units[idx],
      score,
    }));
  }

  /**
   * Score a specific unit against a query. Returns 0 if unit not in index.
   */
  score(query: string, unitId: string): number {
    const idx = this.unitMap.get(unitId);
    if (idx === undefined) return 0;
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return 0;
    return this.scoreDoc(queryTerms, idx);
  }

  // --- internals ---

  private addInternal(unit: KnowledgeUnit): void {
    if (this.unitMap.has(unit.id)) return; // no duplicates

    const termFreqs = new Map<string, number>();

    // Title terms with boost
    for (const t of tokenize(unit.title)) {
      termFreqs.set(t, (termFreqs.get(t) ?? 0) + this.titleBoost);
    }

    // Body terms at 1x
    for (const t of tokenize(unit.body)) {
      termFreqs.set(t, (termFreqs.get(t) ?? 0) + 1);
    }

    // Tag terms with boost
    for (const tag of unit.tags) {
      for (const t of tokenize(tag)) {
        termFreqs.set(t, (termFreqs.get(t) ?? 0) + this.tagBoost);
      }
    }

    let length = 0;
    for (const freq of termFreqs.values()) {
      length += freq;
    }

    const idx = this.docs.length;
    this.docs.push({ unitId: unit.id, termFreqs, length });
    this.units.push(unit);
    this.unitMap.set(unit.id, idx);
  }

  private recomputeGlobals(): void {
    // Recompute document frequencies
    this.docFreq.clear();
    for (const doc of this.docs) {
      for (const term of doc.termFreqs.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }

    // Recompute average document length
    if (this.docs.length === 0) {
      this.avgdl = 0;
    } else {
      let totalLength = 0;
      for (const doc of this.docs) {
        totalLength += doc.length;
      }
      this.avgdl = totalLength / this.docs.length;
    }
  }

  private scoreDoc(queryTerms: string[], docIdx: number): number {
    const doc = this.docs[docIdx];
    const N = this.docs.length;
    let total = 0;

    for (const term of queryTerms) {
      const tf = doc.termFreqs.get(term) ?? 0;
      if (tf === 0) continue;

      const n = this.docFreq.get(term) ?? 0;

      // IDF with +1 to prevent negative values for high-frequency terms
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);

      // BM25 term score
      const numerator = tf * (this.k1 + 1);
      const denominator =
        tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgdl));

      total += idf * (numerator / denominator);
    }

    return total;
  }
}
