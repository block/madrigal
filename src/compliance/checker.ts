import type { SearchAdapter } from '../adapters/search.js';
import type { MadrigalConfig } from '../config.js';
import { resolveForBrand } from '../resolver.js';
import type { KnowledgeUnit } from '../schema/index.js';
import type { ComplianceResult, ComplianceViolation } from './index.js';

/**
 * Options for running a compliance check.
 */
export interface CheckOptions {
  /** The content to check against the knowledge base */
  content: string;
  /** Optional brand context — resolves brand-specific overrides */
  brand?: string;
  /** Optional domain filter */
  domain?: string;
  /** The search adapter to find relevant rules */
  searchAdapter: SearchAdapter;
  /** All loaded knowledge units */
  units: KnowledgeUnit[];
  /** Madrigal configuration (needed for brand resolution) */
  config: MadrigalConfig;
  /** Base directory for resolving override files */
  baseDir?: string;
  /** Maximum rules to surface (default: 20) */
  limit?: number;
}

/**
 * Check content against the knowledge base for compliance violations.
 *
 * Uses the search adapter to find relevant rules, resolves brand overrides,
 * and partitions matches into violations (must), warnings (should), and info.
 */
export async function checkCompliance(
  options: CheckOptions,
): Promise<ComplianceResult> {
  const {
    content,
    brand,
    domain,
    searchAdapter,
    units,
    config,
    baseDir,
    limit = 20,
  } = options;

  // If brand specified, resolve overrides first
  const resolvedUnits = brand
    ? resolveForBrand({ units, config, brand, baseDir })
    : units;

  // Build a search adapter over the resolved units if brand was specified
  // (enforcement levels may have changed due to overrides)
  let effectiveSearch = searchAdapter;
  if (brand) {
    const { BM25SearchAdapter } = await import('../search/adapter.js');
    effectiveSearch = new BM25SearchAdapter(resolvedUnits);
  }

  // Find relevant rules via semantic search
  const scored = await effectiveSearch.semanticSearch(content, {
    domain,
    brand,
    limit,
  });

  // Partition by enforcement level
  const violations: ComplianceViolation[] = [];
  const warnings: ComplianceViolation[] = [];
  const info: ComplianceViolation[] = [];

  for (const result of scored) {
    const violation: ComplianceViolation = {
      knowledgeUnit: result.unit,
      matchResult: {
        knowledgeUnitId: result.unit.id,
        matched: true,
        confidence: result.score,
      },
      message: `${result.unit.title} [${result.unit.enforcement.toUpperCase()}]`,
    };

    switch (result.unit.enforcement) {
      case 'must':
        violations.push(violation);
        break;
      case 'should':
        warnings.push(violation);
        break;
      default:
        info.push(violation);
        break;
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    info,
  };
}
