import { describe, it, expect } from 'vitest';
import { categorizePermission, summarizePermissions, inspectPermissions } from './inspection.js';
import type { PermissionCategory, PolicyHook, Permission } from './index.js';
import type { NormalizedSkill, Provenance } from '../../ir/src/index.js';

describe('categorizePermission', () => {
  const cases: Array<{ resource: string; expected: PermissionCategory }> = [
    { resource: 'fs:read', expected: 'filesystem' },
    { resource: 'fs:write/tmp', expected: 'filesystem' },
    { resource: 'bash:*', expected: 'shell' },
    { resource: 'Bash:git', expected: 'shell' },
    { resource: 'network:http', expected: 'network' },
    { resource: 'https://api.example.com', expected: 'network' },
    { resource: 'net:outbound', expected: 'network' },
    { resource: 'secret:api-key', expected: 'secrets' },
    { resource: 'script:deploy', expected: 'script' },
    { resource: 'subprocess:node', expected: 'subprocess' },
    { resource: 'process-spawn', expected: 'subprocess' },
    { resource: 'spawn:bash', expected: 'subprocess' },
    { resource: 'tool:eslint', expected: 'external-tool' },
    { resource: 'mcp:server', expected: 'mcp' },
    { resource: 'model:gpt-4', expected: 'model' },
    { resource: 'unknown:xyz', expected: 'other' },
    { resource: '', expected: 'other' },
  ];

  for (const { resource, expected } of cases) {
    it(`maps '${resource}' to '${expected}'`, () => {
      expect(categorizePermission({ resource, actions: ['read'] })).toBe(expected);
    });
  }
});

describe('summarizePermissions', () => {
  it('returns zero counts for empty array', () => {
    const result = summarizePermissions([]);
    expect(result.total).toBe(0);
    for (const cat of Object.values(result.categories)) {
      expect(cat.count).toBe(0);
    }
  });

  it('correctly categorizes a mix of permissions', () => {
    const permissions: Permission[] = [
      { resource: 'fs:read', actions: ['read'] },
      { resource: 'fs:write', actions: ['write'] },
      { resource: 'bash:*', actions: ['execute'] },
      { resource: 'secret:token', actions: ['read'] },
    ];
    const result = summarizePermissions(permissions);
    expect(result.total).toBe(4);
    expect(result.categories.filesystem.count).toBe(2);
    expect(result.categories.shell.count).toBe(1);
    expect(result.categories.secrets.count).toBe(1);
  });
});

