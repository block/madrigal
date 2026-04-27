/**
 * @deprecated Use weight.ts instead.
 * This file is retained for backward compatibility.
 */
export type {
  DefaultWeight as Enforcement,
  Weight,
} from './weight.js';

export {
  compareWeight as compareEnforcement,
  DEFAULT_WEIGHT_LEVELS,
  isHighWeight as isEnforceable,
  parseWeight as parseEnforcement,
  WEIGHT_ORDER as ENFORCEMENT_ORDER,
} from './weight.js';
