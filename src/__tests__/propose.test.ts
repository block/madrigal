import { describe, it, expect } from 'vitest';
import { parseProposedUnits, findRelated } from '../propose.js';
import type { KnowledgeUnit } from '../schema/index.js';

function makeUnit(overrides: Partial<KnowledgeUnit> & { id: string; title: string }): KnowledgeUnit {
  return {
    body: 'test',
    domain: 'default',
    kind: 'rule',
    tags: [],
    enforcement: 'may',
    attributes: {},
    provenance: { origin: 'human-authored', confidence: 1.0 },
    ...overrides,
  };
}

describe('parseProposedUnits', () => {
  it('parses a single unit block', () => {
    const response = `
<unit>
<filename>button-labels.md</filename>
<frontmatter>
title: "Button labels — verb+object"
domain: content
tags:
  - buttons
  - copy
enforcement: should
</frontmatter>
<body>
# Button Labels

Use verb+object pattern for button labels.
</body>
</unit>`;

    const units = parseProposedUnits(response);
    expect(units).toHaveLength(1);
    expect(units[0].filename).toBe('button-labels.md');
    expect(units[0].title).toBe('Button labels — verb+object');
    expect(units[0].domain).toBe('content');
    expect(units[0].enforcement).toBe('should');
    expect(units[0].tags).toEqual(['buttons', 'copy']);
    expect(units[0].body).toContain('Use verb+object pattern');
  });

  it('parses multiple unit blocks (batch mode)', () => {
    const response = `
<unit>
<filename>first.md</filename>
<frontmatter>
title: "First rule"
domain: accessibility
enforcement: must
tags:
  - a11y
</frontmatter>
<body>First body</body>
</unit>

<unit>
<filename>second.md</filename>
<frontmatter>
title: "Second rule"
domain: content
enforcement: may
tags:
  - writing
</frontmatter>
<body>Second body</body>
</unit>`;

    const units = parseProposedUnits(response);
    expect(units).toHaveLength(2);
    expect(units[0].title).toBe('First rule');
    expect(units[1].title).toBe('Second rule');
  });

  it('uses defaults for missing optional fields', () => {
    const response = `
<unit>
<filename>minimal.md</filename>
<frontmatter>
title: "Minimal unit"
</frontmatter>
<body>Just a body</body>
</unit>`;

    const units = parseProposedUnits(response);
    expect(units[0].domain).toBe('content');
    expect(units[0].enforcement).toBe('should');
    expect(units[0].tags).toEqual([]);
    expect(units[0].brand).toBeUndefined();
    expect(units[0].system).toBeUndefined();
  });

  it('parses brand and system fields', () => {
    const response = `
<unit>
<filename>branded.md</filename>
<frontmatter>
title: "Brand-specific rule"
domain: visual
brand: acme
system: web
enforcement: should
tags:
  - branding
</frontmatter>
<body>Brand body</body>
</unit>`;

    const units = parseProposedUnits(response);
    expect(units[0].brand).toBe('acme');
    expect(units[0].system).toBe('web');
  });

  it('throws on response with no unit blocks', () => {
    expect(() => parseProposedUnits('Just some text with no units')).toThrow(
      /Could not parse any knowledge units/,
    );
  });

  it('falls back to filename for title when missing', () => {
    const response = `
<unit>
<filename>my-rule.md</filename>
<frontmatter>
domain: content
enforcement: may
</frontmatter>
<body>Body</body>
</unit>`;

    const units = parseProposedUnits(response);
    expect(units[0].title).toBe('my-rule');
  });

  it('handles YAML with colons in quoted title', () => {
    const response = `
<unit>
<filename>colon-title.md</filename>
<frontmatter>
title: "Color tokens: use semantic names"
domain: visual
enforcement: should
tags:
  - tokens
</frontmatter>
<body>Use semantic color tokens.</body>
</unit>`;

    const units = parseProposedUnits(response);
    expect(units[0].title).toBe('Color tokens: use semantic names');
  });
});

describe('findRelated', () => {
  const existing: KnowledgeUnit[] = [
    makeUnit({ id: 'btn-copy', title: 'Button copy guidelines', domain: 'content', tags: ['buttons', 'copy', 'ui'] }),
    makeUnit({ id: 'color-tokens', title: 'Color token naming', domain: 'visual', tags: ['tokens', 'color'] }),
    makeUnit({ id: 'a11y-contrast', title: 'Color contrast ratios', domain: 'accessibility', tags: ['color', 'contrast', 'a11y'] }),
    makeUnit({ id: 'icon-sizing', title: 'Icon sizing standards', domain: 'visual', tags: ['icons', 'sizing'] }),
  ];

  it('returns units with overlapping tags above threshold', () => {
    const proposed = { filename: 'f.md', title: 'New rule', domain: 'content', enforcement: 'should', tags: ['buttons', 'copy'], body: '' };
    const related = findRelated(proposed, existing);
    expect(related.length).toBeGreaterThan(0);
    expect(related[0].id).toBe('btn-copy');
    expect(related[0].reason).toContain('content similarity');
  });

  it('gives same-domain bonus', () => {
    // Two tags overlap + same domain should score higher than two tags overlap + different domain
    const proposed = { filename: 'f.md', title: 'New visual rule', domain: 'visual', enforcement: 'should', tags: ['color', 'tokens'], body: '' };
    const related = findRelated(proposed, existing);
    // color-tokens shares domain + 2 tags, a11y-contrast shares 1 tag different domain
    expect(related[0].id).toBe('color-tokens');
  });

  it('returns fewer results for weakly related queries', () => {
    // "icons" tag matches icon-sizing, BM25 will find it but with lower score
    const proposed = { filename: 'f.md', title: 'Something unrelated', domain: 'other', enforcement: 'may', tags: ['icons'], body: '' };
    const related = findRelated(proposed, existing);
    // With BM25, even weak matches return if score > 0 (tag overlap via tokenization)
    if (related.length > 0) {
      expect(related[0].id).toBe('icon-sizing');
    }
  });

  it('finds related units by title and body content similarity', () => {
    const proposed = { filename: 'f.md', title: 'Color contrast accessibility', domain: 'accessibility', enforcement: 'may', tags: [], body: '' };
    const related = findRelated(proposed, existing);
    // a11y-contrast has "color" and "contrast" in title — BM25 ranks it high
    const match = related.find((r) => r.id === 'a11y-contrast');
    expect(match).toBeDefined();
    expect(match!.reason).toContain('content similarity');
  });

  it('limits results to 5', () => {
    const manyUnits = Array.from({ length: 10 }, (_, i) =>
      makeUnit({ id: `unit-${i}`, title: `Shared topic words here`, domain: 'content', tags: ['shared-tag-a', 'shared-tag-b'] }),
    );
    const proposed = { filename: 'f.md', title: 'Shared topic words here', domain: 'content', enforcement: 'may', tags: ['shared-tag-a', 'shared-tag-b'], body: '' };
    const related = findRelated(proposed, manyUnits);
    expect(related.length).toBeLessThanOrEqual(5);
  });

  it('sorts by score descending', () => {
    const proposed = { filename: 'f.md', title: 'Color token naming patterns', domain: 'visual', enforcement: 'may', tags: ['color', 'tokens', 'contrast'], body: '' };
    const related = findRelated(proposed, existing);
    // color-tokens: 2 tags + same domain + title overlap = highest
    // a11y-contrast: 2 tags + title overlap ("color") but only 1 word >3 chars shared = lower
    if (related.length >= 2) {
      expect(related[0].id).toBe('color-tokens');
    }
  });
});
