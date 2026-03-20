import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { MadrigalConfig } from './config.js';
import type { KnowledgeUnit } from './schema/index.js';
import type { Severity } from './severity.js';

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
  /** Base directory for finding override files */
  baseDir?: string;
}

/**
 * Override entry from overrides.yaml.
 */
export interface SeverityOverride {
  /** ID of the knowledge unit to override */
  id: string;
  /** New severity level */
  severity: Severity;
  /** Reason for the override */
  reason?: string;
}

/**
 * Overrides file structure.
 */
export interface OverridesFile {
  overrides?: SeverityOverride[];
}

/**
 * Resolve knowledge units for a specific brand.
 *
 * Resolution logic:
 * 1. Start with units matching the brand's `include` list (e.g., 'global')
 * 2. Layer on brand-specific units
 * 3. If same `id` exists in both layers, brand-specific wins (deep merge)
 * 4. Apply severity overrides from overrides.yaml files
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

  // Apply severity overrides from overrides.yaml files
  const overrides = loadOverrides(brand, baseDir);
  for (const override of overrides) {
    const unit = unitMap.get(override.id);
    if (unit) {
      unitMap.set(override.id, {
        ...unit,
        severity: override.severity,
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
 * Load severity overrides from overrides.yaml files.
 *
 * Searches for:
 * 1. knowledge/<brand>/overrides.yaml
 * 2. knowledge/brands/<brand>/overrides.yaml
 */
function loadOverrides(brand: string, baseDir: string): SeverityOverride[] {
  const overrides: SeverityOverride[] = [];

  const possiblePaths = [
    join(baseDir, 'knowledge', brand, 'overrides.yaml'),
    join(baseDir, 'knowledge', 'brands', brand, 'overrides.yaml'),
    join(baseDir, brand, 'overrides.yaml'),
  ];

  for (const overridePath of possiblePaths) {
    if (existsSync(overridePath)) {
      try {
        const content = readFileSync(overridePath, 'utf-8');
        const parsed = parseYaml(content) as OverridesFile;
        if (parsed.overrides && Array.isArray(parsed.overrides)) {
          overrides.push(...parsed.overrides);
        }
      } catch {
        // Ignore parse errors for override files
      }
    }
  }

  return overrides;
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
 * Filter units by severity.
 */
export function filterBySeverity(
  units: KnowledgeUnit[],
  severity: Severity
): KnowledgeUnit[] {
  return units.filter((u) => u.severity === severity);
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
