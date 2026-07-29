import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detect, sha256 } from './conflict.js';

describe('sha256', () => {
  it('produces a 64-char hex string', () => {
    const hash = sha256('hello');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it('is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });
});

describe('detect', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-inst-conflict-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for non-existent file', () => {
    const result = detect(join(tmpDir, 'nonexistent'), 'content');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('returns null when content matches', () => {
    const filePath = join(tmpDir, 'same.txt');
    writeFileSync(filePath, 'matching content', 'utf-8');
    const result = detect(filePath, 'matching content');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('returns ConflictInfo when content differs', () => {
    const filePath = join(tmpDir, 'different.txt');
    writeFileSync(filePath, 'old content', 'utf-8');
    const result = detect(filePath, 'new content');
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.targetPath).toBe(filePath);
      expect(result.value.existingChecksum).toBe(sha256('old content'));
      expect(result.value.plannedChecksum).toBe(sha256('new content'));
      expect(result.value.severity).toBe('warning');
    }
  });
});
