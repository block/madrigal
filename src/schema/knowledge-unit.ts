import type { Provenance } from '../provenance.js';
import type { Weight } from '../weight.js';

/**
 * Knowledge domains supported by the system.
 * Domain is a string validated at load time against madrigal.config.yaml domains,
 * not at compile time via a union type. This allows config-driven domain definitions.
 */
export type Domain = string;

/**
 * Frontmatter fields expected in knowledge markdown files.
 * Unknown fields are collected into `attributes` automatically.
 */
export interface KnowledgeFrontmatter {
  id?: string;
  title?: string;
  domain?: string;
  kind?: string;
  system?: string;
  brand?: string;
  tags?: string[];
  /** Weight level — how strongly this unit should influence decisions. */
  weight?: string;
  /** @deprecated Use weight instead */
  enforcement?: string;
  /** @deprecated Use weight instead */
  severity?: string;
  attributes?: Record<string, unknown>;
  provenance?: Partial<Provenance>;
}

/**
 * A KnowledgeUnit is the atomic unit of design knowledge.
 * It represents a single rule, guideline, pattern, or insight.
 */
export interface KnowledgeUnit {
  /** Unique identifier */
  id: string;

  /** Human-readable title */
  title: string;

  /** Markdown content describing the knowledge */
  body: string;

  /** Knowledge domain this unit belongs to */
  domain: Domain;

  /** Structural type of knowledge (e.g., 'rule', 'glossary', 'rubric', 'template') */
  kind: string;

  /** Design system this applies to (e.g., 'market', 'arcade', 'wave') */
  system?: string;

  /** Brand this applies to; omit or use 'shared'/'global' for universal units */
  brand?: string;

  /** Searchable tags for categorization */
  tags: string[];

  /**
   * How strongly this unit should influence decisions.
   * Config-driven — teams define their own level vocabulary in madrigal.config.yaml.
   * Default levels: must > should > may > context > deprecated.
   */
  weight: Weight;

  /** @deprecated Use weight instead */
  enforcement?: Weight;

  /** Open metadata for domain-specific attributes (surfaces, audiences, etc.) */
  attributes: Record<string, unknown>;

  /** Origin and approval tracking */
  provenance: Provenance;

  /** Relative path to the source file */
  sourcePath?: string;

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
  domain: Domain;
  kind?: string;
  system?: string;
  brand?: string;
  tags: string[];
  weight: Weight;
  attributes?: Record<string, unknown>;
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
  weight?: Weight;
  attributes?: Record<string, unknown>;
  provenance?: Provenance;
}

/**
 * Knowledge unit with vector embedding for semantic search.
 */
export interface KnowledgeUnitWithEmbedding extends KnowledgeUnit {
  /** Vector embedding for semantic search */
  embedding?: number[];
}
