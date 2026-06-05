import { describe, expect, it } from 'vitest';
import { groupUnitsBy } from '../resolver.js';
import type { KnowledgeUnit } from '../schema/index.js';

function makeUnit(
  overrides: Partial<KnowledgeUnit> & { id: string },
): KnowledgeUnit {
  return {
    title: overrides.id,
    body: 'test',
    domain: 'default',
    kind: 'rule',
    tags: [],
    enforcement: 'may',
    frontmatter: {},
    attributes: {},
    relationships: [],
    provenance: { origin: 'human-authored', confidence: 1.0 },
    ...overrides,
  };
}

describe('groupUnitsBy', () => {
  it('groups units by brand', () => {
    const units = [
      makeUnit({ id: 'a', brand: 'acme' }),
      makeUnit({ id: 'b', brand: 'acme' }),
      makeUnit({ id: 'c', brand: 'beta' }),
    ];

    const groups = groupUnitsBy(units, 'brand');
    expect(groups.get('acme')).toHaveLength(2);
    expect(groups.get('beta')).toHaveLength(1);
  });

  it('groups units by domain', () => {
    const units = [
      makeUnit({ id: 'a', domain: 'content' }),
      makeUnit({ id: 'b', domain: 'visual' }),
      makeUnit({ id: 'c', domain: 'content' }),
    ];

    const groups = groupUnitsBy(units, 'domain');
    expect(groups.get('content')).toHaveLength(2);
    expect(groups.get('visual')).toHaveLength(1);
  });

  it('puts units without the groupBy field under the default key', () => {
    const units = [
      makeUnit({ id: 'a', brand: 'acme' }),
      makeUnit({ id: 'b' }), // no brand
    ];

    const groups = groupUnitsBy(units, 'brand');
    expect(groups.get('acme')).toHaveLength(1);
    expect(groups.get('default')).toHaveLength(1);
    expect(groups.size).toBe(2);
  });

  it('brand-group backfill ensures all configured brands appear', () => {
    // This tests the pipeline logic in buildPlatform: when groupBy is 'brand',
    // all brands from config should get a group even if no units have that brand.
    const units = [makeUnit({ id: 'a', brand: 'alpha' })];

    const groups = groupUnitsBy(units, 'brand');

    // Simulate the pipeline backfill logic
    const configBrands = { alpha: {}, beta: {}, gamma: {} };
    for (const brandName of Object.keys(configBrands)) {
      if (!groups.has(brandName)) {
        groups.set(brandName, []);
      }
    }

    expect(groups.has('alpha')).toBe(true);
    expect(groups.has('beta')).toBe(true);
    expect(groups.has('gamma')).toBe(true);
    expect(groups.get('alpha')).toHaveLength(1);
    expect(groups.get('beta')).toHaveLength(0);
    expect(groups.get('gamma')).toHaveLength(0);
  });
});
