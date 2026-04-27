# Field Mapping Guide

Madrigal works with your existing frontmatter — you don't need to rename your files to adopt it. This guide explains how to use `fieldMappings` and `levels` in your config to bridge your team's vocabulary to Madrigal's normalized fields.

## Madrigal's Core Fields

Every knowledge unit is normalized to these fields at load time:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes* | Unique identifier. Auto-generated from filename if absent. |
| `title` | string | Yes* | Human-readable name for the unit. |
| `domain` | string | No | Logical grouping (e.g. `accessibility`, `typography`). |
| `kind` | string | No | Unit type (e.g. `rule`, `guideline`, `pattern`). |
| `brand` | string | No | Scope — omit or set to `shared`/`global` for org-wide units. |
| `weight` | string | No | Importance level. Defaults to the middle level if absent. |
| `tags` | string[] | No | Free-form labels for filtering and search. |
| `system` | string | No | Design system or platform scope. |

*At least one of `id` or `title` must be present.

### The `weight` field

`weight` captures how strongly a unit should influence decisions. Unlike a binary required/optional flag, it's a spectrum — useful for filtering search results, surfacing the most critical rules first, and communicating intent to AI agents.

**Default levels (highest → lowest):**

| Level | Meaning |
|-------|---------|
| `must` | Required — non-compliance is a defect |
| `should` | Strong recommendation — deviate only with justification |
| `may` | Guidance — a good default, but context matters |
| `context` | Background — informational, not prescriptive |
| `deprecated` | Being phased out — avoid in new work |

If `weight` is absent from a unit, Madrigal defaults to `may` (the middle level).

### When `weight` isn't right for your team

If your team doesn't use weight-like concepts at all (e.g. a pure reference library with no prioritization), you can omit `weight` from all your files. Madrigal will assign the default level and the field stays out of the way.

---

## Using `fieldMappings`

`fieldMappings` lets you tell Madrigal which of your frontmatter fields correspond to its normalized fields — without touching your source files.

### Simple rename

Map a source field directly to a Madrigal field:

```yaml
fieldMappings:
  id: key          # Use your "key" field as the id
  domain: category # Use your "category" field as domain
  kind: type       # Use your "type" field as kind
```

Rules:
- If the Madrigal target field is already set in the frontmatter, the mapping is skipped (your explicit value wins).
- If the source field doesn't exist on a unit, the mapping is silently skipped.

### Complex mapping (rename + value translation)

When your weight-equivalent field uses different value names, use the long form:

```yaml
fieldMappings:
  weight:
    from: status
    values:
      active: must
      draft: context
      deprecated: deprecated
```

- `from`: the source field name
- `values`: a lookup table translating source values to Madrigal values
- If a value isn't in the `values` map, it passes through unchanged (so you can add custom levels alongside standard ones)

You can also use the long form for a rename-only mapping (no value translation):

```yaml
fieldMappings:
  weight:
    from: maturity
```

### Multiple mappings

All mappings apply together. You can map several fields at once:

```yaml
fieldMappings:
  id: key
  domain: category
  weight:
    from: status
    values:
      active: must
      draft: should
      review: may
      archived: deprecated
```

---

## Using `levels`

If your team has a different weight vocabulary, define it in `levels`:

```yaml
levels:
  - required     # highest weight
  - recommended
  - optional
  - deprecated   # lowest weight
```

List them **highest to lowest** — Madrigal uses the order to determine which units take priority in conflict resolution and search ranking.

Once you define custom levels, use those exact strings in your frontmatter (or map from your existing values using `fieldMappings`).

### Accessing levels in code

```typescript
import { parseWeight, isHighWeight, compareWeight, buildWeightOrder } from 'madrigal';

const myLevels = ['required', 'recommended', 'optional', 'deprecated'];

parseWeight('required', myLevels)      // → 'required'
parseWeight('unknown', myLevels)       // → null
isHighWeight('required', myLevels)     // → true
isHighWeight('optional', myLevels)     // → false

const order = buildWeightOrder(myLevels);
compareWeight('required', 'optional', order) // → negative (required is higher)
```

---

## Team Examples

### Design system (maturity model)

Your files use `maturity: stable | beta | experimental | deprecated`.

```yaml
levels:
  - stable
  - beta
  - experimental
  - deprecated

fieldMappings:
  weight:
    from: maturity
```

No value translation needed — the field values match the levels directly.

### Compliance kit

Your files use `key` for ID, `category` for domain, and `status: active | draft | deprecated`.

```yaml
fieldMappings:
  id: key
  domain: category
  weight:
    from: status
    values:
      active: must
      draft: context
      deprecated: deprecated
```

### Content design rules

Your files use `priority: critical | high | medium | low`.

```yaml
levels:
  - critical
  - high
  - medium
  - low

fieldMappings:
  weight:
    from: priority
```

### Mixed vocabulary (some files already use weight)

If some files already have a `weight` field, Madrigal uses it as-is. The mapping only applies when `weight` is absent — so a gradual migration works without a big-bang rename.

---

## Running `madrigal init`

The init wizard scans your files and generates a starter config automatically:

```bash
npx madrigal init
```

Flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--sources` | `**/*.md **/*.yaml` | Glob patterns to scan |
| `--output` | `madrigal.config.yaml` | Where to write the config |
| `--dry-run` | — | Print config to stdout instead of writing |

The wizard:
1. Reads all matching files and counts field frequencies
2. Identifies fields that don't match Madrigal's normalized names
3. Detects your weight-equivalent field and its values
4. Matches against known vocabularies (design-system maturity, priority levels, etc.)
5. Writes a `madrigal.config.yaml` with suggested `fieldMappings` and `levels`

Review the generated config before committing. Remove any mappings where your field name already matches Madrigal's, and adjust the `levels` ordering to match your team's convention.

---

## Migration from `enforcement`/`severity`

If you used earlier versions of Madrigal that required `enforcement` or `severity` frontmatter, those fields still work as deprecated aliases. Madrigal maps them to `weight` automatically:

| Old value | New value |
|-----------|-----------|
| `error` | `must` |
| `warning` | `should` |
| `info` | `may` |

You can migrate gradually — mixed files work fine. When you're ready, rename the fields in bulk:

```bash
# Rename enforcement → weight in frontmatter
find knowledge -name "*.md" -exec sed -i '' 's/^enforcement:/weight:/g' {} \;
```
