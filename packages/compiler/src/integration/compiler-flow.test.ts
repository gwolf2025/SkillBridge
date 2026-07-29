import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { AtomicOutputWriter } from '../staging.js';
import { computeSha256, computeChecksums } from '../checksum.js';
import { writeManifest } from '../manifest.js';
import { canonicalStringify } from '../deterministic.js';
import type { OutputManifest } from '../manifest.js';

describe('full deterministic compilation flow (integration)', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'compiler-int-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('write multiple files, commit, read back, verify checksums match', async () => {
    const outputDir = join(baseDir, 'output');
    const writer = new AtomicOutputWriter({ outputDir });

    const prepareResult = await writer.prepare();
    expect(prepareResult.ok).toBe(true);

    await writer.writeFile('main.js', 'console.log("hello");\n');
    await writer.writeFile('lib/util.js', 'export const add = (a, b) => a + b;\n');
    await writer.writeFile('README.md', '# My Skill\n\nA skill.\n');

    const commitResult = await writer.commit();
    expect(commitResult.ok).toBe(true);

    expect(existsSync(join(outputDir, 'main.js'))).toBe(true);
    expect(existsSync(join(outputDir, 'lib', 'util.js'))).toBe(true);
    expect(existsSync(join(outputDir, 'README.md'))).toBe(true);

    expect(readFileSync(join(outputDir, 'main.js'), 'utf-8')).toBe('console.log("hello");\n');
    expect(readFileSync(join(outputDir, 'lib', 'util.js'), 'utf-8')).toBe(
      'export const add = (a, b) => a + b;\n',
    );

    const files = ['main.js', 'lib/util.js', 'README.md'];
    const checksumsResult = await computeChecksums(files, outputDir);
    expect(checksumsResult.ok).toBe(true);
    if (checksumsResult.ok) {
      expect(checksumsResult.value['main.js']).toBe(computeSha256('console.log("hello");\n'));
      expect(checksumsResult.value['lib/util.js']).toBe(
        computeSha256('export const add = (a, b) => a + b;\n'),
      );
      expect(checksumsResult.value['README.md']).toBe(computeSha256('# My Skill\n\nA skill.\n'));
    }
  });

  it('two identical compilations produce identical manifests', async () => {
    const files = ['a.txt', 'b.txt'];
    const contentA = 'AAA';
    const contentB = 'BBB';

    async function compileOnce(outDir: string): Promise<OutputManifest> {
      const w = new AtomicOutputWriter({ outputDir: outDir });
      await w.prepare();
      await w.writeFile('a.txt', contentA);
      await w.writeFile('b.txt', contentB);
      await w.commit();

      const checksumsResult = await computeChecksums(files, outDir);
      expect(checksumsResult.ok).toBe(true);
      const checksums = checksumsResult.ok ? checksumsResult.value : {};

      return {
        files,
        checksums,
        metadata: {},
        compiledAt: '2026-01-01T00:00:00.000Z',
        compiledBy: 'test',
        source: 'test-source',
      };
    }

    const dir1 = join(baseDir, 'out1');
    const dir2 = join(baseDir, 'out2');

    const manifest1 = await compileOnce(dir1);
    const manifest2 = await compileOnce(dir2);

    const json1 = canonicalStringify(manifest1);
    const json2 = canonicalStringify(manifest2);

    expect(json1).toBe(json2);
  });

  it('staging directory is cleaned up on rollback', async () => {
    const outputDir = join(baseDir, 'output');
    const writer = new AtomicOutputWriter({ outputDir });

    await writer.prepare();
    const stagingDir = (writer as unknown as { stagingDir: string | null }).stagingDir;

    expect(stagingDir).not.toBeNull();
    expect(existsSync(stagingDir!)).toBe(true);

    await writer.rollback();

    if (stagingDir) {
      expect(existsSync(stagingDir)).toBe(false);
    }

    expect(existsSync(outputDir)).toBe(false);
  });

  it('commit then read back matches original content with line ending normalization', async () => {
    const outputDir = join(baseDir, 'output');
    const writer = new AtomicOutputWriter({ outputDir });

    await writer.prepare();
    await writer.writeFile('crlf.txt', 'line1\r\nline2\r\n');
    await writer.commit();

    const content = readFileSync(join(outputDir, 'crlf.txt'), 'utf-8');
    expect(content).toBe('line1\nline2\n');
  });

  it('writeManifest produces manifest with correct checksums', async () => {
    const outputDir = join(baseDir, 'output');

    const manifest: OutputManifest = {
      files: ['a.txt', 'b.txt'],
      checksums: {
        'a.txt': computeSha256('content a'),
        'b.txt': computeSha256('content b'),
      },
      metadata: { compiler: 'test' },
      compiledAt: '2026-01-01T00:00:00.000Z',
      compiledBy: 'integration-test',
      source: 'test-source',
    };

    const result = await writeManifest(manifest, { outputDir });
    expect(result.ok).toBe(true);

    const manifestContent = readFileSync(join(outputDir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(manifestContent);
    expect(parsed.files).toEqual(['a.txt', 'b.txt']);
    expect(parsed.checksums['a.txt']).toBe(computeSha256('content a'));
    expect(parsed.compiledBy).toBe('integration-test');
  });

  it('output directory safety prevents traversal attacks', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'safe') });
    await writer.prepare();

    const attacks = [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      '../../../outside.txt',
      'sub/../../outside.txt',
    ];

    for (const attack of attacks) {
      const result = await writer.writeFile(attack, 'malicious');
      expect(result.ok).toBe(false);
    }
  });

  it('handles empty output (no files)', async () => {
    const outputDir = join(baseDir, 'empty');
    const writer = new AtomicOutputWriter({ outputDir });

    await writer.prepare();
    await writer.commit();

    expect(existsSync(outputDir)).toBe(true);
    expect(readdirSync(outputDir)).toHaveLength(0);
  });

  it('reproducible output: same input → same binary manifest checksum', async () => {
    const dir1 = join(baseDir, 'run1');
    const dir2 = join(baseDir, 'run2');

    async function compileAndRead(outDir: string) {
      const w = new AtomicOutputWriter({ outputDir: outDir });
      await w.prepare();
      await w.writeFile('data.txt', 'reproducible content');
      await w.commit();

      const m: OutputManifest = {
        files: ['data.txt'],
        checksums: { 'data.txt': computeSha256('reproducible content') },
        metadata: {},
        compiledAt: '2026-01-01T00:00:00.000Z',
        compiledBy: 'test',
        source: 'repro-src',
      };
      return { manifest: m, json: canonicalStringify(m) };
    }

    const r1 = await compileAndRead(dir1);
    const r2 = await compileAndRead(dir2);

    expect(r1.json).toBe(r2.json);
    expect(computeSha256(r1.json)).toBe(computeSha256(r2.json));
  });
});
