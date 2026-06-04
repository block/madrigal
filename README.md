# Madrigal

A config-driven, pluggable knowledge compiler. Madrigal transforms structured knowledge (markdown files with frontmatter) into multiple output formats — JSON bundles, AI skill files, rule sets, and more.

Inspired by [Style Dictionary](https://amzn.github.io/style-dictionary/), Madrigal applies the same "define once, compile everywhere" philosophy to design knowledge, coding guidelines, and organizational rules.

## Quick Start

```bash
npm install @anarchitecture/madrigal
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
import { build } from '@anarchitecture/madrigal';

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
import { defaultRegistry, type Format } from '@anarchitecture/madrigal';

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
import { defaultPreprocessorRegistry, type Preprocessor } from '@anarchitecture/madrigal';

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

### `serveMcp(options?)`

Start a stdio MCP server that exposes five tools for querying the knowledge base:
`search_knowledge`, `get_knowledge_unit`, `list_knowledge_units`, `get_brand_rules`, `review_content`.

```typescript
import { serveMcp } from '@anarchitecture/madrigal';
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

## Release Workflow

Madrigal uses [Changesets](https://github.com/changesets/changesets) for
versioning and npm publishing.

For a release-bearing change, run:

```bash
pnpm changeset
```

After the change lands on `main`, the `Release` GitHub Actions workflow creates
a version PR when changesets are pending. When that version PR lands, the same
workflow builds Madrigal and publishes it to npm with provenance. The workflow
expects the npm automation token in `MADRIGAL_NPM_PUBLISH_TOKEN`.

Manual release commands are also available:

```bash
pnpm version-packages
pnpm release
```

## Project Resources

| Resource | Description |
|----------|-------------|
| [CODEOWNERS](./CODEOWNERS) | Project lead(s) |
| [GOVERNANCE.md](./GOVERNANCE.md) | Project governance |
| [LICENSE](./LICENSE) | Apache License, Version 2.0 |
