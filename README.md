# Madrigal

A config-driven, pluggable knowledge compiler. Madrigal transforms structured knowledge (markdown files with frontmatter) into multiple output formats — JSON bundles, AI skill files, rule sets, and more.

Inspired by [Style Dictionary](https://amzn.github.io/style-dictionary/), Madrigal applies the same "define once, compile everywhere" philosophy to design knowledge, coding guidelines, and organizational rules.

## Quick Start

```bash
npm install madrigal
```

If you have existing knowledge files, scan them to generate a starter config:

```bash
npx madrigal init
```

Or create a `madrigal.config.yaml` manually:

```yaml
sources:
  - "knowledge/**/*.md"

domains:
  accessibility:
    description: "Accessibility guidelines"

brands:
  acme:
    include:
      - global

platforms:
  skill-file:
    format: skill-md
  json-export:
    format: json-bundle
```

Create a knowledge file at `knowledge/contrast.md`:

```markdown
---
title: Color Contrast Requirements
domain: accessibility
weight: must
tags:
  - a11y
  - wcag
---

All text must meet WCAG 2.1 AA contrast requirements:
- Normal text: minimum 4.5:1 contrast ratio
- Large text: minimum 3:1 contrast ratio
```

Build programmatically:

```typescript
import { build } from 'madrigal';

const result = await build();

for (const output of result.results) {
  console.log(`${output.platform}: ${output.unitCount} units`);
  console.log(output.output);
}
```

## Concepts

### Knowledge Units

The atomic unit. Each `.md` file with frontmatter becomes a `KnowledgeUnit` with an id, title, body, domain, weight, tags, and provenance tracking.

### Domains

Logical groupings of knowledge (e.g., `accessibility`, `typography`, `layout`). Defined in config and validated at load time.

### Brands

Organizational units that can inherit from each other. A brand can `include` other brands/groups, and brand-specific knowledge overrides globals with the same id.

Units with `brand: shared` or `brand: global` (or no brand at all) are included for every brand — use these for org-wide rules that apply everywhere.

### Weight

How strongly a unit should influence decisions. By default, five levels from highest to lowest:

| Level | Meaning |
|-------|---------|
| `must` | Required — non-compliance is a defect |
| `should` | Strong recommendation — deviate only with justification |
| `may` | Guidance — a good default, but context matters |
| `context` | Background — informational, not prescriptive |
| `deprecated` | Being phased out — avoid in new work |

You can define your own ordered levels in config (see [Field Mapping Guide](docs/field-mapping.md)).

### Formats

Output compilers that transform knowledge units into specific formats. Four built-in formats are included:

| Format | Description |
|--------|-------------|
| `json-bundle` | Searchable JSON with metadata |
| `skill-md` | Markdown skill file for AI agents |
| `ai-rules-md` | Rule file for AI coding assistants |
| `mesh-domain` | AI app-info mesh domain format |

### Platforms

Named build targets in config. Each platform specifies a format and optional grouping (`brand`, `domain`, or `system`).

## Configuration Reference

```yaml
# Glob patterns for knowledge source files
sources:
  - "knowledge/**/*.md"

# Domain definitions
domains:
  <name>:
    description: "..."

# Brand definitions
brands:
  <name>:
    systems:        # Optional: associated design systems
      - web
    include:        # Optional: inherit from other brands
      - global

# Build targets
platforms:
  <name>:
    format: json-bundle    # Required: registered format name
    groupBy: brand         # Optional: brand | domain | system
    destination: out/      # Optional: output path

# Weight levels — ordered highest to lowest importance
# Defaults to: [must, should, may, context, deprecated]
levels:
  - must
  - should
  - may
  - context
  - deprecated

# Map your existing frontmatter field names to Madrigal's normalized fields
fieldMappings:
  id: key              # Simple rename: use "key" field as the id
  domain: category     # Simple rename: use "category" as domain
  weight:              # Complex mapping: rename + translate values
    from: status
    values:
      active: must
      draft: context
      deprecated: deprecated
```

See the [Field Mapping Guide](docs/field-mapping.md) for a full reference.

## Knowledge File Format

```markdown
---
title: Rule Title            # Required (or id)
id: custom-id                # Optional, generated from filename if omitted
domain: accessibility        # Optional, defaults to 'default'
weight: must                 # Optional: must|should|may|context|deprecated
brand: acme                  # Optional, omit (or use 'shared') for global rules
system: web                  # Optional
tags:                        # Optional
  - a11y
  - wcag
---

Markdown body content here.
```

## CLI

```bash
# Scan your knowledge files and generate a starter config
madrigal init [--sources "**/*.md"] [--output madrigal.config.yaml] [--dry-run]

# Build all platforms
madrigal build [--config madrigal.config.yaml]

# Validate config without building
madrigal validate

# Start MCP server
madrigal serve [--bundle path/to/knowledge.json]
```

### `madrigal init`

Scans your existing frontmatter, detects non-standard field names and value vocabularies, and generates a `madrigal.config.yaml` with suggested `fieldMappings` and `levels`. Run it once when adopting Madrigal — you won't need to rename your files.

```
$ madrigal init

Scanning sources: **/*.md, **/*.yaml

Scanned 47 files.

Non-standard fields found (candidates for fieldMappings):
  key (47 files) → id — e.g. color-contrast, type-scale
  category (47 files) → domain — e.g. accessibility, typography
  status (42 files) → weight — e.g. active, draft, deprecated

Weight field detected: "status" with values: active, draft, deprecated
  No known vocabulary match — review the suggested levels in the config.

Domains: accessibility, typography, motion
Brands: (none found)
Kinds: (none found)

Wrote suggested config to madrigal.config.yaml
```

## Plugin System

### Custom Formats

```typescript
import { defaultRegistry, type Format } from 'madrigal';

const myFormat: Format = {
  name: 'custom-html',
  extension: '.html',
  compile(units, options) {
    return `<html>...</html>`;
  },
};

defaultRegistry.register(myFormat);
```

### Custom Preprocessors

Preprocessors transform knowledge units after loading but before compilation:

```typescript
import { defaultPreprocessorRegistry, type Preprocessor } from 'madrigal';

const enricher: Preprocessor = {
  name: 'tag-enricher',
  async process(units, config) {
    return units.map(u => ({
      ...u,
      tags: [...u.tags, 'enriched'],
    }));
  },
};

defaultPreprocessorRegistry.register(enricher);
```

### Adapter Interfaces

Madrigal exports `StorageAdapter` and `SearchAdapter` interfaces for implementing custom backends (databases, vector stores, etc.).

## API

### `build(options?)`

Run the full pipeline: load config, load knowledge, run preprocessors, compile all platforms.

### `loadConfig(path?)`

Load and parse a `madrigal.config.yaml` file.

### `loadKnowledge(options)`

Load knowledge units from markdown files matching source globs.

### `resolveForBrand(options)`

Resolve knowledge units for a specific brand, applying inheritance and weight-based overrides.

### `validateConfig(config, formatNames?)`

Validate a configuration object.

### `serveMcp(options?)`

Start a stdio MCP server that exposes five tools for querying the knowledge base:
`search_knowledge`, `get_knowledge_unit`, `list_knowledge_units`, `get_brand_rules`, `review_content`.

```typescript
import { serveMcp } from 'madrigal';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = dirname(fileURLToPath(import.meta.url));

// Single bundle
await serveMcp({ baseDir, bundlePath: 'publish/to-artifactory/knowledge.json' });

// Multiple bundles merged into one index (for aggregator repos)
await serveMcp({
  baseDir,
  bundlePath: 'publish/to-artifactory/knowledge.json',
  bundlePaths: [
    resolve(baseDir, '../other-repo/publish/to-artifactory/knowledge.json'),
  ],
  // Optional: provide an Anthropic API key to enable AI-powered review synthesis
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});
```

Save this as `mcp-server.js` at the repo root and register it in your MCP client config.

## Skills Convention

Repos that use Madrigal should own their agent skills alongside their knowledge. Skills live in `skills/{skill-name}/SKILL.md` — always a named subdirectory, never at the repo root. This mirrors the local install path (`~/.claude/skills/{name}/SKILL.md`) so publishing is mechanical.

**Single-skill repo:**
```
skills/
  my-knowledge-base/
    SKILL.md
```

**Multi-skill repo** (e.g. one skill per brand or design system):
```
skills/
  arcade/
    SKILL.md
  market/
    SKILL.md
```

Skill files reference the MCP tools (`search_knowledge`, etc.) with domain-specific routing instructions. The repo team owns the skill — it is not generated by Madrigal.

To install a skill locally for development:
```bash
mkdir -p ~/.claude/skills/{skill-name}/
ln -sf "$(pwd)/skills/{skill-name}/SKILL.md" ~/.claude/skills/{skill-name}/SKILL.md
```

## Project Resources

| Resource | Description |
|----------|-------------|
| [Field Mapping Guide](docs/field-mapping.md) | How to map your frontmatter to Madrigal's fields |
| [CODEOWNERS](./CODEOWNERS) | Project lead(s) |
| [GOVERNANCE.md](./GOVERNANCE.md) | Project governance |
| [LICENSE](./LICENSE) | Apache License, Version 2.0 |
