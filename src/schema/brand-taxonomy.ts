import type { Severity } from '../severity.js';

/**
 * A Brand represents a distinct brand identity within the organization.
 * Brands can have hierarchical relationships (e.g., sub-brands).
 */
export interface Brand {
  /** Unique identifier (UUID) */
  id: string;

  /** Human-readable brand name */
  name: string;

  /** URL-safe identifier */
  slug: string;

  /** Brand description */
  description?: string;

  /** Parent brand ID for sub-brands, null for top-level brands */
  parentBrand?: string;

  /** ISO 8601 timestamp of creation */
  createdAt: string;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Input for creating a new brand.
 */
export interface CreateBrand {
  name: string;
  slug: string;
  description?: string;
  parentBrand?: string;
}

/**
 * Brand-specific severity override for a knowledge unit.
 * Allows a global rule to have different enforcement levels per brand.
 */
export interface BrandSeverityOverride {
  /** The brand this override applies to */
  brandId: string;

  /** The knowledge unit being overridden */
  knowledgeUnitId: string;

  /** The brand-specific severity level */
  severity: Severity;

  /** Reason for the override */
  reason?: string;

  /** ISO 8601 timestamp of creation */
  createdAt: string;

  /** User who created this override */
  createdBy?: string;
}

/**
 * Input for creating a brand severity override.
 */
export interface CreateBrandSeverityOverride {
  brandId: string;
  knowledgeUnitId: string;
  severity: Severity;
  reason?: string;
  createdBy?: string;
}
