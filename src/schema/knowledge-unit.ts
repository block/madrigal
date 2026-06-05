import type { Enforcement } from '../enforcement.js';
import type { Provenance } from '../provenance.js';

/**
 * Knowledge domains supported by the system.
 * Domain is a string validated at load time against madrigal.config.yaml domains,
 * not at compile time via a union type. This allows config-driven domain definitions.
 */
export type Domain = string;

/**
 * Relationship extracted from source content or frontmatter.
 * Consumers define relationship semantics; Madrigal preserves and resolves them.
 */
export interface KnowledgeRelationship {
  /** Relationship kind, e.g. wikilink */
  type: string;
  /** Raw target as written in the source */
  target: string;
  /** Optional display label, e.g. the label in [[Target|Label]] */
  label?: string;
  /** Resolved target knowledge unit ID when Madrigal can resolve it */
  targetId?: string;
  /** Whether this relationship could be resolved to a loaded unit */
  resolved: boolean;
}

/**
 * Frontmatter fields expected in knowledge markdown files.
 */
export interface KnowledgeFrontmatter {
  [key: string]: unknown;
  id?: string;
  title?: string;
  domain?: string;
  type?: string;
  kind?: string;
  system?: string;
  brand?: string;
  tags?: string[];
  enforcement?: string;
  /** @deprecated Use enforcement instead */
  severity?: string;
  attributes?: Record<string, unknown>;
  provenance?: Partial<Provenance>;
}

/**
 * A KnowledgeUnit is Madrigal's normalized representation of a source record.
 * Consumer configs define domain terms; Madrigal preserves raw metadata and
 * normalizes the fields needed for compilation, linting, and retrieval.
 */
export interface KnowledgeUnit {
  /** Unique identifier */
  id: string;

  /** Human-readable title */
  title: string;

  /** Markdown content describing the knowledge */
  body: string;

  /** Structural type of knowledge (consumer-defined, e.g. study, theme, rule) */
  kind: string;

  /** Searchable tags for categorization */
  tags: string[];

  /** Relative path to the source file */
  sourcePath?: string;

  /** Raw parsed frontmatter, preserved exactly as parsed from the source */
  frontmatter: Record<string, unknown>;

  /** Open metadata for domain-specific attributes after normalization */
  attributes: Record<string, unknown>;

  /** Extracted relationships, such as wiki links */
  relationships: KnowledgeRelationship[];

  /** Origin and approval tracking */
  provenance: Provenance;

  /** Knowledge domain this unit belongs to, when configured/present */
  domain?: Domain;

  /** Design system this applies to (e.g., 'market', 'arcade', 'wave') */
  system?: string;

  /** Brand this applies to, null for global rules */
  brand?: string;

  /** Enforcement level for rule-oriented consumers */
  enforcement?: Enforcement;

  /** ISO 8601 timestamp of creation */
  createdAt?: string;

  /** ISO 8601 timestamp of last update */
  updatedAt?: string;
}

/**
 * Input for creating a new knowledge unit.
 * System-generated fields (id, createdAt, updatedAt) are omitted.
 */
export interface CreateKnowledgeUnit {
  title: string;
  body: string;
  domain?: Domain;
  kind?: string;
  system?: string;
  brand?: string;
  tags: string[];
  enforcement?: Enforcement;
  frontmatter?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  relationships?: KnowledgeRelationship[];
  provenance: Provenance;
}

/**
 * Input for updating an existing knowledge unit.
 * All fields are optional except those managed by the system.
 */
export interface UpdateKnowledgeUnit {
  title?: string;
  body?: string;
  domain?: Domain;
  kind?: string;
  system?: string;
  brand?: string;
  tags?: string[];
  enforcement?: Enforcement;
  frontmatter?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  relationships?: KnowledgeRelationship[];
  provenance?: Provenance;
}

/**
 * Knowledge unit with vector embedding for semantic search.
 */
export interface KnowledgeUnitWithEmbedding extends KnowledgeUnit {
  /** Vector embedding for semantic search */
  embedding?: number[];
}
