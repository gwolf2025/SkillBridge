import type { Capability } from '../../ir/src/index.js';
import { describe, it, expect } from 'vitest';
import { compareCapabilities, assessSecurityImpact } from './index.js';

describe('compareCapabilities', () => {
  it('returns all native when all required capabilities are declared', () => {
    const result = compareCapabilities(
      ['file-read', 'command-exec'],
      ['command-exec', 'file-read'],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(2);
    expect(result.value.comparisons.every((c) => c.level === 'native')).toBe(true);
    expect(result.value.nativeCount).toBe(2);
    expect(result.value.missingCount).toBe(0);
    expect(result.value.overall).toBe('native');
  });

  it('returns missing for capabilities not in declared', () => {
    const result = compareCapabilities(['file-read', 'network-access'], ['file-read']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(2);
    expect(result.value.comparisons[0].level).toBe('native');
    expect(result.value.comparisons[1].level).toBe('missing');
    expect(result.value.nativeCount).toBe(1);
    expect(result.value.missingCount).toBe(1);
    expect(result.value.overall).toBe('degraded');
  });

  it('returns overall missing when no capabilities match', () => {
    const result = compareCapabilities(['file-read', 'command-exec'], ['search-web']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.missingCount).toBe(2);
    expect(result.value.overall).toBe('missing');
  });

  it('returns empty comparisons for empty required array', () => {
    const result = compareCapabilities([], ['file-read']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(0);
    expect(result.value.nativeCount).toBe(0);
    expect(result.value.missingCount).toBe(0);
    expect(result.value.overall).toBe('native');
  });

  it('handles duplicate capabilities in required', () => {
    const result = compareCapabilities(['file-read', 'file-read', 'command-exec'], ['file-read']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(2);
    expect(result.value.comparisons[0].level).toBe('native');
    expect(result.value.comparisons[1].level).toBe('missing');
  });

  it('produces diagnostics for missing capabilities', () => {
    const result = compareCapabilities(['network-access'], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].diagnostics).toBeDefined();
    expect(result.value.comparisons[0].diagnostics![0].code).toBe('COMPAT-001');
  });

  it('rejects non-array required', () => {
    const result = compareCapabilities(null as unknown as Capability[], []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
    }
  });

  it('rejects non-array declared', () => {
    const result = compareCapabilities(
      ['file-read'] as Capability[],
      null as unknown as Capability[],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
    }
  });

  it('ignores declared capabilities not in required', () => {
    const result = compareCapabilities(['file-read'], ['file-read', 'command-exec', 'search-web']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(1);
    expect(result.value.comparisons[0].capability).toBe('file-read');
    expect(result.value.nativeCount).toBe(1);
  });

  it('sets required field to true for all comparisons', () => {
    const result = compareCapabilities(['file-read'], ['file-read']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].required).toBe(true);
  });
});

describe('assessSecurityImpact', () => {
  it('reports preserved when permissions are identical', () => {
    const perms = [
      { resource: 'fs', actions: ['read', 'write'] },
      { resource: 'net', actions: ['connect'] },
    ];
    const result = assessSecurityImpact(perms, perms);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(2);
    expect(result.value.weakenedPermissions).toHaveLength(0);
    expect(result.value.addedPermissions).toHaveLength(0);
    expect(result.value.removedPermissions).toHaveLength(0);
  });

  it('reports weakened when declared actions are a subset', () => {
    const required = [{ resource: 'fs', actions: ['read', 'write', 'execute'] }];
    const declared = [{ resource: 'fs', actions: ['read'] }];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(0);
    expect(result.value.weakenedPermissions).toHaveLength(1);
    expect(result.value.weakenedPermissions[0].missingActions).toEqual(['write', 'execute']);
    expect(result.value.weakenedPermissions[0].resource).toBe('fs');
  });

  it('reports added when declared has extra resources', () => {
    const required = [{ resource: 'fs', actions: ['read'] }];
    const declared = [
      { resource: 'fs', actions: ['read'] },
      { resource: 'db', actions: ['query'] },
    ];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.addedPermissions).toHaveLength(1);
    expect(result.value.addedPermissions[0].resource).toBe('db');
  });

  it('reports removed when required resource is not declared', () => {
    const required = [{ resource: 'fs', actions: ['read'] }];
    const declared: { resource: string; actions: string[] }[] = [];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.removedPermissions).toHaveLength(1);
    expect(result.value.removedPermissions[0].resource).toBe('fs');
    expect(result.value.removedPermissions[0].requiredActions).toEqual(['read']);
  });

  it('reports added and removed simultaneously', () => {
    const required = [{ resource: 'fs', actions: ['read'] }];
    const declared = [{ resource: 'db', actions: ['query'] }];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.removedPermissions).toHaveLength(1);
    expect(result.value.addedPermissions).toHaveLength(1);
    expect(result.value.preservedPermissions).toHaveLength(0);
  });

  it('handles wildcard in declared actions', () => {
    const required = [{ resource: 'fs', actions: ['read', 'write'] }];
    const declared = [{ resource: 'fs', actions: ['*'] }];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(1);
    expect(result.value.preservedPermissions[0].actions).toEqual(['*']);
    expect(result.value.weakenedPermissions).toHaveLength(0);
  });

  it('handles wildcard in required actions', () => {
    const required = [{ resource: 'fs', actions: ['*'] }];
    const declared = [{ resource: 'fs', actions: ['read', 'write'] }];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(1);
    expect(result.value.weakenedPermissions).toHaveLength(0);
  });

  it('reports weakened when wildcard required but declared empty', () => {
    const required = [{ resource: 'fs', actions: ['*'] }];
    const declared = [{ resource: 'fs', actions: [] }];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(0);
    expect(result.value.weakenedPermissions).toHaveLength(1);
  });

  it('returns empty report for empty arrays', () => {
    const result = assessSecurityImpact([], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(0);
    expect(result.value.weakenedPermissions).toHaveLength(0);
    expect(result.value.addedPermissions).toHaveLength(0);
    expect(result.value.removedPermissions).toHaveLength(0);
    expect(result.value.diagnostics).toHaveLength(0);
  });

  it('rejects non-array requiredPermissions', () => {
    const result = assessSecurityImpact(
      null as unknown as { resource: string; actions: string[] }[],
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
    }
  });

  it('rejects non-array declaredPermissions', () => {
    const result = assessSecurityImpact(
      [],
      null as unknown as { resource: string; actions: string[] }[],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
    }
  });

  it('produces info diagnostic for extra declared actions on preserved permission', () => {
    const required = [{ resource: 'fs', actions: ['read'] }];
    const declared = [{ resource: 'fs', actions: ['read', 'write'] }];
    const result = assessSecurityImpact(required, declared);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preservedPermissions).toHaveLength(1);
    expect(result.value.diagnostics.some((d) => d.code === 'COMPAT-006')).toBe(true);
  });
});
