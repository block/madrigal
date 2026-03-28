import { describe, it, expect } from 'vitest';
import { BM25Index, tokenize } from '../search/bm25.js';
import { BM25SearchAdapter } from '../search/adapter.js';
import { findRelated } from '../propose.js';
import type { KnowledgeUnit } from '../schema/index.js';
import type { Enforcement } from '../enforcement.js';

function makeUnit(overrides: Partial<KnowledgeUnit> & { id: string; title: string }): KnowledgeUnit {
  return {
    body: '',
    domain: 'content',
    kind: 'rule',
    tags: [],
    enforcement: 'should' as Enforcement,
    attributes: {},
    provenance: { origin: 'human-authored', confidence: 1.0 },
    ...overrides,
  };
}

// --- tokenize ---

describe('tokenize', () => {
  it('lowercases and splits on non-word characters', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('filters stop words', () => {
    expect(tokenize('this is a test of the system')).toEqual(['test', 'system']);
  });

  it('filters tokens shorter than 2 characters', () => {
    expect(tokenize('I am a b c testing')).toEqual(['testing']);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

// --- BM25Index ---

describe('BM25Index', () => {
  const units = [
    makeUnit({
      id: 'buttons',
      title: 'Button copy patterns',
      body: 'Buttons should use verb-object format. Keep labels short and actionable.',
      tags: ['buttons', 'ux-copy', 'components'],
    }),
    makeUnit({
      id: 'errors',
      title: 'Error message guidelines',
      body: 'Error messages should be helpful and suggest next steps. Avoid blaming the user.',
      tags: ['errors', 'ux-copy'],
    }),
    makeUnit({
      id: 'fdic',
      title: 'FDIC banking disclosure requirements',
      body: 'All banking interfaces must display FDIC disclosure. This is a legal compliance requirement for financial products.',
      tags: ['compliance', 'legal', 'banking'],
      enforcement: 'must' as Enforcement,
    }),
    makeUnit({
      id: 'voice',
      title: 'Voice and tone principles',
      body: 'Write with clarity and warmth. Be concise. Avoid jargon and corporate speak.',
      tags: ['voice', 'tone', 'style'],
    }),
    makeUnit({
      id: 'confirmation',
      title: 'Confirmation dialog copy',
      body: 'Confirmation dialogs should clearly state the action and its consequences. Use specific button labels.',
      tags: ['confirmation', 'modals', 'components'],
    }),
  ];

  it('returns empty results for empty query', () => {
    const index = new BM25Index(units);
    expect(index.search('')).toEqual([]);
  });

  it('returns empty results for empty corpus', () => {
    const index = new BM25Index([]);
    expect(index.search('buttons')).toEqual([]);
    expect(index.size).toBe(0);
  });

  it('ranks button-copy unit first for "button labels"', () => {
    const index = new BM25Index(units);
    const results = index.search('button labels');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].unit.id).toBe('buttons');
  });

  it('ranks FDIC unit first for "FDIC disclosure"', () => {
    const index = new BM25Index(units);
    const results = index.search('FDIC disclosure');
    expect(results[0].unit.id).toBe('fdic');
  });

  it('ranks error unit first for "error messages helpful"', () => {
    const index = new BM25Index(units);
    const results = index.search('error messages helpful');
    expect(results[0].unit.id).toBe('errors');
  });

  it('gives higher scores to title matches (title boost)', () => {
    const index = new BM25Index(units);
    // "voice" appears in the title of the voice unit
    const results = index.search('voice');
    expect(results[0].unit.id).toBe('voice');
  });

  it('finds units by tag content', () => {
    const index = new BM25Index(units);
    // "banking" is a tag on the FDIC unit
    const results = index.search('banking');
    expect(results.some((r) => r.unit.id === 'fdic')).toBe(true);
  });

  it('rare terms score higher than common terms', () => {
    const index = new BM25Index(units);
    // "fdic" appears only in one unit, "copy" appears in multiple
    const fdicResults = index.search('fdic');
    const copyResults = index.search('copy');
    // FDIC should have a higher top score (more discriminative)
    expect(fdicResults[0].score).toBeGreaterThan(copyResults[0].score);
  });

  it('respects limit parameter', () => {
    const index = new BM25Index(units);
    const results = index.search('copy components', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('reports correct size', () => {
    const index = new BM25Index(units);
    expect(index.size).toBe(5);
  });

  it('score() returns 0 for unknown unit ID', () => {
    const index = new BM25Index(units);
    expect(index.score('button', 'nonexistent')).toBe(0);
  });

  it('score() returns positive for matching unit', () => {
    const index = new BM25Index(units);
    expect(index.score('button labels', 'buttons')).toBeGreaterThan(0);
  });

  it('add() increases index size', () => {
    const index = new BM25Index(units);
    expect(index.size).toBe(5);
    index.add(
      makeUnit({
        id: 'new-unit',
        title: 'New unit about colors',
        body: 'Color contrast matters.',
        tags: ['colors'],
      }),
    );
    expect(index.size).toBe(6);
  });

  it('add() makes new unit searchable', () => {
    const index = new BM25Index(units);
    index.add(
      makeUnit({
        id: 'colors',
        title: 'Color contrast requirements',
        body: 'Ensure sufficient color contrast ratios for accessibility.',
        tags: ['colors', 'accessibility', 'contrast'],
      }),
    );
    const results = index.search('color contrast accessibility');
    expect(results[0].unit.id).toBe('colors');
  });

  it('does not add duplicate unit IDs', () => {
    const index = new BM25Index(units);
    index.add(units[0]); // already in index
    expect(index.size).toBe(5);
  });

  it('works with a single document', () => {
    const index = new BM25Index([units[0]]);
    const results = index.search('button');
    expect(results.length).toBe(1);
    expect(results[0].unit.id).toBe('buttons');
  });
});

// --- BM25SearchAdapter ---

describe('BM25SearchAdapter', () => {
  const units = [
    makeUnit({
      id: 'buttons',
      title: 'Button copy',
      body: 'Use verb-object labels.',
      domain: 'content',
      kind: 'rule',
      tags: ['buttons', 'ux-copy'],
      enforcement: 'should' as Enforcement,
    }),
    makeUnit({
      id: 'fdic',
      title: 'FDIC disclosure',
      body: 'Banking UI must show FDIC notice.',
      domain: 'content',
      kind: 'rule',
      tags: ['compliance', 'legal'],
      enforcement: 'must' as Enforcement,
    }),
    makeUnit({
      id: 'tokens',
      title: 'Color token naming',
      body: 'Use semantic color names.',
      domain: 'design-system',
      kind: 'glossary',
      brand: 'square',
      tags: ['tokens', 'colors'],
      enforcement: 'may' as Enforcement,
    }),
    makeUnit({
      id: 'voice',
      title: 'Voice principles',
      body: 'Be clear and warm.',
      domain: 'content',
      tags: ['voice'],
      enforcement: 'context' as Enforcement,
    }),
  ];

  describe('exactMatch', () => {
    it('filters by domain', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ domain: 'design-system' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tokens');
    });

    it('filters by brand (null = global only)', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ brand: null });
      expect(results.every((u) => !u.brand)).toBe(true);
    });

    it('filters by brand (includes global)', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ brand: 'square' });
      expect(results.some((u) => u.id === 'tokens')).toBe(true);
      expect(results.some((u) => u.id === 'buttons')).toBe(true); // global
    });

    it('filters by enforcement', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ enforcement: ['must'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('fdic');
    });

    it('filters by kind', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ kind: 'glossary' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tokens');
    });

    it('filters by tags (all must match)', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ tags: ['compliance', 'legal'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('fdic');
    });

    it('ranks by BM25 when textQuery is provided', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ textQuery: 'banking disclosure' });
      expect(results[0].id).toBe('fdic');
    });

    it('sorts by enforcement when no textQuery', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.exactMatch({ domain: 'content' });
      // must (fdic) should come before should (buttons) before context (voice)
      expect(results[0].enforcement).toBe('must');
    });
  });

  describe('semanticSearch', () => {
    it('returns scored results in descending order', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.semanticSearch('button labels');
      expect(results.length).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('normalizes top score to 1.0', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.semanticSearch('button labels');
      expect(results[0].score).toBe(1);
    });

    it('filters by domain', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.semanticSearch('color naming', {
        domain: 'design-system',
      });
      expect(results.every((r) => r.unit.domain === 'design-system')).toBe(true);
    });

    it('filters by minEnforcement', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.semanticSearch('copy guidelines', {
        minEnforcement: 'should',
      });
      // should only include must and should, not may or context
      expect(
        results.every(
          (r) =>
            r.unit.enforcement === 'must' || r.unit.enforcement === 'should',
        ),
      ).toBe(true);
    });

    it('filters by minScore', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.semanticSearch('button labels', {
        minScore: 0.5,
      });
      expect(results.every((r) => r.score >= 0.5)).toBe(true);
    });

    it('respects limit', async () => {
      const adapter = new BM25SearchAdapter(units);
      const results = await adapter.semanticSearch('copy', { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});

// --- findRelated (propose.ts) ---

describe('findRelated', () => {
  const existingUnits: KnowledgeUnit[] = [
    makeUnit({
      id: 'buttons',
      title: 'Button copy patterns',
      body: 'Buttons should use verb-object format. Keep labels concise.',
      tags: ['buttons', 'ux-copy'],
    }),
    makeUnit({
      id: 'errors',
      title: 'Error message guidelines',
      body: 'Error messages should be helpful and actionable.',
      tags: ['errors', 'ux-copy'],
    }),
    makeUnit({
      id: 'voice',
      title: 'Voice and tone',
      body: 'Write with clarity and warmth.',
      tags: ['voice', 'tone'],
    }),
  ];

  it('finds related units by body content similarity', () => {
    const proposed = {
      filename: 'cta-labels.md',
      title: 'CTA button label guidelines',
      domain: 'content',
      enforcement: 'should',
      tags: ['labels'],
      body: 'Call-to-action buttons should use clear verb-object labels that tell users what will happen.',
    };
    const related = findRelated(proposed, existingUnits);
    expect(related.length).toBeGreaterThan(0);
    // The buttons unit should be the most related
    expect(related[0].id).toBe('buttons');
  });

  it('returns empty array for no existing units', () => {
    const proposed = {
      filename: 'test.md',
      title: 'Test',
      domain: 'content',
      enforcement: 'should',
      tags: [],
      body: 'test content',
    };
    expect(findRelated(proposed, [])).toEqual([]);
  });

  it('limits to 5 results', () => {
    const manyUnits = Array.from({ length: 20 }, (_, i) =>
      makeUnit({
        id: `unit-${i}`,
        title: `Unit about writing guidelines ${i}`,
        body: 'Writing is important for clarity and user experience.',
        tags: ['writing'],
      }),
    );
    const proposed = {
      filename: 'writing.md',
      title: 'Writing guidelines for clarity',
      domain: 'content',
      enforcement: 'should',
      tags: ['writing'],
      body: 'Good writing improves user experience and clarity.',
    };
    const related = findRelated(proposed, manyUnits);
    expect(related.length).toBeLessThanOrEqual(5);
  });
});
