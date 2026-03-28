import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Configuration for a knowledge domain.
 */
export interface DomainConfig {
  /** Human-readable description of the domain */
  description: string;
}

/**
 * Configuration for a knowledge kind (structural type).
 */
export interface KindConfig {
  /** Human-readable description of the kind */
  description: string;
}

/**
 * Configuration for a brand.
 */
export interface BrandConfig {
  /** Design systems associated with this brand (e.g., 'market', 'arcade', 'wave') */
  systems?: string[];
  /** Other brand/group names whose knowledge is inherited */
  include?: string[];
}

/**
 * Configuration for a publish platform/target.
 */
export interface PlatformConfig {
  /** Format to use for output (references a registered format by name) */
  format: string;
  /** How to group output ('brand' | 'domain' | 'system') */
  groupBy?: 'brand' | 'domain' | 'system';
  /** Output destination path or pattern */
  destination?: string;
}

/**
 * The root Madrigal configuration.
 * Loaded from madrigal.config.yaml or madrigal.config.js.
 */
export interface MadrigalConfig {
  /** Glob patterns for knowledge source files */
  sources: string[];
  /** Domain definitions (key is domain name) */
  domains: Record<string, DomainConfig>;
  /** Kind definitions (key is kind name, structural types of knowledge) */
  kinds: Record<string, KindConfig>;
  /** Brand definitions (key is brand name) */
  brands: Record<string, BrandConfig>;
  /** Publish platform definitions (key is platform name) */
  platforms: Record<string, PlatformConfig>;
}

/**
 * Result of config validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

const DEFAULT_CONFIG_NAMES = [
  'madrigal.config.yaml',
  'madrigal.config.yml',
  'madrigal.config.js',
];

/**
 * Load Madrigal configuration from a file.
 *
 * @param configPath - Path to config file. If not provided, searches for default config files.
 * @returns The parsed configuration
 * @throws Error if config file not found or invalid
 */
export function loadConfig(configPath?: string): MadrigalConfig {
  let resolvedPath: string | undefined;

  if (configPath) {
    resolvedPath = resolve(configPath);
  } else {
    // Search for default config files in current directory
    const cwd = process.cwd();
    for (const name of DEFAULT_CONFIG_NAMES) {
      const candidate = resolve(cwd, name);
      if (existsSync(candidate)) {
        resolvedPath = candidate;
        break;
      }
    }
  }

  if (!resolvedPath || !existsSync(resolvedPath)) {
    throw new Error(
      configPath
        ? `Config file not found: ${configPath}`
        : `No config file found. Expected one of: ${DEFAULT_CONFIG_NAMES.join(', ')}`
    );
  }

  // Handle different config formats
  if (resolvedPath.endsWith('.js')) {
    // For JS configs, we'd need dynamic import (async)
    // For now, only YAML is synchronous
    throw new Error(
      'JavaScript config files require async loading. Use loadConfigAsync() instead.'
    );
  }

  const content = readFileSync(resolvedPath, 'utf-8');
  const parsed = parseYaml(content);

  return normalizeConfig(parsed, dirname(resolvedPath));
}

/**
 * Normalize raw config into the expected structure.
 */
function normalizeConfig(raw: unknown, _baseDir: string): MadrigalConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Config must be an object');
  }

  const config = raw as Record<string, unknown>;

  // Validate required fields
  if (!config.sources || !Array.isArray(config.sources)) {
    throw new Error('Config must have a "sources" array');
  }

  return {
    sources: config.sources as string[],
    domains: (config.domains as Record<string, DomainConfig>) || {},
    kinds: (config.kinds as Record<string, KindConfig>) || {},
    brands: (config.brands as Record<string, BrandConfig>) || {},
    platforms: (config.platforms as Record<string, PlatformConfig>) || {},
  };
}

/**
 * Validate a Madrigal configuration.
 *
 * @param config - The configuration to validate
 * @param formatNames - Optional list of available format names for validation
 * @returns Validation result with errors and warnings
 */
export function validateConfig(
  config: MadrigalConfig,
  formatNames?: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate sources
  if (config.sources.length === 0) {
    errors.push({
      path: 'sources',
      message: 'At least one source pattern is required',
    });
  }

  // Validate domains
  for (const [name, domain] of Object.entries(config.domains)) {
    if (!domain.description) {
      warnings.push({
        path: `domains.${name}`,
        message: 'Domain is missing a description',
      });
    }
  }

  // Validate brands
  const brandNames = new Set(Object.keys(config.brands));
  brandNames.add('global'); // 'global' is always valid as an include target

  for (const [name, brand] of Object.entries(config.brands)) {
    if (brand.include) {
      for (const includeName of brand.include) {
        if (!brandNames.has(includeName) && includeName !== 'global') {
          errors.push({
            path: `brands.${name}.include`,
            message: `Referenced brand/group "${includeName}" does not exist`,
          });
        }
      }
    }
  }

  // Validate platforms
  for (const [name, platform] of Object.entries(config.platforms)) {
    if (!platform.format) {
      errors.push({
        path: `platforms.${name}`,
        message: 'Platform must specify a format',
      });
    } else if (formatNames && !formatNames.includes(platform.format)) {
      errors.push({
        path: `platforms.${name}.format`,
        message: `Unknown format "${platform.format}". Available: ${formatNames.join(', ')}`,
      });
    }

    if (
      platform.groupBy &&
      !['brand', 'domain', 'system'].includes(platform.groupBy)
    ) {
      errors.push({
        path: `platforms.${name}.groupBy`,
        message: `Invalid groupBy value "${platform.groupBy}". Must be "brand", "domain", or "system"`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get all domain names from the config.
 */
export function getDomainNames(config: MadrigalConfig): string[] {
  return Object.keys(config.domains);
}

/**
 * Get all brand names from the config.
 */
export function getBrandNames(config: MadrigalConfig): string[] {
  return Object.keys(config.brands);
}

/**
 * Get all kind names from the config.
 */
export function getKindNames(config: MadrigalConfig): string[] {
  return Object.keys(config.kinds);
}

/**
 * Get all platform names from the config.
 */
export function getPlatformNames(config: MadrigalConfig): string[] {
  return Object.keys(config.platforms);
}
