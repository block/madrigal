/**
 * Weight levels for knowledge units.
 *
 * Weight expresses how strongly a unit should influence decisions — from
 * non-negotiable requirements down to deprecated guidance. The specific values
 * are config-driven; teams define their own vocabulary and map it here.
 *
 * Default levels (used when no custom levels are configured):
 *   must > should > may > context > deprecated
 */

/** Default ordered weight levels, highest weight first. */
export const DEFAULT_WEIGHT_LEVELS = [
  'must',
  'should',
  'may',
  'context',
  'deprecated',
] as const;

export type DefaultWeight = (typeof DEFAULT_WEIGHT_LEVELS)[number];

/** Weight is any string — validated at load time against config levels. */
export type Weight = string;

/**
 * Build a weight-order map from an ordered levels array.
 * Index 0 = highest weight (most important).
 */
export function buildWeightOrder(levels: string[]): Record<string, number> {
  const order: Record<string, number> = {};
  for (let i = 0; i < levels.length; i++) {
    order[levels[i]] = i;
  }
  return order;
}

/** Default WEIGHT_ORDER built from DEFAULT_WEIGHT_LEVELS. */
export const WEIGHT_ORDER: Record<string, number> = buildWeightOrder([
  ...DEFAULT_WEIGHT_LEVELS,
]);

/**
 * Compare two weight values using a given order map.
 * Returns negative if a has higher weight than b (sort-ascending = highest first).
 */
export function compareWeight(
  a: string,
  b: string,
  order: Record<string, number> = WEIGHT_ORDER,
): number {
  return (order[a] ?? 99) - (order[b] ?? 99);
}

/**
 * Returns true when the weight value is in the top half of the level stack
 * (i.e. index < midpoint). Used for weight-style checks.
 */
export function isHighWeight(
  w: string,
  levels: string[] = [...DEFAULT_WEIGHT_LEVELS],
): boolean {
  const idx = levels.indexOf(w);
  if (idx < 0) return false;
  return idx < Math.ceil(levels.length / 2);
}

/**
 * Parse a raw string into a validated weight value.
 *
 * Accepts:
 *  - Any value present in the provided levels array
 *  - Legacy severity aliases: error→must, warning→should, info→may
 *  - Legacy weight values when using default levels
 *
 * Returns null if the value is unrecognized.
 */
export function parseWeight(
  value: string,
  levels: string[] = [...DEFAULT_WEIGHT_LEVELS],
): string | null {
  const normalized = value.toLowerCase().trim();

  if (levels.includes(normalized)) return normalized;

  // Backward compatibility: legacy severity field values
  const legacyMap: Record<string, string> = {
    error: 'must',
    warning: 'should',
    info: 'may',
  };
  if (normalized in legacyMap) {
    const mapped = legacyMap[normalized];
    // Only return if the mapped value is valid in this level set
    if (levels.includes(mapped)) return mapped;
  }

  return null;
}

/**
 * Return the lowest-weight (least important) level in a levels array.
 * Used as the default when no weight is specified.
 */
export function defaultWeight(
  levels: string[] = [...DEFAULT_WEIGHT_LEVELS],
): string {
  // Use 'may' if present (familiar default), otherwise last item
  return levels.includes('may') ? 'may' : (levels[levels.length - 1] ?? 'may');
}
