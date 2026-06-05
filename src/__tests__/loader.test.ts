import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MadrigalConfig } from '../config.js';
import { loadKnowledgeSync } from '../loader.js';
import { build } from '../pipeline.js';

function makeConfig(
  overrides: {
    sources?: string[];
    schema?: Partial<MadrigalConfig['schema']>;
    kinds?: MadrigalConfig['kinds'];
    vocabularies?: MadrigalConfig['vocabularies'];
    platforms?: MadrigalConfig['platforms'];
  } = {},
): MadrigalConfig {
  const schema: MadrigalConfig['schema'] = {
    preserveUnknownFrontmatter: true,
    id: { field: 'id', strategy: 'path' },
    kind: { field: 'type', default: 'record', byPath: {} },
    title: { field: 'title' },
    relationships: { wikilinks: true },
  };

  return {
    sources: overrides.sources || ['context/**/*.md'],
    schema: {
      ...schema,
      ...overrides.schema,
      id: { ...schema.id, ...overrides.schema?.id },
      kind: { ...schema.kind, ...overrides.schema?.kind },
      title: { ...schema.title, ...overrides.schema?.title },
      relationships: {
        ...schema.relationships,
        ...overrides.schema?.relationships,
      },
    },
    vocabularies: overrides.vocabularies || {},
    domains: {},
    kinds: overrides.kinds || {
      record: {},
      study: {
        required: ['title', 'methodology', 'research_period', 'source_url'],
      },
      theme: {},
      competitor: {
        required: ['title', 'competitor_id', 'threat_level'],
      },
    },
    brands: {},
    platforms: overrides.platforms || {},
  };
}

