import type { Enforcement } from '../enforcement.js';
import type {
  CreateKnowledgeUnit,
  Domain,
  KnowledgeUnit,
  UpdateKnowledgeUnit,
} from '../schema/knowledge-unit.js';

/**
 * Filter options for querying knowledge units.
 */
export interface QueryFilter {
  /** Filter by domain */
  domain?: Domain;

  /** Filter by brand (null for global rules only) */
  brand?: string | null;

  /** Filter by enforcement level */
  enforcement?: Enforcement;

  /** Filter by tags (any match) */
  tags?: string[];

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * StorageAdapter defines the interface for CRUD operations on knowledge units.
 * Implementations may use Postgres, in-memory storage, or other backends.
 */
export interface StorageAdapter {
  /**
   * Retrieve a knowledge unit by its unique ID.
   */
  getById(id: string): Promise<KnowledgeUnit | null>;

  /**
   * Query knowledge units with optional filters.
   */
  query(filter: QueryFilter): Promise<KnowledgeUnit[]>;

  /**
   * Create a new knowledge unit.
   * The implementation is responsible for generating id, createdAt, updatedAt.
   */
  create(unit: CreateKnowledgeUnit): Promise<KnowledgeUnit>;

  /**
   * Update an existing knowledge unit.
   * Returns the updated unit.
   * Throws if the unit does not exist.
   */
  update(id: string, updates: UpdateKnowledgeUnit): Promise<KnowledgeUnit>;

  /**
   * Delete a knowledge unit by ID.
   * Throws if the unit does not exist.
   */
  delete(id: string): Promise<void>;

  /**
   * Count knowledge units matching the filter.
   */
  count(filter?: QueryFilter): Promise<number>;
}
