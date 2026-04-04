import type { MatchResult } from '../rules/index.js';
import type { KnowledgeUnit } from '../schema/index.js';

/**
 * Result of a compliance check.
 */
export interface ComplianceResult {
  passed: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceViolation[];
  info: ComplianceViolation[];
}

/**
 * A single compliance violation.
 */
export interface ComplianceViolation {
  knowledgeUnit: KnowledgeUnit;
  matchResult: MatchResult;
  message: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
}

/**
 * Output format for compliance reports.
 */
export type OutputFormat = 'sarif' | 'markdown' | 'json';

/**
 * Options for formatting compliance reports.
 */
export interface ReportOptions {
  format: OutputFormat;
  includeContext?: boolean;
  includeSuggestions?: boolean;
}
