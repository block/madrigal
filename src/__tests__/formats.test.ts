import { describe, expect, it } from 'vitest';
import { aiRulesMdFormat } from '../formats/ai-rules-md.js';
import { jsonBundleFormat } from '../formats/json-bundle.js';
import type { FormatOptions } from '../formats/registry.js';
import { skillMdFormat } from '../formats/skill-md.js';
import type { KnowledgeUnit } from '../schema/index.js';

const options: FormatOptions = {
  platform: { format: 'json-bundle' },
  config: {
    sources: [],
    schema: {
      preserveUnknownFrontmatter: true,
      id: { field: 'id', strategy: 'path' },
      kind: { field: 'kind', default: 'record', byPath: {} },
      title: { field: 'title' },
      relationships: { wikilinks: true },
    },
    vocabularies: {},
    domains: {},
    kinds: {},
    brands: {},
    platforms: {},
  },
};

function makeUnit(overrides: Partial<KnowledgeUnit> = {}): KnowledgeUnit {
  return {
    id: 'record-one',
    title: 'Record One',
    body: 'Readable body.',
    kind: 'record',
    tags: ['research'],
    sourcePath: 'context/record-one.md',
    frontmatter: { title: 'Record One', custom: 'kept' },
    attributes: { custom: 'kept' },
    relationships: [
      {
        type: 'wikilink',
        target: 'Record Two',
        targetId: 'record-two',
        resolved: true,
      },
    ],
    provenance: { origin: 'human-authored', confidence: 1.0 },
    ...overrides,
  };
}

describe('built-in formats with neutral units', () => {
  it('json-bundle emits the full normalized record', async () => {
    const output = await jsonBundleFormat.compile([makeUnit()], options);
    const bundle = JSON.parse(output) as { units: KnowledgeUnit[] };

    expect(bundle.units[0]).toMatchObject({
      id: 'record-one',
      kind: 'record',
      frontmatter: { custom: 'kept' },
      attributes: { custom: 'kept' },
      relationships: [
        {
          target: 'Record Two',
          targetId: 'record-two',
          resolved: true,
        },
      ],
    });
  });

  it('rule-oriented markdown formats tolerate missing enforcement', async () => {
    const units = [makeUnit({ enforcement: undefined })];

    const skillOutput = await skillMdFormat.compile(units, options);
    const rulesOutput = await aiRulesMdFormat.compile(units, options);

    expect(skillOutput).toBeTruthy();
    expect(rulesOutput).toContain('Additional Context');
  });
});