describe('loadKnowledge schema compiler behavior', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'madrigal-loader-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function write(relativePath: string, content: string): void {
    const filePath = join(tempDir, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }

  it('preserves frontmatter, normalizes attributes, maps kinds, and resolves wikilinks', () => {
    write(
      'context/themes/trust.md',
      `---
title: Trust
type: theme
aliases:
  - Confidence
---
Signals that help people feel safe continuing.
`,
    );
    write(
      'context/studies/checkout-trust.md',
      `---
title: Checkout Trust Study
type: study
brand: Old Co
methodology: Interviews
research_period: Q1
source_url: https://example.com/research
durability: Evergreen
---
Participants connected onboarding clarity to [[Trust]] and [[Trust|trusted flows]].
`,
    );

    const result = loadKnowledgeSync({
      sources: ['context/**/*.md'],
      config: makeConfig({
        vocabularies: {
          brand: { values: ['Acme'], aliases: { 'Old Co': 'Acme' } },
          durability: { values: ['Evergreen', 'Timebound'] },
        },
      }),
      baseDir: tempDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);

    const study = result.units.find((unit) => unit.kind === 'study');
    const theme = result.units.find((unit) => unit.kind === 'theme');

    expect(study?.id).toBe('context-studies-checkout-trust');
    expect(study?.frontmatter.brand).toBe('Old Co');
    expect(study?.frontmatter.durability).toBe('Evergreen');
    expect(study?.attributes.brand).toBe('Acme');
    expect(study?.attributes.methodology).toBe('Interviews');
    expect(study?.relationships).toEqual([
      {
        type: 'wikilink',
        target: 'Trust',
        resolved: true,
        targetId: theme?.id,
      },
      {
        type: 'wikilink',
        target: 'Trust',
        label: 'trusted flows',
        resolved: true,
        targetId: theme?.id,
      },
    ]);
  });

  it('uses path-based kind fallback when the configured field is absent', () => {
    write(
      'context/studies/path-mapped.md',
      `---
title: Path Mapped Study
methodology: Survey
research_period: Q2
source_url: https://example.com/survey
---
Body.
`,
    );

    const result = loadKnowledgeSync({
      sources: ['context/**/*.md'],
      config: makeConfig({
        schema: {
          kind: {
            field: 'type',
            default: 'record',
            byPath: { 'context/studies/**': 'study' },
          },
        },
      }),
      baseDir: tempDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.units[0].kind).toBe('study');
  });

  it('generates path-safe IDs for index files and duplicate filenames', () => {
    write(
      'context/studies/_index.md',
      `---
title: Study Overview
type: record
---
Overview.
`,
    );
    write(
      'context/studies/shared.md',
      `---
title: Shared Name
type: record
---
Study body.
`,
    );
    write(
      'context/themes/shared.md',
      `---
title: Shared Name
type: record
---
Theme body.
`,
    );

    const result = loadKnowledgeSync({
      sources: ['context/**/*.md'],
      config: makeConfig(),
      baseDir: tempDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.units.map((unit) => unit.id).sort()).toEqual([
      'context-studies',
      'context-studies-shared',
      'context-themes-shared',
    ]);
  });

  it('reports missing kind-required fields as strict lint errors', () => {
    write(
      'context/studies/missing-required.md',
      `---
title: Missing Source Study
type: study
methodology: Interviews
research_period: Q3
---
Body.
`,
    );

    const result = loadKnowledgeSync({
      sources: ['context/**/*.md'],
      config: makeConfig(),
      baseDir: tempDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'missing-required-field',
        severity: 'error',
        field: 'source_url',
        unitId: 'context-studies-missing-required',
      }),
    );
  });

  it('reports invalid vocabulary values without mutating raw frontmatter', () => {
    write(
      'context/records/vendor.md',
      `---
title: Vendor Record
type: record
brand: Unknown Brand
---
Body.
`,
    );

    const result = loadKnowledgeSync({
      sources: ['context/**/*.md'],
      config: makeConfig({
        vocabularies: {
          brand: { values: ['Acme'] },
        },
      }),
      baseDir: tempDir,
    });

    expect(result.units[0].frontmatter.brand).toBe('Unknown Brand');
    expect(result.units[0].attributes.brand).toBe('Unknown Brand');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'invalid-vocabulary',
        severity: 'error',
        field: 'brand',
      }),
    );
  });

  it('excludes conflicting duplicate IDs and reports all source paths', () => {
    write(
      'context/a.md',
      `---
id: shared
title: First
type: record
---
First.
`,
    );
    write(
      'context/b.md',
      `---
id: shared
title: Second
type: record
---
Second.
`,
    );

    const result = loadKnowledgeSync({
      sources: ['context/**/*.md'],
      config: makeConfig(),
      baseDir: tempDir,
    });

    expect(result.units).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'duplicate-id',
        filePath: 'shared',
        message: expect.stringContaining('context/a.md, context/b.md'),
      }),
    );
  });

  it('build continues with valid records while excluding duplicate conflicts', async () => {
    write(
      'madrigal.config.yaml',
      `sources:
  - "context/**/*.md"
schema:
  id:
    field: id
    strategy: path
  kind:
    field: type
    default: record
  title:
    field: title
  relationships:
    wikilinks: true
kinds:
  record: {}
platforms:
  bundle:
    format: json-bundle
`,
    );
    write(
      'context/valid.md',
      `---
title: Valid Record
type: record
---
Valid.
`,
    );
    write(
      'context/duplicate-a.md',
      `---
id: duplicate
title: Duplicate A
type: record
---
A.
`,
    );
    write(
      'context/duplicate-b.md',
      `---
id: duplicate
title: Duplicate B
type: record
---
B.
`,
    );

    const result = await build({
      configPath: join(tempDir, 'madrigal.config.yaml'),
      baseDir: tempDir,
    });

    expect(result.success).toBe(true);
    expect(result.totalUnits).toBe(1);
    expect(result.loadErrors).toContainEqual(
      expect.objectContaining({ code: 'duplicate-id' }),
    );

    const bundle = JSON.parse(result.results[0].output) as {
      units: Array<{ id: string }>;
    };
    expect(bundle.units.map((unit) => unit.id)).toEqual(['context-valid']);
  });
});
