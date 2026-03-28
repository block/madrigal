import type { Enforcement } from '../enforcement.js';

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
 * Brand-specific enforcement override for a knowledge unit.
 * Allows a global rule to have different enforcement levels per brand.
 */
export interface BrandEnforcementOverride {
  /** The brand this override applies to */
  brandId: string;

  /** The knowledge unit being overridden */
  knowledgeUnitId: string;

  /** The brand-specific enforcement level */
  enforcement: Enforcement;

  /** Reason for the override */
  reason?: string;

  /** ISO 8601 timestamp of creation */
  createdAt: string;

  /** User who created this override */
  createdBy?: string;
}

/**
 * Input for creating a brand enforcement override.
 */
export interface CreateBrandEnforcementOverride {
  brandId: string;
  knowledgeUnitId: string;
  enforcement: Enforcement;
  reason?: string;
  createdBy?: string;
}
