// Schema types

// Adapters
export type {
  QueryFilter,
  RuleFilter,
  ScoredKnowledgeUnit,
  SearchAdapter,
  SemanticSearchOptions,
  StorageAdapter,
} from './adapters/index.js';
export { type CheckOptions, checkCompliance } from './compliance/checker.js';
// Compliance
export type {
  ComplianceResult,
  ComplianceViolation,
  OutputFormat,
  ReportOptions,
} from './compliance/index.js';
export { formatReport } from './compliance/report.js';
// Config
export type {
  BrandConfig,
  DomainConfig,
  KindConfig,
  MadrigalConfig,
  PlatformConfig,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './config.js';
export {
  getBrandNames,
  getDomainNames,
  getKindNames,
  getPlatformNames,
  loadConfig,
  validateConfig,
} from './config.js';
// Enforcement
export type { Enforcement } from './enforcement.js';
export {
  compareEnforcement,
  ENFORCEMENT_ORDER,
  isEnforceable,
  parseEnforcement,
} from './enforcement.js';
// Eval
export {
  type EvalResult,
  type EvalSummary,
  evaluatePrompt,
  type GoldenPrompt,
  loadGoldenPrompts,
  runEval,
} from './eval/index.js';
export { aiRulesMdFormat } from './formats/ai-rules-md.js';
// Formats
export type { Format, FormatOptions } from './formats/index.js';
export { defaultRegistry, FormatRegistry } from './formats/index.js';
export { jsonBundleFormat } from './formats/json-bundle.js';
export { meshDomainFormat } from './formats/mesh-domain.js';
export { skillMdFormat } from './formats/skill-md.js';
// Loader
export type {
  LoadError,
  LoadOptions,
  LoadResult,
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

// Preprocessors
export type { Preprocessor } from './preprocessors/index.js';
export {
  defaultPreprocessorRegistry,
  PreprocessorRegistry,
} from './preprocessors/index.js';

// Propose (authoring assistant)
export type {
  LlmCompletionFn,
  ProposeOptions,
  ProposeResult,
} from './propose.js';
export { findRelated, parseProposedUnits, propose } from './propose.js';
// Provenance
export type {
  ProposalStatus,
  Provenance,
  ProvenanceOrigin,
} from './provenance.js';
export {
  createExtractedProvenance,
  createFileProvenance,
  createHumanProvenance,
  createSystemProposedProvenance,
} from './provenance.js';
// Resolver
export type {
  EnforcementOverride,
  OverridesFile,
  ResolveOptions,
} from './resolver.js';
export {
  filterByAttributes,
  filterByDomain,
  filterByEnforcement,
  filterBySystem,
  groupUnitsBy,
  resolveForBrand,
  resolveUnits,
} from './resolver.js';

// Rules
export type { MatchResult, OverrideConfig } from './rules/index.js';
export type {
  Brand,
  BrandEnforcementOverride,
  CreateBrand,
  CreateBrandEnforcementOverride,
  CreateKnowledgeUnit,
  Domain,
  KnowledgeFrontmatter,
  KnowledgeUnit,
  KnowledgeUnitWithEmbedding,
  UpdateKnowledgeUnit,
} from './schema/index.js';
// Search (BM25 implementation)
export {
  BM25Index,
  type BM25Options,
  BM25SearchAdapter,
  tokenize,
} from './search/index.js';
// Serve (MCP server)
export { type ServeOptions, serveMcp } from './serve/index.js';
