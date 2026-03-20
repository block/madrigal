# Madrigal

A config-driven, pluggable knowledge compiler. Madrigal transforms structured knowledge (markdown files with frontmatter) into multiple output formats — JSON bundles, AI skill files, rule sets, and more.

Inspired by [Style Dictionary](https://amzn.github.io/style-dictionary/), Madrigal applies the same "define once, compile everywhere" philosophy to design knowledge, coding guidelines, and organizational rules.

## Quick Start

```bash
npm install madrigal
```

Create a `madrigal.config.yaml`:

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
severity: error
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

The atomic unit. Each `.md` file with frontmatter becomes a `KnowledgeUnit` with an id, title, body, domain, severity, tags, and provenance tracking.

### Domains

Logical groupings of knowledge (e.g., `accessibility`, `typography`, `layout`). Defined in config and validated at load time.

### Brands

Organizational units that can inherit from each other. A brand can `include` other brands/groups, and brand-specific knowledge overrides globals with the same id.

### Severity

Five levels: `error` > `warning` > `info` > `context` > `deprecated`. Severity controls enforcement behavior and output filtering.

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
```

## Knowledge File Format

```markdown
---
title: Rule Title            # Required (or id)
id: custom-id                # Optional, generated from filename if omitted
domain: accessibility        # Optional, defaults to 'default'
severity: error              # Optional: error|warning|info|context|deprecated
brand: acme                  # Optional, omit for global rules
system: web                  # Optional
tags:                        # Optional
  - a11y
  - wcag
---

Markdown body content here.
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

Resolve knowledge units for a specific brand, applying inheritance and severity overrides.

### `validateConfig(config, formatNames?)`

Validate a configuration object.

## Project Resources

| Resource | Description |
|----------|-------------|
| [CODEOWNERS](./CODEOWNERS) | Project lead(s) |
| [GOVERNANCE.md](./GOVERNANCE.md) | Project governance |
| [LICENSE](./LICENSE) | Apache License, Version 2.0 |
