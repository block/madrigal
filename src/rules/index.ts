import type { Severity } from '../severity.js';

/**
 * Result of matching a code pattern against a knowledge unit rule.
 */
export interface MatchResult {
  knowledgeUnitId: string;
  matched: boolean;
  confidence: number;
  context?: string;
}

/**
 * Brand-specific severity override configuration.
 */
export interface OverrideConfig {
  brand: string;
  knowledgeUnitId: string;
  severity: Severity;
  reason: string;
}
