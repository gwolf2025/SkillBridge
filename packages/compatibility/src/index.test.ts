import type { Capability, CapabilityRequirement } from '@skillbridge/ir';
import { describe, it, expect } from 'vitest';
import {
  compareCapabilities,
  assessSecurityImpact,
  analyzeCompatibility,
  generateCompatibilityReport,
  CompatibilityReportFormatter,
  type TargetProfile,
  type CompatibilityReport,
} from './index.js';

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

describe('analyzeCompatibility', () => {
  const simpleTarget: TargetProfile = {
    name: 'test-adapter',
    version: '1.0.0',
    vendor: 'test',
    capabilities: [
      { capability: 'file-read', level: 'native' },
      { capability: 'command-exec', level: 'native' },
      { capability: 'network-access', level: 'emulated', constraints: { hosts: '*.example.com' } },
    ],
  };

  it('returns native when all requirements match exactly', () => {
    const reqs: CapabilityRequirement[] = [
      { id: 'file-read', required: true },
      { id: 'command-exec', required: false },
    ];
    const result = analyzeCompatibility(reqs, simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(2);
    expect(result.value.comparisons.every((c) => c.level === 'native')).toBe(true);
    expect(result.value.nativeCount).toBe(2);
    expect(result.value.overall).toBe('native');
  });

  it('returns missing when capability is not in target', () => {
    const reqs: CapabilityRequirement[] = [
      { id: 'file-read', required: true },
      { id: 'search-web', required: true },
    ];
    const result = analyzeCompatibility(reqs, simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[1].level).toBe('missing');
    expect(result.value.comparisons[1].diagnostics?.[0].code).toBe('COMPAT-011');
    expect(result.value.missingCount).toBe(1);
    expect(result.value.overall).toBe('degraded');
  });

  it('returns emulated when capability is emulated by target', () => {
    const reqs: CapabilityRequirement[] = [
      { id: 'network-access', required: true, parameters: { hosts: 'api.example.com' } },
    ];
    const result = analyzeCompatibility(reqs, simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].level).toBe('emulated');
    expect(result.value.emulatedCount).toBe(1);
  });

  it('returns degraded when parameter exceeds constraint', () => {
    const reqs: CapabilityRequirement[] = [
      { id: 'network-access', required: true, parameters: { hosts: 'evil-site.com' } },
    ];
    const result = analyzeCompatibility(reqs, simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].level).toBe('degraded');
    expect(result.value.comparisons[0].diagnostics?.[0].code).toBe('COMPAT-008');
    expect(result.value.degradedCount).toBe(1);
  });

  it('returns all missing when nothing is supported', () => {
    const reqs: CapabilityRequirement[] = [
      { id: 'secrets', required: true },
      { id: 'mcp', required: false },
    ];
    const result = analyzeCompatibility(reqs, simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.missingCount).toBe(2);
    expect(result.value.overall).toBe('missing');
  });

  it('deduplicates repeated capability ids', () => {
    const reqs: CapabilityRequirement[] = [
      { id: 'file-read', required: true },
      { id: 'file-read', required: false },
    ];
    const result = analyzeCompatibility(reqs, simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(1);
  });

  it('returns native for empty requirements', () => {
    const result = analyzeCompatibility([], simpleTarget);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons).toHaveLength(0);
    expect(result.value.overall).toBe('native');
  });

  it('rejects non-array requirements', () => {
    const result = analyzeCompatibility(null as unknown as CapabilityRequirement[], simpleTarget);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
    }
  });

  it('rejects null target', () => {
    const result = analyzeCompatibility(
      [{ id: 'file-read', required: true }],
      null as unknown as TargetProfile,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
    }
  });

  it('handles wildcard pattern constraints', () => {
    const target: TargetProfile = {
      name: 'wildcard-adapter',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        { capability: 'http-get', level: 'native', constraints: { hosts: '*.example.com' } },
      ],
    };
    const reqs: CapabilityRequirement[] = [
      { id: 'http-get', required: true, parameters: { hosts: 'api.example.com' } },
    ];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].level).toBe('native');
  });

  it('passes through extension capabilities in target profile', () => {
    const target: TargetProfile = {
      name: 'ext-adapter',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [{ capability: 'file-read', level: 'native' }],
      extensions: { 'x-custom-feature': true },
    };
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nativeCount).toBe(1);
  });
});

