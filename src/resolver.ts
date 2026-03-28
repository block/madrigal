import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { MadrigalConfig } from './config.js';
import type { KnowledgeUnit } from './schema/index.js';
import type { Enforcement } from './enforcement.js';

/**
 * Options for resolving knowledge units.
 */
export interface ResolveOptions {
  /** Knowledge units to resolve */
  units: KnowledgeUnit[];
  /** The Madrigal configuration */
  config: MadrigalConfig;
  /** Resolve for a specific brand (if omitted, returns all units) */
  brand?: string;
  /** Filter by kind */
  kind?: string;
  /** Filter by attributes. Array-contains for array attributes, equality for scalars. */
  where?: Record<string, string | string[]>;
  /** Base directory for finding override files */
  baseDir?: string;
}

/**
 * Override entry from overrides.yaml.
 */
export interface EnforcementOverride {
  /** ID of the knowledge unit to override */
  id: string;
  /** New enforcement level */
  enforcement: Enforcement;
  /** Reason for the override */
  reason?: string;
}

/**
 * Overrides file structure.
 */
export interface OverridesFile {
  overrides?: EnforcementOverride[];
}

/**
 * Resolve knowledge units for a specific brand.
 *
 * Resolution logic:
 * 1. Start with units matching the brand's `include` list (e.g., 'global')
 * 2. Layer on brand-specific units
 * 3. If same `id` exists in both layers, brand-specific wins (deep merge)
 * 4. Apply enforcement overrides from overrides.yaml files
 *
 * @param options - Resolution options
 * @returns Resolved knowledge units for the brand
 */
export function resolveForBrand(options: ResolveOptions): KnowledgeUnit[] {
  const { units, config, brand, baseDir = process.cwd() } = options;

  // If no brand specified, return all units
  if (!brand) {
    return [...units];
  }

  const brandConfig = config.brands[brand];
  if (!brandConfig) {
    // Unknown brand, return only global units
    return units.filter((u) => !u.brand || u.brand === 'global');
  }

  // Collect all units that apply to this brand
  const unitMap = new Map<string, KnowledgeUnit>();

  // First, add units from included brands/groups
  const includes = brandConfig.include || [];
  for (const includeName of includes) {
    for (const unit of units) {
      // Global units (no brand) or units matching the include name
      if (
        !unit.brand ||
        unit.brand === includeName ||
        unit.brand === 'global'
      ) {
        unitMap.set(unit.id, { ...unit });
      }
    }
  }

  // Also include global units by default
  for (const unit of units) {
    if (!unit.brand || unit.brand === 'global') {
      if (!unitMap.has(unit.id)) {
        unitMap.set(unit.id, { ...unit });
      }
    }
  }

  // Layer on brand-specific units (these override globals with same ID)
  for (const unit of units) {
    if (unit.brand === brand) {
      const existing = unitMap.get(unit.id);
      if (existing) {
        // Deep merge: brand-specific wins but inherits missing fields
        unitMap.set(unit.id, mergeUnits(existing, unit));
      } else {
        unitMap.set(unit.id, { ...unit });
      }
    }
  }

  // Apply enforcement overrides from overrides.yaml files
  const overrides = loadOverrides(brand, baseDir);
  for (const override of overrides) {
    const unit = unitMap.get(override.id);
    if (unit) {
      unitMap.set(override.id, {
        ...unit,
        enforcement: override.enforcement,
      });
    }
  }

  return Array.from(unitMap.values());
}

/**
 * Deep merge two knowledge units. The overlay takes precedence.
 */
function mergeUnits(
  base: KnowledgeUnit,
  overlay: KnowledgeUnit
): KnowledgeUnit {
  return {
    ...base,
    ...overlay,
    // Merge tags (deduplicated)
    tags: [...new Set([...base.tags, ...overlay.tags])],
    // Overlay provenance wins if present
    provenance: overlay.provenance || base.provenance,
  };
}

/**
 * Load enforcement overrides from overrides.yaml files.
 *
 * Searches for:
 * 1. knowledge/<brand>/overrides.yaml
 * 2. knowledge/brands/<brand>/overrides.yaml
 *
 * Supports both 'enforcement' and legacy 'severity' field names.
 */
