import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { OutputManifest } from './manifest.js';
import { writeManifest, computeManifestChecksum } from './manifest.js';

function makeTestManifest(): OutputManifest {
  return {
    files: ['a.txt', 'b.txt'],
    checksums: {
      'a.txt': 'abc123',
      'b.txt': 'def456',
    },
    metadata: { version: 1 },
    compiledAt: '2026-01-01T00:00:00.000Z',
    compiledBy: 'test-adapter',
    source: 'test-source',
  };
}

describe('writeManifest', () => {
  it('writes a valid manifest.json file', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const outputDir = join(tmpDir, 'output');

    const manifest = makeTestManifest();
    const result = await writeManifest(manifest, { outputDir });

    expect(result.ok).toBe(true);
    expect(existsSync(join(outputDir, 'manifest.json'))).toBe(true);

    const written = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf-8'));
    expect(written.files).toEqual(['a.txt', 'b.txt']);
    expect(written.checksums['a.txt']).toBe('abc123');
    expect(written.checksums['b.txt']).toBe('def456');
    expect(written.source).toBe('test-source');
    expect(written.compiledBy).toBe('test-adapter');
  });

  it('serializes with canonical JSON (sorted keys)', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const outputDir = join(tmpDir, 'output');

    const manifest = makeTestManifest();
    await writeManifest(manifest, { outputDir });

    const content = readFileSync(join(outputDir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toEqual(manifest);

    const keys = Object.keys(JSON.parse(content));
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  it('includes all required fields', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const outputDir = join(tmpDir, 'output');

    const manifest = makeTestManifest();
    await writeManifest(manifest, { outputDir });

    const content = readFileSync(join(outputDir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('files');
    expect(parsed).toHaveProperty('checksums');
    expect(parsed).toHaveProperty('metadata');
    expect(parsed).toHaveProperty('compiledAt');
    expect(parsed).toHaveProperty('compiledBy');
    expect(parsed).toHaveProperty('source');
  });

  it('uses custom manifest filename when provided', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const outputDir = join(tmpDir, 'output');

    const manifest = makeTestManifest();
    const result = await writeManifest(manifest, { outputDir, manifestFileName: 'checksum.json' });

    expect(result.ok).toBe(true);
    expect(existsSync(join(outputDir, 'checksum.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'manifest.json'))).toBe(false);
  });
});

describe('computeManifestChecksum', () => {
  it('produces deterministic checksum for same manifest', () => {
    const manifest = makeTestManifest();
    const a = computeManifestChecksum(manifest);
    const b = computeManifestChecksum(manifest);
    expect(a).toBe(b);
  });

  it('produces different checksum for different manifests', () => {
    const manifestA = makeTestManifest();
    const manifestB = makeTestManifest();
    manifestB.source = 'different-source';
    const a = computeManifestChecksum(manifestA);
    const b = computeManifestChecksum(manifestB);
    expect(a).not.toBe(b);
  });
});
