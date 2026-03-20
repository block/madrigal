import type { MadrigalConfig } from '../config.js';
import type { KnowledgeUnit } from '../schema/index.js';

/**
 * A preprocessor plugin that transforms knowledge units before compilation.
 *
 * Preprocessors run in the pipeline after loading but before format compilation.
 * They can add, modify, or remove knowledge units.
 *
 * Example use cases:
 * - Enriching units with data from external sources (Figma, brand sites)
 * - Generating synthetic units from patterns
 * - Filtering or transforming content
 * - Adding computed fields (embeddings, hashes)
 */
export interface Preprocessor {
  /** Unique name for this preprocessor */
  name: string;
  /** Human-readable description */
  description?: string;
  /**
   * Process knowledge units.
   * @param units - Knowledge units to process
   * @param config - Madrigal configuration
   * @returns Processed knowledge units
   */
  process(
    units: KnowledgeUnit[],
    config: MadrigalConfig
  ): KnowledgeUnit[] | Promise<KnowledgeUnit[]>;
}

/**
 * Registry for preprocessor plugins.
 * Allows registering, retrieving, and listing available preprocessors.
 */
export class PreprocessorRegistry {
  private preprocessors = new Map<string, Preprocessor>();

  /**
   * Register a preprocessor plugin.
   * @param preprocessor - The preprocessor to register
   * @throws Error if a preprocessor with the same name is already registered
   */
  register(preprocessor: Preprocessor): void {
    if (this.preprocessors.has(preprocessor.name)) {
      throw new Error(
        `Preprocessor "${preprocessor.name}" is already registered`
      );
    }
    this.preprocessors.set(preprocessor.name, preprocessor);
  }

  /**
   * Get a preprocessor by name.
   * @param name - Preprocessor name
   * @returns The preprocessor, or undefined if not found
   */
  get(name: string): Preprocessor | undefined {
    return this.preprocessors.get(name);
  }

  /**
   * Check if a preprocessor is registered.
   * @param name - Preprocessor name
   * @returns true if the preprocessor exists
   */
  has(name: string): boolean {
    return this.preprocessors.has(name);
  }

  /**
   * List all registered preprocessor names.
   * @returns Array of preprocessor names
   */
  list(): string[] {
    return Array.from(this.preprocessors.keys());
  }

  /**
   * Get all registered preprocessors.
   * @returns Array of preprocessors
   */
  all(): Preprocessor[] {
    return Array.from(this.preprocessors.values());
  }

  /**
   * Unregister a preprocessor.
   * @param name - Preprocessor name to remove
   * @returns true if the preprocessor was removed
   */
  unregister(name: string): boolean {
    return this.preprocessors.delete(name);
  }

  /**
   * Clear all registered preprocessors.
   */
  clear(): void {
    this.preprocessors.clear();
  }
}

/**
 * Default preprocessor registry.
 * No built-in preprocessors are registered by default.
 * This is the extension point for future ingestion plugins.
 */
export const defaultPreprocessorRegistry = new PreprocessorRegistry();
