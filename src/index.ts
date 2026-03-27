// Schema types
export type {
  Domain,
  KnowledgeUnit,
  KnowledgeFrontmatter,
  CreateKnowledgeUnit,
  UpdateKnowledgeUnit,
  KnowledgeUnitWithEmbedding,
  Brand,
  CreateBrand,
  BrandSeverityOverride,
  CreateBrandSeverityOverride,
} from './schema/index.js';

// Severity
export type { Severity } from './severity.js';
export {
  SEVERITY_ORDER,
  compareSeverity,
  isEnforceable,
  parseSeverity,
} from './severity.js';

// Provenance
export type {
  Provenance,
  ProvenanceOrigin,
  ProposalStatus,
} from './provenance.js';
export {
  createHumanProvenance,
  createSystemProposedProvenance,
  createExtractedProvenance,
  createFileProvenance,
} from './provenance.js';

// Config
export type {
  MadrigalConfig,
  DomainConfig,
  BrandConfig,
  PlatformConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './config.js';
export {
  loadConfig,
  validateConfig,
  getDomainNames,
  getBrandNames,
  getPlatformNames,
} from './config.js';

// Loader
export type {
  LoadOptions,
  LoadResult,
  LoadError,
  LoadWarning,
} from './loader.js';
export { loadKnowledge, loadKnowledgeSync } from './loader.js';

// Pipeline
export type {
  BuildOptions,
  BuildResult,
  PipelineResult,
} from './pipeline.js';
export { build, buildPlatformByName } from './pipeline.js';

// Resolver
export type {
  ResolveOptions,
  SeverityOverride,
  OverridesFile,
} from './resolver.js';
export {
  resolveForBrand,
  groupUnitsBy,
  filterByDomain,
  filterBySeverity,
  filterBySystem,
} from './resolver.js';

// Formats
export type { Format, FormatOptions } from './formats/index.js';
export { FormatRegistry, defaultRegistry } from './formats/index.js';
export { jsonBundleFormat } from './formats/json-bundle.js';
export { skillMdFormat } from './formats/skill-md.js';
export { meshDomainFormat } from './formats/mesh-domain.js';
export { aiRulesMdFormat } from './formats/ai-rules-md.js';

// Preprocessors
export type { Preprocessor } from './preprocessors/index.js';
export {
  PreprocessorRegistry,
  defaultPreprocessorRegistry,
} from './preprocessors/index.js';

// Propose (authoring assistant)
export type { LlmCompletionFn, ProposeOptions, ProposeResult } from './propose.js';
export { propose, parseProposedUnits, findRelated } from './propose.js';

// Adapters
export type {
  StorageAdapter,
  QueryFilter,
  SearchAdapter,
  RuleFilter,
  SemanticSearchOptions,
  ScoredKnowledgeUnit,
} from './adapters/index.js';

// Rules
export type { MatchResult, OverrideConfig } from './rules/index.js';

// Compliance
export type {
  ComplianceResult,
  ComplianceViolation,
  OutputFormat,
  ReportOptions,
} from './compliance/index.js';