describe('analyzeCompatibility — new levels: partial, unknown', () => {
  it('returns unknown when target level is unknown', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [{ capability: 'file-read', level: 'unknown' }],
    };
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].level).toBe('unknown');
    expect(result.value.unknownCount).toBe(1);
    expect(result.value.comparisons[0].diagnostics?.[0].code).toBe('COMPAT-012');
  });

  it('returns partial when target level is partial', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [{ capability: 'file-read', level: 'partial' }],
    };
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].level).toBe('partial');
    expect(result.value.partialCount).toBe(1);
  });

  it('computeOverallLevel never returns native when unknown present', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        { capability: 'file-read', level: 'unknown' },
        { capability: 'network-access', level: 'native' },
      ],
    };
    const reqs: CapabilityRequirement[] = [
      { id: 'file-read', required: true },
      { id: 'network-access', required: true },
    ];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.overall).toBe('degraded');
  });

  it('safeguard: unknown target level never produces native comparison', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [{ capability: 'file-read', level: 'unknown' }],
    };
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comparisons[0].level).toBe('unknown');
    expect(result.value.comparisons[0].level).not.toBe('native');
  });
});

describe('analyzeCompatibility — semantic degradation, missing resources, assumptions', () => {
  it('populates SemanticDegradation when target level is emulated', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        {
          capability: 'network-access',
          level: 'emulated',
          constraints: { hosts: '*.example.com' },
        },
      ],
    };
    const reqs: CapabilityRequirement[] = [
      { id: 'network-access', required: true, parameters: { hosts: 'api.example.com' } },
    ];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.semanticDegradations).toHaveLength(1);
    expect(result.value.semanticDegradations[0].capability).toBe('network-access');
    expect(result.value.semanticDegradations[0].impact).toBe('restricted');
  });

  it('populates MissingResource when parameter mismatch occurs', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        { capability: 'network-access', level: 'native', constraints: { hosts: '*.example.com' } },
      ],
    };
    const reqs: CapabilityRequirement[] = [
      { id: 'network-access', required: true, parameters: { hosts: 'evil-site.com' } },
    ];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.missingResources).toHaveLength(1);
    expect(result.value.missingResources[0].resource).toBe('hosts');
    expect(result.value.missingResources[0].requiredValue).toBe('evil-site.com');
    expect(result.value.missingResources[0].constraintValue).toBe('*.example.com');
  });

  it('populates Assumption for unconstrained parameters on constrained capability', () => {
    const target: TargetProfile = {
      name: 'test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        { capability: 'network-access', level: 'native', constraints: { hosts: '*.example.com' } },
      ],
    };
    const reqs: CapabilityRequirement[] = [{ id: 'network-access', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assumptions.length).toBeGreaterThanOrEqual(1);
    expect(result.value.assumptions[0].risk).toBe('low');
    expect(result.value.assumptions[0].assumption).toContain('defaults');
  });
});

