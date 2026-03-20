export type { Format, FormatOptions } from './registry.js';
export { FormatRegistry, defaultRegistry } from './registry.js';

// Built-in formats
export { jsonBundleFormat } from './json-bundle.js';
export { skillMdFormat } from './skill-md.js';
export { meshDomainFormat } from './mesh-domain.js';
export { aiRulesMdFormat } from './ai-rules-md.js';

// Register built-in formats
import { defaultRegistry } from './registry.js';
import { jsonBundleFormat } from './json-bundle.js';
import { skillMdFormat } from './skill-md.js';
import { meshDomainFormat } from './mesh-domain.js';
import { aiRulesMdFormat } from './ai-rules-md.js';

// Register all built-in formats in the default registry
defaultRegistry.register(jsonBundleFormat);
defaultRegistry.register(skillMdFormat);
defaultRegistry.register(meshDomainFormat);
defaultRegistry.register(aiRulesMdFormat);
