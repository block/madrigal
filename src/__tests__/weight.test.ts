import { describe, expect, it } from 'vitest';
import { applyFieldMappings } from '../loader.js';
import {
  buildWeightOrder,
  compareWeight,
  DEFAULT_WEIGHT_LEVELS,
  defaultWeight,
  isHighWeight,
  parseWeight,
  WEIGHT_ORDER,
} from '../weight.js';

// --- parseWeight ---

describe('parseWeight', () => {
  it('accepts default level values', () => {
    expect(parseWeight('must')).toBe('must');
    expect(parseWeight('should')).toBe('should');
    expect(parseWeight('may')).toBe('may');
    expect(parseWeight('context')).toBe('context');
    expect(parseWeight('deprecated')).toBe('deprecated');
  });

  it('normalizes to lowercase', () => {
    expect(parseWeight('MUST')).toBe('must');
    expect(parseWeight('Should')).toBe('should');
  });

  it('maps legacy severity values', () => {
    expect(parseWeight('error')).toBe('must');
    expect(parseWeight('warning')).toBe('should');
    expect(parseWeight('info')).toBe('may');
  });

  it('returns null for unknown values', () => {
    expect(parseWeight('unknown')).toBeNull();
    expect(parseWeight('')).toBeNull();
  });

  it('accepts custom levels', () => {
    const levels = ['stable', 'beta', 'experimental', 'deprecated'];
    expect(parseWeight('stable', levels)).toBe('stable');
    expect(parseWeight('beta', levels)).toBe('beta');
    expect(parseWeight('unknown', levels)).toBeNull();
  });

  it('does not accept default levels when using custom levels without them', () => {
    const levels = ['stable', 'beta', 'experimental'];
    expect(parseWeight('must', levels)).toBeNull();
  });
});

// --- buildWeightOrder ---

describe('buildWeightOrder', () => {
  it('assigns index-based order (0 = highest)', () => {
    const order = buildWeightOrder([
      'stable',
      'beta',
      'experimental',
      'deprecated',
    ]);
    expect(order.stable).toBe(0);
    expect(order.beta).toBe(1);
    expect(order.experimental).toBe(2);
    expect(order.deprecated).toBe(3);
  });

  it('default WEIGHT_ORDER matches DEFAULT_WEIGHT_LEVELS', () => {
    for (let i = 0; i < DEFAULT_WEIGHT_LEVELS.length; i++) {
      expect(WEIGHT_ORDER[DEFAULT_WEIGHT_LEVELS[i]]).toBe(i);
    }
  });
});

// --- compareWeight ---

describe('compareWeight', () => {
  it('returns negative when a has higher weight than b', () => {
    expect(compareWeight('must', 'should')).toBeLessThan(0);
  });

  it('returns 0 for equal weights', () => {
    expect(compareWeight('may', 'may')).toBe(0);
  });

  it('sorts correctly with custom levels', () => {
    const order = buildWeightOrder(['stable', 'beta', 'experimental']);
    expect(compareWeight('stable', 'beta', order)).toBeLessThan(0);
    expect(compareWeight('experimental', 'stable', order)).toBeGreaterThan(0);
  });
});

// --- isHighWeight ---

describe('isHighWeight', () => {
  it('returns true for top-half levels', () => {
    // 5 levels: must(0), should(1) are in the top half (< ceil(5/2)=3)
    expect(isHighWeight('must')).toBe(true);
    expect(isHighWeight('should')).toBe(true);
  });

  it('returns false for bottom-half levels', () => {
    expect(isHighWeight('context')).toBe(false);
    expect(isHighWeight('deprecated')).toBe(false);
  });

  it('returns false for unknown values', () => {
    expect(isHighWeight('unknown')).toBe(false);
  });

  it('works with custom levels', () => {
    const levels = ['stable', 'beta', 'experimental', 'deprecated'];
    expect(isHighWeight('stable', levels)).toBe(true);
    expect(isHighWeight('beta', levels)).toBe(true);
    expect(isHighWeight('experimental', levels)).toBe(false);
    expect(isHighWeight('deprecated', levels)).toBe(false);
  });
});

// --- defaultWeight ---

describe('defaultWeight', () => {
  it('returns "may" for default levels', () => {
    expect(defaultWeight()).toBe('may');
  });

  it('returns "may" if present in custom levels', () => {
    expect(defaultWeight(['required', 'may', 'deprecated'])).toBe('may');
  });

  it('returns last level when "may" is absent', () => {
    expect(defaultWeight(['stable', 'beta', 'experimental'])).toBe(
      'experimental',
    );
  });
});

// --- applyFieldMappings ---

describe('applyFieldMappings', () => {
  it('simple rename: copies source field to target', () => {
    const raw: Record<string, unknown> = { key: 'unit-1', title: 'My Rule' };
    applyFieldMappings(raw, { id: 'key' });
    expect(raw.id).toBe('unit-1');
  });

  it('simple rename: does not overwrite if target already set', () => {
    const raw = { id: 'existing', key: 'from-mapping' };
    applyFieldMappings(raw as Record<string, unknown>, { id: 'key' });
    expect(raw.id).toBe('existing');
  });

  it('simple rename: ignores mapping if source field absent', () => {
    const raw: Record<string, unknown> = { title: 'Test' };
    applyFieldMappings(raw, { id: 'key' });
    expect(raw.id).toBeUndefined();
  });

  it('complex mapping: renames and translates values', () => {
    const raw: Record<string, unknown> = { status: 'active' };
    applyFieldMappings(raw, {
      weight: {
        from: 'status',
        values: { active: 'must', draft: 'context', deprecated: 'deprecated' },
      },
    });
    expect(raw.weight).toBe('must');
  });

  it('complex mapping: passes through value when no values map provided', () => {
    const raw: Record<string, unknown> = { maturity: 'stable' };
    applyFieldMappings(raw, { weight: { from: 'maturity' } });
    expect(raw.weight).toBe('stable');
  });

  it('complex mapping: passes through unknown value if not in values map', () => {
    const raw: Record<string, unknown> = { status: 'unknown-value' };
    applyFieldMappings(raw, {
      weight: { from: 'status', values: { active: 'must' } },
    });
    expect(raw.weight).toBe('unknown-value');
  });

  it('applies multiple mappings', () => {
    const raw: Record<string, unknown> = {
      key: 'abc',
      category: 'content',
      status: 'active',
    };
    applyFieldMappings(raw, {
      id: 'key',
      domain: 'category',
      weight: { from: 'status', values: { active: 'must' } },
    });
    expect(raw.id).toBe('abc');
    expect(raw.domain).toBe('content');
    expect(raw.weight).toBe('must');
  });
});
