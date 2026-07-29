import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { plan } from '../planner.js';
import { formatDryRun } from '../dryrun.js';
import { toPosixPath } from '../paths.js';
import type { Adapter, ConversionContext } from '../../../adapter-sdk/src/index.js';

function makeAdapter(overrides?: Partial<Adapter>): Adapter {
  return {
    manifest: {
      name: 'test-adapter',
      version: '1.0.0',
      vendor: 'test',
      adapterVersion: '0.1.0',
      supports: { sourceFormats: ['markdown'], targetFormats: ['markdown'] },
      capabilities: ['install-plan'],
      ...(overrides?.manifest ?? {}),
    },
    detect: () => true,
    parse: (s: unknown) => s,
    compile: (n: unknown) => n,
    installPlan: () => ({ steps: ['copy SKILL.md', 'register hooks'], estimatedDuration: 5 }),
    ...overrides,
  };
}

describe('installer integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-inst-int-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('full flow: plan with custom scope generates manifest and dry-run output', () => {
    const adapter = makeAdapter();
    const ctx: ConversionContext = { source: '', normalized: {}, manifest: adapter.manifest };
    const nonexistentDir = join(tmpDir, 'nonexistent-dir');
    const result = plan(adapter, ctx, { scope: 'custom', customPath: nonexistentDir });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.steps).toHaveLength(2);
      expect(result.value.destinationPaths).toHaveLength(1);
      expect(result.value.manifest).toBeDefined();

      const dryRunOutput = formatDryRun({ plan: result.value, adapterName: 'test-adapter' });
      expect(dryRunOutput).toContain('test-adapter');
      expect(dryRunOutput).toContain('copy SKILL.md');
      expect(dryRunOutput).toContain('Integrity Manifest');
    }
  });

  it('backup plan is empty when destination does not exist', () => {
    const adapter = makeAdapter();
    const ctx: ConversionContext = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx, {
      scope: 'custom',
      customPath: join(tmpDir, 'nonexistent-dir'),
      overwritePolicy: 'always',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.backupPlan).toBeUndefined();
    }
  });

  it('backup plan populated when destination has content', () => {
    const existingDir = join(tmpDir, 'existing-install');
    writeFileSync(join(tmpDir, 'existing-install'), 'existing content', 'utf-8');

    const adapter = makeAdapter({
      installPlan: () => ({ steps: ['overwrite file'] }),
    });
    const ctx: ConversionContext = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx, {
      scope: 'custom',
      customPath: existingDir,
      overwritePolicy: 'always',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.backupPlan).toBeDefined();
      expect(result.value.backupPlan!.length).toBeGreaterThanOrEqual(1);
      expect(result.value.backupPlan![0].sourcePath).toBe(toPosixPath(existingDir));
      expect(result.value.backupPlan![0].backupPath).toContain('.backup.');
    }
  });

  it('never policy blocks when conflicts exist', () => {
    const existingFile = join(tmpDir, 'conflicting-file');
    writeFileSync(existingFile, 'existing content', 'utf-8');

    const adapter = makeAdapter({
      installPlan: () => ({ steps: ['write conflicting file'] }),
    });
    const ctx: ConversionContext = { source: '', normalized: {}, manifest: adapter.manifest };
    const result = plan(adapter, ctx, {
      scope: 'custom',
      customPath: existingFile,
      overwritePolicy: 'never',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((d) => d.code === 'INSTALL-007')).toBe(true);
    }
  });

  it('dry-run output does not create files', () => {
    const dryDir = join(tmpDir, 'should-not-exist');
    const adapter = makeAdapter();
    const ctx: ConversionContext = { source: '', normalized: {}, manifest: adapter.manifest };

    const result = plan(adapter, ctx, {
      scope: 'custom',
      customPath: dryDir,
      overwritePolicy: 'always',
    });
    expect(result.ok).toBe(true);
    expect(existsSync(dryDir)).toBe(false);
  });
});
