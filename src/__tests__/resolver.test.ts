import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MadrigalConfig } from '../config.js';
import { resolveForBrand } from '../resolver.js';
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

const baseConfig: MadrigalConfig = {
  sources: ['**/*.md'],
  schema: {
    preserveUnknownFrontmatter: true,
    id: { field: 'id', strategy: 'path' },
    kind: { field: 'kind', default: 'rule', byPath: {} },
    title: { field: 'title' },
    relationships: { wikilinks: false },
  },
  vocabularies: {},
  domains: { default: { description: 'Default' } },
  kinds: { rule: { description: 'Rule' } },
  brands: {
    acme: { include: ['global'] },
    beta: {},
  },
  platforms: {},
};

describe('resolveForBrand', () => {
  it('returns all units when no brand specified', () => {
    const units = [makeUnit({ id: 'a' }), makeUnit({ id: 'b', brand: 'acme' })];

    const result = resolveForBrand({ units, config: baseConfig });
    expect(result).toHaveLength(2);
  });

  it('includes global units for any brand', () => {
    const units = [
      makeUnit({ id: 'global-rule' }),
      makeUnit({ id: 'acme-rule', brand: 'acme' }),
    ];

    const result = resolveForBrand({
      units,
      config: baseConfig,
      brand: 'acme',
    });
    expect(result.find((u) => u.id === 'global-rule')).toBeDefined();
  });

  it('brand-specific units override globals with same ID', () => {
    const units = [
      makeUnit({ id: 'shared-rule', enforcement: 'may' }),
      makeUnit({ id: 'shared-rule', brand: 'acme', enforcement: 'must' }),
    ];

    const result = resolveForBrand({
      units,
      config: baseConfig,
      brand: 'acme',
    });
    const rule = result.find((u) => u.id === 'shared-rule');
    expect(rule).toBeDefined();
    expect(rule?.enforcement).toBe('must');
  });

  it('returns only global units for unknown brand', () => {
    const units = [
      makeUnit({ id: 'global-rule' }),
      makeUnit({ id: 'acme-rule', brand: 'acme' }),
    ];

    const result = resolveForBrand({
      units,
      config: baseConfig,
      brand: 'unknown',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('global-rule');
  });
});

describe('override field validation', () => {
  let tempDir: string;
  const warnSpy = vi.spyOn(console, 'warn');

  beforeEach(() => {
    tempDir = join(tmpdir(), `madrigal-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    warnSpy.mockReset();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    warnSpy.mockReset();
  });

  it('warns on unknown fields in overrides.yaml', () => {
    const overridesDir = join(tempDir, 'knowledge', 'brands', 'acme');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, 'overrides.yaml'),
      `overrides:
  - id: some-rule
    severity: error
    unknown_field: oops
`,
    );

    const units = [makeUnit({ id: 'some-rule' })];
    resolveForBrand({
      units,
      config: baseConfig,
      brand: 'acme',
      baseDir: tempDir,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown field "unknown_field"'),
    );
  });

  it('suggests "id" when "knowledge_unit_id" is used', () => {
    const overridesDir = join(tempDir, 'knowledge', 'brands', 'acme');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, 'overrides.yaml'),
      `overrides:
  - knowledge_unit_id: some-rule
    severity: error
`,
    );

    const units = [makeUnit({ id: 'some-rule' })];
    resolveForBrand({
      units,
      config: baseConfig,
      brand: 'acme',
      baseDir: tempDir,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Did you mean "id"?'),
    );
  });

  it('does not warn for valid fields', () => {
    const overridesDir = join(tempDir, 'knowledge', 'brands', 'acme');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, 'overrides.yaml'),
      `overrides:
  - id: some-rule
    severity: warning
    reason: "Downgraded for brand"
`,
    );

    const units = [makeUnit({ id: 'some-rule' })];
    resolveForBrand({
      units,
      config: baseConfig,
      brand: 'acme',
      baseDir: tempDir,
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('applies legacy severity override from overrides.yaml', () => {
    const overridesDir = join(tempDir, 'knowledge', 'brands', 'acme');
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, 'overrides.yaml'),
      `overrides:
  - id: some-rule
    severity: error
`,
    );

    const units = [makeUnit({ id: 'some-rule', enforcement: 'may' })];
    const result = resolveForBrand({
      units,
      config: baseConfig,
      brand: 'acme',
      baseDir: tempDir,
    });
    const rule = result.find((u) => u.id === 'some-rule');
    expect(rule?.enforcement).toBe('must');
  });
});
