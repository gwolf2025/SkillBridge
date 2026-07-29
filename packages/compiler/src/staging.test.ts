import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm, mkdir } from 'node:fs/promises';
import { AtomicOutputWriter } from './staging.js';

describe('AtomicOutputWriter', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('prepare creates staging directory', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    const result = await writer.prepare();
    expect(result.ok).toBe(true);
    expect(writer.isPrepared).toBe(true);
  });

  it('writeFile writes content to staging', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    const result = await writer.writeFile('test.txt', 'hello');
    expect(result.ok).toBe(true);
  });

  it('commit renames staging to final output directory', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    await writer.writeFile('test.txt', 'hello');
    const commitResult = await writer.commit();
    expect(commitResult.ok).toBe(true);
    expect(writer.isCommitted).toBe(true);
    expect(existsSync(join(baseDir, 'out', 'test.txt'))).toBe(true);
    expect(readFileSync(join(baseDir, 'out', 'test.txt'), 'utf-8')).toBe('hello');
  });

  it('rollback removes staging directory', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    const stagingDir = (writer as unknown as { stagingDir: string }).stagingDir;
    const rollbackResult = await writer.rollback();
    expect(rollbackResult.ok).toBe(true);
    expect(writer.isRolledBack).toBe(true);
    if (stagingDir) {
      expect(existsSync(stagingDir)).toBe(false);
    }
  });

  it('writeFile fails without prepare', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    const result = await writer.writeFile('test.txt', 'content');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMPILER-012');
    }
  });

  it('commit fails without prepare', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    const result = await writer.commit();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMPILER-012');
    }
  });

  it('writeFile after commit fails', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    await writer.writeFile('test.txt', 'hello');
    await writer.commit();
    const result = await writer.writeFile('another.txt', 'content');
    expect(result.ok).toBe(false);
  });

  it('writeFile after rollback fails', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    await writer.rollback();
    const result = await writer.writeFile('test.txt', 'content');
    expect(result.ok).toBe(false);
  });

  it('writes multiple files and reads back correct content', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    await writer.writeFile('a.txt', 'content a');
    await writer.writeFile('b.txt', 'content b');
    await writer.writeFile('sub/c.txt', 'content c');
    await writer.commit();
    expect(readFileSync(join(baseDir, 'out', 'a.txt'), 'utf-8')).toBe('content a');
    expect(readFileSync(join(baseDir, 'out', 'b.txt'), 'utf-8')).toBe('content b');
    expect(readFileSync(join(baseDir, 'out', 'sub', 'c.txt'), 'utf-8')).toBe('content c');
  });

  it('validates output path safety for staged files', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    const result = await writer.writeFile('../../escape.txt', 'bad');
    expect(result.ok).toBe(false);
  });

  it('dryRun mode does not create files', async () => {
    const writer = new AtomicOutputWriter({
      outputDir: join(baseDir, 'out'),
      dryRun: true,
    });
    const prepareResult = await writer.prepare();
    expect(prepareResult.ok).toBe(true);
    const writeResult = await writer.writeFile('test.txt', 'hello');
    expect(writeResult.ok).toBe(true);
    const commitResult = await writer.commit();
    expect(commitResult.ok).toBe(true);
    expect(existsSync(join(baseDir, 'out'))).toBe(false);
  });

  it('normalizes line endings during write', async () => {
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    await writer.writeFile('test.txt', 'line1\r\nline2\r\n');
    await writer.commit();
    const content = readFileSync(join(baseDir, 'out', 'test.txt'), 'utf-8');
    expect(content).toBe('line1\nline2\n');
  });

  it('overwrites existing output directory on commit', async () => {
    await mkdir(join(baseDir, 'out'), { recursive: true });
    const writer = new AtomicOutputWriter({ outputDir: join(baseDir, 'out') });
    await writer.prepare();
    await writer.writeFile('new.txt', 'new content');
    const commitResult = await writer.commit();
    expect(commitResult.ok).toBe(true);
    expect(existsSync(join(baseDir, 'out', 'new.txt'))).toBe(true);
  });
});
