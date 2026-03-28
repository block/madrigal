/**
 * Enforcement levels for knowledge units.
 *
 * - must: Must be followed, will fail CI enforcement
 * - should: Should be followed, may fail CI in strict mode
 * - may: Optional guidance, won't fail CI
 * - context: Background context, not a rule
 * - deprecated: Previously valid, now superseded
 */
export type Enforcement = 'must' | 'should' | 'may' | 'context' | 'deprecated';

export const ENFORCEMENT_ORDER: Record<Enforcement, number> = {
  must: 0,
  should: 1,
  may: 2,
  context: 3,
  deprecated: 4,
};

export function compareEnforcement(a: Enforcement, b: Enforcement): number {
  return ENFORCEMENT_ORDER[a] - ENFORCEMENT_ORDER[b];
}

export function isEnforceable(enforcement: Enforcement): boolean {
  return enforcement === 'must' || enforcement === 'should';
}

/**
 * Parse a string into an Enforcement value.
 * Returns null if the string is not a valid enforcement level.
 * Also accepts legacy severity values (error, warning, info) for backward compatibility.
 */
export function parseEnforcement(value: string): Enforcement | null {
  const normalized = value.toLowerCase().trim();
  if (normalized in ENFORCEMENT_ORDER) return normalized as Enforcement;

  // Backward compatibility: accept legacy severity values
  const legacyMap: Record<string, Enforcement> = {
    error: 'must',
    warning: 'should',
    info: 'may',
  };
  if (normalized in legacyMap) return legacyMap[normalized];

  return null;
}
