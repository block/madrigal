import {
  loadConfig,
  type MadrigalConfig,
  type PlatformConfig,
  validateConfig,
} from './config.js';
import {
  defaultRegistry,
  type Format,
  type FormatOptions,
} from './formats/index.js';
import { type LoadResult, loadKnowledge } from './loader.js';
import { defaultPreprocessorRegistry } from './preprocessors/index.js';
import { groupUnitsBy, resolveForBrand } from './resolver.js';
import type { KnowledgeUnit } from './schema/index.js';

/**
 * Options for the build pipeline.
 */
export interface BuildOptions {
  /** Path to the config file (defaults to searching for madrigal.config.yaml) */
  configPath?: string;
  /** Build specific platform only (if omitted, builds all platforms) */
  platform?: string;
  /** Dry run - validate and report but don't output */
  dryRun?: boolean;
  /** Base directory for resolving paths (defaults to cwd) */
  baseDir?: string;
  /** Custom format registry (defaults to built-in formats) */
  formatRegistry?: typeof defaultRegistry;
  /** Custom preprocessor registry (defaults to empty) */
  preprocessorRegistry?: typeof defaultPreprocessorRegistry;
}

/**
 * Result of a single platform build.
 */
export interface BuildResult {
  /** Platform name from config */
  platform: string;
  /** Format used for this build */
  format: string;
  /** The compiled output content */
  output: string;
  /** Number of knowledge units included */
  unitCount: number;
  /** Group key (brand, domain, or system name) if grouped */
  group?: string;
  /** Any warnings during build */
  warnings: string[];
}

/**
 * Result of the full build pipeline.
 */
export interface PipelineResult {
  /** Individual build results */
  results: BuildResult[];
  /** Total units loaded */
  totalUnits: number;
  /** Load errors */
  loadErrors: LoadResult['errors'];
  /** Load warnings */
  loadWarnings: LoadResult['warnings'];
  /** Configuration validation warnings */
  configWarnings: string[];
  /** Whether the build succeeded */
  success: boolean;
}

/**
 * Run the Madrigal build pipeline.
 *
 * Pipeline stages:
 * 1. Load config from madrigal.config.yaml
 * 2. Load knowledge units from source files
 * 3. Run preprocessors
 * 4. For each platform:
 *    a. Resolve units (apply brand includes/overrides)
 *    b. Group units if needed
 *    c. Apply format to compile output
 *
 * @param options - Build options
 * @returns Pipeline results
 */
export async function build(
  options: BuildOptions = {},
): Promise<PipelineResult> {
  const {
    configPath,
    platform: targetPlatform,
    dryRun = false,
    baseDir = process.cwd(),
    formatRegistry = defaultRegistry,
    preprocessorRegistry = defaultPreprocessorRegistry,
  } = options;

  const results: BuildResult[] = [];
  const configWarnings: string[] = [];

  // 1. Load configuration
  let config: MadrigalConfig;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    return {
      results: [],
      totalUnits: 0,
      loadErrors: [],
      loadWarnings: [],
      configWarnings: [err instanceof Error ? err.message : String(err)],
      success: false,
    };
  }

  // 2. Validate configuration
  const validation = validateConfig(config, formatRegistry.list());
  if (!validation.valid) {
    return {
      results: [],
      totalUnits: 0,
      loadErrors: [],
      loadWarnings: [],
      configWarnings: validation.errors.map((e) => `${e.path}: ${e.message}`),
      success: false,
    };
  }
  configWarnings.push(
    ...validation.warnings.map((w) => `${w.path}: ${w.message}`),
  );

  // 3. Load knowledge units
  const loadResult = await loadKnowledge({
    sources: config.sources,
    config,
    baseDir,
  });

  if (loadResult.errors.length > 0) {
    // Non-fatal: continue with successfully loaded units
    configWarnings.push(`${loadResult.errors.length} file(s) failed to load`);
  }

  // 4. Run preprocessors
  let units = loadResult.units;
  for (const preprocessor of preprocessorRegistry.all()) {
    try {
      units = await preprocessor.process(units, config);
    } catch (err) {
      configWarnings.push(
        `Preprocessor "${preprocessor.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 5. Build each platform
  const platformNames = targetPlatform
    ? [targetPlatform]
    : Object.keys(config.platforms);

  for (const platformName of platformNames) {
    const platformConfig = config.platforms[platformName];
    if (!platformConfig) {
      configWarnings.push(`Unknown platform: ${platformName}`);
      continue;
    }

    const format = formatRegistry.get(platformConfig.format);
    if (!format) {
      configWarnings.push(
        `Platform "${platformName}": unknown format "${platformConfig.format}"`,
      );
      continue;
    }

    // Build for this platform
    const platformResults = await buildPlatform(
      units,
      platformName,
      platformConfig,
      format,
      config,
      dryRun,
    );
    results.push(...platformResults);
  }

  return {
    results,
    totalUnits: units.length,
    loadErrors: loadResult.errors,
    loadWarnings: loadResult.warnings,
    configWarnings,
    success: true,
  };
}

/**
 * Build a single platform.
 */
async function buildPlatform(
  units: KnowledgeUnit[],
  platformName: string,
  platformConfig: PlatformConfig,
  format: Format,
  config: MadrigalConfig,
  dryRun: boolean,
): Promise<BuildResult[]> {
  const results: BuildResult[] = [];

  // If groupBy is specified, compile separately for each group
  if (platformConfig.groupBy) {
    const groups = groupUnitsBy(units, platformConfig.groupBy);

    for (const [groupKey, groupUnits] of groups) {
      // If grouping by brand, also resolve includes/overrides
      const resolvedUnits =
        platformConfig.groupBy === 'brand'
          ? resolveForBrand({ units, config, brand: groupKey })
          : groupUnits;

      const formatOptions: FormatOptions = {
        platform: platformConfig,
        config,
        brand: platformConfig.groupBy === 'brand' ? groupKey : undefined,
        domain: platformConfig.groupBy === 'domain' ? groupKey : undefined,
        system: platformConfig.groupBy === 'system' ? groupKey : undefined,
      };

      if (!dryRun) {
        const output = await format.compile(resolvedUnits, formatOptions);
        results.push({
          platform: platformName,
          format: format.name,
          output,
          unitCount: resolvedUnits.length,
          group: groupKey,
          warnings: [],
        });
      } else {
        results.push({
          platform: platformName,
          format: format.name,
          output: '',
          unitCount: resolvedUnits.length,
          group: groupKey,
          warnings: ['Dry run - no output generated'],
        });
      }
    }
  } else {
    // No grouping - compile all units together
    const formatOptions: FormatOptions = {
      platform: platformConfig,
      config,
    };

    if (!dryRun) {
      const output = await format.compile(units, formatOptions);
      results.push({
        platform: platformName,
        format: format.name,
        output,
        unitCount: units.length,
        warnings: [],
      });
    } else {
      results.push({
        platform: platformName,
        format: format.name,
        output: '',
        unitCount: units.length,
        warnings: ['Dry run - no output generated'],
      });
    }
  }

  return results;
}

/**
 * Build a single platform by name.
 * Convenience wrapper around build() for single-platform builds.
 */
export async function buildPlatformByName(
  platformName: string,
  options: Omit<BuildOptions, 'platform'> = {},
): Promise<BuildResult[]> {
  const result = await build({ ...options, platform: platformName });
  return result.results;
}