function loadOverrides(brand: string, baseDir: string): EnforcementOverride[] {
  const overrides: EnforcementOverride[] = [];

  const possiblePaths = [
    join(baseDir, 'knowledge', brand, 'overrides.yaml'),
    join(baseDir, 'knowledge', 'brands', brand, 'overrides.yaml'),
    join(baseDir, brand, 'overrides.yaml'),
  ];

  for (const overridePath of possiblePaths) {
    if (existsSync(overridePath)) {
      try {
        const content = readFileSync(overridePath, 'utf-8');
        const parsed = parseYaml(content) as Record<string, unknown>;
        if (parsed.overrides && Array.isArray(parsed.overrides)) {
          for (const entry of parsed.overrides) {
            const raw = entry as Record<string, unknown>;
            overrides.push({
              id: String(raw.id),
              // Support both 'enforcement' and legacy 'severity' field
              enforcement: (raw.enforcement || raw.severity) as Enforcement,
              reason: raw.reason ? String(raw.reason) : undefined,
            });
          }
        }
      } catch {
        // Ignore parse errors for override files
      }
    }
  }

  return overrides;
}

/**
 * Resolve knowledge units with brand resolution + kind/attribute filtering.
 *
 * Composes resolveForBrand with kind and where filters.
 * Use this when you need both brand resolution and attribute-based filtering.
 */
export function resolveUnits(options: ResolveOptions): KnowledgeUnit[] {
  let units = resolveForBrand(options);

  if (options.kind) {
    units = units.filter((u) => u.kind === options.kind);
  }

  if (options.where) {
    units = filterByAttributes(units, options.where);
  }

  return units;
}

/**
 * Filter units by attribute matching.
 *
 * For each key in the where clause:
 * - If the unit's attribute value is an array and the filter is a string:
 *   checks if the array contains the string.
 * - If the unit's attribute value is a string and the filter is a string:
 *   checks equality.
 * - If the filter is an array: checks if the unit's attribute value
 *   is in the filter array (OR for scalars) or has any overlap (for arrays).
 */
export function filterByAttributes(
  units: KnowledgeUnit[],
  where: Record<string, string | string[]>
): KnowledgeUnit[] {
  return units.filter((unit) => {
    for (const [key, filterValue] of Object.entries(where)) {
      const attrValue = unit.attributes[key];
      if (attrValue === undefined) return false;

      if (Array.isArray(filterValue)) {
        // Filter is an array — check overlap
        if (Array.isArray(attrValue)) {
          // Both arrays: any overlap
          if (!filterValue.some((fv) => (attrValue as string[]).includes(fv))) return false;
        } else {
          // Attr is scalar, filter is array: check if scalar is in array
          if (!filterValue.includes(String(attrValue))) return false;
        }
      } else {
        // Filter is a string
        if (Array.isArray(attrValue)) {
          // Attr is array: check if it contains the filter value
          if (!(attrValue as string[]).includes(filterValue)) return false;
        } else {
          // Both scalars: equality
          if (String(attrValue) !== filterValue) return false;
        }
      }
    }
    return true;
  });
}

/**
 * Group units by a specific field.
 */
export function groupUnitsBy(
  units: KnowledgeUnit[],
  field: 'brand' | 'domain' | 'system'
): Map<string, KnowledgeUnit[]> {
  const groups = new Map<string, KnowledgeUnit[]>();

  for (const unit of units) {
    const key = unit[field] || 'default';
    const existing = groups.get(key);
    if (existing) {
      existing.push(unit);
    } else {
      groups.set(key, [unit]);
    }
  }

  return groups;
}

/**
 * Filter units by domain.
 */
export function filterByDomain(
  units: KnowledgeUnit[],
  domain: string
): KnowledgeUnit[] {
  return units.filter((u) => u.domain === domain);
}

/**
 * Filter units by enforcement level.
 */
export function filterByEnforcement(
  units: KnowledgeUnit[],
  enforcement: Enforcement
): KnowledgeUnit[] {
  return units.filter((u) => u.enforcement === enforcement);
}

/**
 * Filter units by system.
 */
export function filterBySystem(
  units: KnowledgeUnit[],
  system: string
): KnowledgeUnit[] {
  return units.filter((u) => u.system === system);
}