describe('CompatibilityReportFormatter', () => {
  const mockReport: CompatibilityReport = {
    comparisons: [
      { capability: 'file-read', required: true, level: 'native' },
      { capability: 'network-access', required: true, level: 'emulated' },
    ],
    overall: 'emulated',
    nativeCount: 1,
    emulatedCount: 1,
    missingCount: 0,
    degradedCount: 0,
    partialCount: 0,
    unknownCount: 0,
    semanticDegradations: [
      {
        capability: 'network-access',
        originalBehavior: 'native network-access',
        emulatedBehavior: 'emulated network-access via target',
        impact: 'restricted',
        diagnostics: [],
      },
    ],
    missingResources: [],
    assumptions: [],
  };

  it('toJSON produces expected JSON structure', () => {
    const formatter = new CompatibilityReportFormatter();
    const json = formatter.toJSON(mockReport) as Record<string, unknown>;
    expect(json).toHaveProperty('overall', 'emulated');
    expect(json).toHaveProperty('counts');
    const counts = json.counts as Record<string, number>;
    expect(counts.native).toBe(1);
    expect(counts.emulated).toBe(1);
    expect(json).toHaveProperty('comparisons');
    expect(Array.isArray(json.comparisons)).toBe(true);
    expect(json).toHaveProperty('semanticDegradations');
    expect(json.semanticDegradations as unknown[]).toHaveLength(1);
  });

  it('toText produces non-empty multi-line string', () => {
    const formatter = new CompatibilityReportFormatter();
    const text = formatter.toText(mockReport);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('Compatibility Report');
    expect(text).toContain('file-read');
    expect(text).toContain('network-access');
    expect(text).toContain('Semantic Degradations');
  });

  it('toText includes security impact when present', () => {
    const reportWithSecurity: CompatibilityReport = {
      ...mockReport,
      securityImpact: {
        preservedPermissions: [{ resource: 'fs', actions: ['read'] }],
        weakenedPermissions: [],
        addedPermissions: [],
        removedPermissions: [{ resource: 'net', requiredActions: ['connect'] }],
        diagnostics: [],
      },
    };
    const formatter = new CompatibilityReportFormatter();
    const text = formatter.toText(reportWithSecurity);
    expect(text).toContain('Security Impact');
    expect(text).toContain('preserved');
    expect(text).toContain('removed');
  });
});

describe('generateCompatibilityReport', () => {
  const target: TargetProfile = {
    name: 'test',
    version: '1.0.0',
    vendor: 'test',
    capabilities: [{ capability: 'file-read', level: 'native' }],
  };

  it('produces report without permissions', () => {
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = generateCompatibilityReport(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nativeCount).toBe(1);
    expect(result.value.securityImpact).toBeUndefined();
  });

  it('produces integrated report with permissions', () => {
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const requiredPermissions = [{ resource: 'fs', actions: ['read'] }];
    const declaredPermissions = [{ resource: 'fs', actions: ['read'] }];
    const result = generateCompatibilityReport(
      reqs,
      target,
      requiredPermissions,
      declaredPermissions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nativeCount).toBe(1);
    expect(result.value.securityImpact).toBeDefined();
    expect(result.value.securityImpact!.preservedPermissions).toHaveLength(1);
  });
});

describe('regression tests — sb-repair fixes', () => {
  it('rejects target without capabilities array (MEDIUM-001)', () => {
    const target = {
      name: 'broken',
      version: '1.0.0',
      vendor: 'test',
    } as unknown as TargetProfile;
    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('COMPAT-005');
      expect(result.error[0].message).toContain('capabilities');
    }
  });

  it('preserves extensions on TargetCapabilitySupport (HIGH-001)', () => {
    const target: TargetProfile = {
      name: 'ext-test',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        {
          capability: 'file-read',
          level: 'native',
          extensions: { 'x-vendor-hint': 'fast-path' },
        },
      ],
    };
    expect(target.capabilities[0].extensions).toBeDefined();
    expect(target.capabilities[0].extensions!['x-vendor-hint']).toBe('fast-path');

    const reqs: CapabilityRequirement[] = [{ id: 'file-read', required: true }];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nativeCount).toBe(1);
  });

  it('emits COMPAT-013 for partial, COMPAT-012 for unknown (MEDIUM-002)', () => {
    const target: TargetProfile = {
      name: 'multi-level',
      version: '1.0.0',
      vendor: 'test',
      capabilities: [
        { capability: 'file-read', level: 'partial' },
        { capability: 'network-access', level: 'unknown' },
      ],
    };
    const reqs: CapabilityRequirement[] = [
      { id: 'file-read', required: true },
      { id: 'network-access', required: true },
    ];
    const result = analyzeCompatibility(reqs, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const partialDiags = result.value.comparisons.find(
      (c) => c.capability === 'file-read',
    )?.diagnostics;
    const unknownDiags = result.value.comparisons.find(
      (c) => c.capability === 'network-access',
    )?.diagnostics;
    expect(partialDiags?.some((d) => d.code === 'COMPAT-013')).toBe(true);
    expect(unknownDiags?.some((d) => d.code === 'COMPAT-012')).toBe(true);
  });
});
