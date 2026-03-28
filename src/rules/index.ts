import type { Enforcement } from '../enforcement.js';

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
 * Brand-specific enforcement override configuration.
 */
export interface OverrideConfig {
  brand: string;
  knowledgeUnitId: string;
  enforcement: Enforcement;
  reason: string;
}
