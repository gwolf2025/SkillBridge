import { describe, it, expect } from 'vitest';
import { plan } from './planner.js';
import type { Adapter, InstallPlan } from '../../adapter-sdk/src/index.js';

function makeAdapter(installPlan?: InstallPlan): Adapter {
  return {
    manifest: {
      name: 'test-adapter',
      version: '1.0.0',
      vendor: 'test',
      adapterVersion: '0.1.0',
      supports: { sourceFormats: ['markdown'], targetFormats: ['markdown'] },
      capabilities: ['install-plan'],
    },
    detect: () => true,
    parse: (s: unknown) => s,
    compile: (n: unknown) => n,
    installPlan: installPlan ? () => installPlan : undefined,
  };
}

describe('plan', () => {
  it('returns a resolved plan with default scope', () => {
    const adapter = makeAdapter({ steps: ['copy file'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scope).toBe('project');
      expect(result.value.steps).toContain('copy file');
      expect(result.value.destinationPaths).toHaveLength(1);
    }
  });

  it('accepts explicit scope option', () => {
    const adapter = makeAdapter({ steps: ['install'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx, { scope: 'user' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scope).toBe('user');
    }
  });

  it('accepts custom scope with path', () => {
    const adapter = makeAdapter({ steps: ['install'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx, { scope: 'custom', customPath: '/tmp/test-install' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scope).toBe('custom');
    }
  });

  it('fails on custom scope without path', () => {
    const adapter = makeAdapter({ steps: ['install'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx, { scope: 'custom' });
    expect(result.ok).toBe(false);
  });

  it('generates integrity manifest', () => {
    const adapter = makeAdapter({ steps: ['install'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.manifest).toBeDefined();
      expect(result.value.manifest!.files).toBeDefined();
    }
  });

  it('defaults overwrite policy to never', () => {
    const adapter = makeAdapter({ steps: ['install'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.overwritePolicy).toBe('never');
    }
  });

  it('preserves adapter plan fields', () => {
    const adapter = makeAdapter({ steps: ['a', 'b'], estimatedDuration: 10, requires: ['node'] });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.steps).toEqual(['a', 'b']);
      expect(result.value.estimatedDuration).toBe(10);
      expect(result.value.requires).toContain('node');
    }
  });

  it('adds permissions from adapter plan', () => {
    const adapter = makeAdapter({
      steps: ['install'],
      permissions: [{ resource: 'fs', actions: ['write'] }],
    });
    const ctx = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.permissions) {
      expect(result.value.permissions).toHaveLength(1);
      expect(result.value.permissions[0].resource).toBe('fs');
    }
  });
});
