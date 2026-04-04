/**
 * In-memory state for the Madrigal dev server.
 *
 * Loads config → validates → loads knowledge → builds BM25 search index.
 * POST /api/reload re-runs the full sequence.
 */

import { loadConfig, validateConfig, type MadrigalConfig, type ValidationResult } from '../config.js';
import { loadKnowledge, type LoadResult } from '../loader.js';
import { BM25SearchAdapter } from '../search/adapter.js';
import { defaultRegistry } from '../formats/index.js';
import type { KnowledgeUnit } from '../schema/index.js';

export interface DevState {
  config: MadrigalConfig;
  validation: ValidationResult;
  units: KnowledgeUnit[];
  loadErrors: LoadResult['errors'];
  loadWarnings: LoadResult['warnings'];
  search: BM25SearchAdapter;
}

let current: DevState | null = null;

/**
 * Load (or reload) state from disk.
 */
export async function loadState(baseDir: string): Promise<DevState> {
  const config = loadConfig();
  const validation = validateConfig(config, defaultRegistry.list());

  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });

  const search = new BM25SearchAdapter(loadResult.units);

  current = {
    config,
    validation,
    units: loadResult.units,
    loadErrors: loadResult.errors,
    loadWarnings: loadResult.warnings,
    search,
  };

  return current;
}

/**
 * Get the current state (throws if not yet loaded).
 */
export function getState(): DevState {
  if (!current) {
    throw new Error('Dev state not initialized. Call loadState() first.');
  }
  return current;
}
