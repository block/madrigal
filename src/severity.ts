/**
 * Severity levels for knowledge units.
 *
 * - error: Must be fixed, will fail CI enforcement
 * - warning: Should be fixed, may fail CI in strict mode
 * - info: Informational, won't fail CI
 * - context: Background context, not a rule
 * - deprecated: Previously valid, now superseded
 */
export type Severity = 'error' | 'warning' | 'info' | 'context' | 'deprecated';

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  context: 3,
  deprecated: 4,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function isEnforceable(severity: Severity): boolean {
  return severity === 'error' || severity === 'warning';
}

/**
 * Parse a string into a Severity value.
 * Returns null if the string is not a valid severity.
 */
export function parseSeverity(value: string): Severity | null {
  const normalized = value.toLowerCase().trim();
  if (normalized in SEVERITY_ORDER) return normalized as Severity;
  return null;
}