describe('inspectPermissions', () => {
  const baseSource: NormalizedSkill = {
    irVersion: '0.1.0',
    identity: { name: 'test', version: '1.0.0' },
    capabilities: [],
    permissions: [],
    source: { format: 'markdown' },
  };

  it('detects preserved permissions when source and compiled match', () => {
    const perms: Permission[] = [{ resource: 'fs:read', actions: ['read'] }];
    const source = { ...baseSource, permissions: perms };
    const compiled = { ...baseSource, permissions: perms };
    const report = inspectPermissions(source, compiled);
    expect(report.comparisons.some((c) => c.kind === 'preserved')).toBe(true);
  });

  it('detects weakened permissions when compiled has fewer actions', () => {
    const source = {
      ...baseSource,
      permissions: [{ resource: 'fs:read', actions: ['read', 'write'] }],
    };
    const compiled = { ...baseSource, permissions: [{ resource: 'fs:read', actions: ['read'] }] };
    const report = inspectPermissions(source, compiled);
    expect(report.comparisons.some((c) => c.kind === 'weakened')).toBe(true);
  });

  it('detects expanded permissions when compiled has more actions', () => {
    const source = { ...baseSource, permissions: [{ resource: 'fs:read', actions: ['read'] }] };
    const compiled = {
      ...baseSource,
      permissions: [{ resource: 'fs:read', actions: ['read', 'write'] }],
    };
    const report = inspectPermissions(source, compiled);
    expect(report.comparisons.some((c) => c.kind === 'expanded')).toBe(true);
  });

  it('detects new permissions present only in compiled', () => {
    const source = { ...baseSource, permissions: [{ resource: 'fs:read', actions: ['read'] }] };
    const compiled = {
      ...baseSource,
      permissions: [
        { resource: 'fs:read', actions: ['read'] },
        { resource: 'bash:*', actions: ['execute'] },
      ],
    };
    const report = inspectPermissions(source, compiled);
    expect(report.comparisons.some((c) => c.kind === 'new')).toBe(true);
  });

  it('detects removed permissions present only in source', () => {
    const source = {
      ...baseSource,
      permissions: [
        { resource: 'fs:read', actions: ['read'] },
        { resource: 'bash:*', actions: ['execute'] },
      ],
    };
    const compiled = { ...baseSource, permissions: [{ resource: 'fs:read', actions: ['read'] }] };
    const report = inspectPermissions(source, compiled);
    expect(report.comparisons.some((c) => c.kind === 'removed')).toBe(true);
  });

  it('preserves provenance from both source and compiled skills', () => {
    const sourceProv = { convertedAt: '2024-01-01', convertedBy: 'adapter-claude' };
    const compiledProv = { convertedAt: '2024-01-02', convertedBy: 'adapter-codex' };
    const source = { ...baseSource, provenance: sourceProv as Provenance, permissions: [] };
    const compiled = { ...baseSource, provenance: compiledProv as Provenance, permissions: [] };
    const report = inspectPermissions(source, compiled);
    expect(report.provenance.source).toEqual(sourceProv);
    expect(report.provenance.compiled).toEqual(compiledProv);
  });

  it('executes PolicyHook and collects decisions', () => {
    const hook: PolicyHook = () => ({ allowed: true, reasons: ['hook approved'], diagnostics: [] });
    const report = inspectPermissions(baseSource, baseSource, [hook]);
    expect(report.policyDecisions).toHaveLength(1);
    expect(report.policyDecisions[0].allowed).toBe(true);
  });

  it('executes multiple PolicyHooks and collects all decisions', () => {
    const hook1: PolicyHook = () => ({ allowed: true, reasons: ['ok'], diagnostics: [] });
    const hook2: PolicyHook = () => ({ allowed: false, reasons: ['denied'], diagnostics: [] });
    const report = inspectPermissions(baseSource, baseSource, [hook1, hook2]);
    expect(report.policyDecisions).toHaveLength(2);
    expect(report.policyDecisions[0].allowed).toBe(true);
    expect(report.policyDecisions[1].allowed).toBe(false);
  });

  it('toText() contains the safety disclaimer', () => {
    const report = inspectPermissions(baseSource, baseSource);
    const text = report.toText();
    expect(text).toContain('does not prove a skill is safe');
  });

  it('toJSON() has disclaimer field', () => {
    const report = inspectPermissions(baseSource, baseSource);
    const json = report.toJSON();
    expect(json.disclaimer).toBe('Static inspection does not prove a skill is safe');
  });

  it('toJSON() contains source and compiled summary data', () => {
    const source = { ...baseSource, permissions: [{ resource: 'fs:read', actions: ['read'] }] };
    const compiled = { ...baseSource, permissions: [{ resource: 'bash:*', actions: ['execute'] }] };
    const report = inspectPermissions(source, compiled);
    const json = report.toJSON();
    expect(json.sourceSummary).toBeDefined();
    expect(json.compiledSummary).toBeDefined();
    expect((json.sourceSummary as Record<string, unknown>).total).toBe(1);
    expect((json.compiledSummary as Record<string, unknown>).total).toBe(1);
  });

  it('toText() contains category names from the summary', () => {
    const source = { ...baseSource, permissions: [{ resource: 'fs:read', actions: ['read'] }] };
    const report = inspectPermissions(source, baseSource);
    const text = report.toText();
    expect(text).toContain('filesystem');
    expect(text).toContain('Source');
    expect(text).toContain('Compiled');
  });
});
