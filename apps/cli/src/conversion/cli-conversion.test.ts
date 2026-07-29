import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../cli.js';

const VALID_SKILL = '---\nname: test-skill\ndescription: A test skill.\n---\n\nBody content.';

describe('CLI conversion end-to-end', () => {
  let tmpDir: string;
  let fixtureFile: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-conv-e2e-'));
    fixtureFile = join(tmpDir, 'test-skill.md');
    writeFileSync(fixtureFile, VALID_SKILL, 'utf-8');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('convert writes output to --output-dir', async () => {
    const outDir = join(tmpDir, 'out-1');
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--output-dir',
      outDir,
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Output written to');
    expect(existsSync(join(outDir, 'output'))).toBe(true);
    const content = readFileSync(join(outDir, 'output'), 'utf-8');
    expect(content).toContain('name: test-skill');
  });

  it('convert --dry-run previews without writing files', async () => {
    const outDir = join(tmpDir, 'out-dry');
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--output-dir',
      outDir,
      '--dry-run',
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Dry-run');
    expect(result.output).toContain('test-skill');
    expect(existsSync(join(outDir, 'output'))).toBe(false);
  });

  it('convert --output-dir fails with exit 1 if directory exists without --overwrite', async () => {
    const outDir = join(tmpDir, 'out-exists');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'dummy'), '', 'utf-8');
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--output-dir',
      outDir,
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('already exists');
  });

  it('convert --output-dir succeeds with --overwrite when directory exists', async () => {
    const outDir = join(tmpDir, 'out-overwrite');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'dummy'), 'old', 'utf-8');
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--output-dir',
      outDir,
      '--overwrite',
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Output written to');
    expect(existsSync(join(outDir, 'output'))).toBe(true);
    const content = readFileSync(join(outDir, 'output'), 'utf-8');
    expect(content).toContain('test-skill');
  });

  it('convert --json includes compatibility and provenance', async () => {
    const result = await run([
      'node',
      'skillbridge',
      '--json',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(parsed.value.compatibility).toBeDefined();
    expect(parsed.value.provenance).toBeDefined();
    expect(parsed.value.provenance.sourceFormat).toBe('markdown');
    expect(parsed.value.provenance.targetFormat).toBe('markdown');
  });

  it('convert --policy safe succeeds (default)', async () => {
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--policy',
      'safe',
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
  });

  it('compile command reads directory and compiles', async () => {
    const pkgDir = join(tmpDir, 'my-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, 'SKILL.md'), VALID_SKILL, 'utf-8');
    const outDir = join(tmpDir, 'compile-out');
    const result = await run([
      'node',
      'skillbridge',
      'compile',
      '--to',
      'markdown',
      '--output-dir',
      outDir,
      pkgDir,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Output written to');
    expect(existsSync(join(outDir, 'output'))).toBe(true);
  });

  it('compile fails on directory without SKILL.md', async () => {
    const emptyDir = join(tmpDir, 'empty-pkg');
    mkdirSync(emptyDir, { recursive: true });
    const result = await run(['node', 'skillbridge', 'compile', emptyDir]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing SKILL.md');
  });

  it('convert with --source-adapter works', async () => {
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--source-adapter',
      'adapter-portable',
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
  });

  it('convert with invalid --source-adapter fails', async () => {
    const result = await run([
      'node',
      'skillbridge',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--source-adapter',
      'nonexistent',
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(1);
  });

  it('convert --json with --output-dir includes compat and provenance', async () => {
    const outDir = join(tmpDir, 'out-json');
    const result = await run([
      'node',
      'skillbridge',
      '--json',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '--output-dir',
      outDir,
      fixtureFile,
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(parsed.value.provenance).toBeDefined();
    expect(parsed.value.compatibility).toBeDefined();
    expect(existsSync(join(outDir, 'output'))).toBe(true);
  });
});
