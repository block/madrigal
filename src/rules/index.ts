import type { Weight } from '../weight.js';

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
 * Brand-specific weight override configuration.
 */
export interface OverrideConfig {
  brand: string;
  knowledgeUnitId: string;
  weight: string;
  reason: string;
}
