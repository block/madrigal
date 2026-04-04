import type { MadrigalConfig, PlatformConfig } from '../config.js';
import type { KnowledgeUnit } from '../schema/index.js';

/**
 * Options passed to format compile functions.
 */
export interface FormatOptions {
  /** Platform configuration from madrigal.config.yaml */
  platform: PlatformConfig;
  /** Full Madrigal configuration */
  config: MadrigalConfig;
  /** Brand being compiled for (if groupBy: brand) */
  brand?: string;
  /** Domain being compiled for (if groupBy: domain) */
  domain?: string;
  /** System being compiled for (if groupBy: system) */
  system?: string;
}

/**
 * A format plugin that compiles knowledge units into a specific output format.
 */
export interface Format {
  /** Unique name for this format */
  name: string;
  /** Human-readable description */
  description?: string;
  /** File extension for output (e.g., '.md', '.json') */
  extension?: string;
  /**
   * Compile knowledge units into the output format.
   * @param units - Knowledge units to compile
   * @param options - Compilation options
   * @returns Compiled output as a string
   */
  compile(
    units: KnowledgeUnit[],
    options: FormatOptions,
  ): string | Promise<string>;
}

/**
 * Registry for format plugins.
 * Allows registering, retrieving, and listing available formats.
 */
export class FormatRegistry {
  private formats = new Map<string, Format>();

  /**
   * Register a format plugin.
   * @param format - The format to register
   * @throws Error if a format with the same name is already registered
   */
  register(format: Format): void {
    if (this.formats.has(format.name)) {
      throw new Error(`Format "${format.name}" is already registered`);
    }
    this.formats.set(format.name, format);
  }

  /**
   * Get a format by name.
   * @param name - Format name
   * @returns The format, or undefined if not found
   */
  get(name: string): Format | undefined {
    return this.formats.get(name);
  }

  /**
   * Check if a format is registered.
   * @param name - Format name
   * @returns true if the format exists
   */
  has(name: string): boolean {
    return this.formats.has(name);
  }

  /**
   * List all registered format names.
   * @returns Array of format names
   */
  list(): string[] {
    return Array.from(this.formats.keys());
  }

  /**
   * Get all registered formats.
   * @returns Array of formats
   */
  all(): Format[] {
    return Array.from(this.formats.values());
  }

  /**
   * Unregister a format.
   * @param name - Format name to remove
   * @returns true if the format was removed
   */
  unregister(name: string): boolean {
    return this.formats.delete(name);
  }

  /**
   * Clear all registered formats.
   */
  clear(): void {
    this.formats.clear();
  }
}

/**
 * Default format registry, pre-loaded with built-in formats.
 * Import built-in formats and register them here.
 */
export const defaultRegistry = new FormatRegistry();

// Built-in formats are registered in index.ts to avoid circular imports
