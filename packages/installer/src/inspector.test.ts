import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspect } from './inspector.js';

describe('inspect', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-inst-inspect-'));
    writeFileSync(join(tmpDir, 'file.txt'), 'hello', 'utf-8');
    mkdirSync(join(tmpDir, 'subdir'), { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns exists=false for missing path', () => {
    const result = inspect(join(tmpDir, 'nonexistent'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exists).toBe(false);
    }
  });

  it('returns isFile=true for a file', () => {
    const result = inspect(join(tmpDir, 'file.txt'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exists).toBe(true);
      expect(result.value.isFile).toBe(true);
      expect(result.value.isDirectory).toBe(false);
      expect(result.value.sizeBytes).toBe(5);
    }
  });

  it('returns isDirectory=true for a directory', () => {
    const result = inspect(join(tmpDir, 'subdir'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exists).toBe(true);
      expect(result.value.isFile).toBe(false);
      expect(result.value.isDirectory).toBe(true);
    }
  });

  it('returns mtime for existing files', () => {
    const result = inspect(join(tmpDir, 'file.txt'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mtime).toBeDefined();
      expect(typeof result.value.mtime).toBe('string');
    }
  });
});
