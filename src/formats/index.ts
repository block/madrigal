export { aiRulesMdFormat } from './ai-rules-md.js';
// Built-in formats
export { jsonBundleFormat } from './json-bundle.js';
export { meshDomainFormat } from './mesh-domain.js';
export type { Format, FormatOptions } from './registry.js';
export { defaultRegistry, FormatRegistry } from './registry.js';
export { skillMdFormat } from './skill-md.js';
export { topologyJsonFormat } from './topology-json.js';

import { aiRulesMdFormat } from './ai-rules-md.js';
import { jsonBundleFormat } from './json-bundle.js';
import { meshDomainFormat } from './mesh-domain.js';
// Register built-in formats
import { defaultRegistry } from './registry.js';
import { skillMdFormat } from './skill-md.js';
import { topologyJsonFormat } from './topology-json.js';

// Register all built-in formats in the default registry
defaultRegistry.register(jsonBundleFormat);
defaultRegistry.register(skillMdFormat);
defaultRegistry.register(meshDomainFormat);
defaultRegistry.register(aiRulesMdFormat);
defaultRegistry.register(topologyJsonFormat);
