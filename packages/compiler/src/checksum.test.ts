import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeSha256, hashFile, verifyChecksum, computeChecksums } from './checksum.js';

describe('computeSha256', () => {
  it('produces expected hex for known input', () => {
    const hash = computeSha256('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('handles empty input', () => {
    const hash = computeSha256('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles Buffer input', () => {
    const hash = computeSha256(Buffer.from('test'));
    expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  });
});

describe('hashFile', () => {
  it('reads and hashes a file', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const filePath = join(tmpDir, 'test.txt');
    writeFileSync(filePath, 'hello world', 'utf-8');

    const result = await hashFile(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    }
  });

  it('returns error for non-existent file', async () => {
    const result = await hashFile('/nonexistent/path/file.txt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMPILER-007');
    }
  });

  it('reads and hashes a large file', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const filePath = join(tmpDir, 'large.txt');
    const content = 'x'.repeat(100000);
    writeFileSync(filePath, content, 'utf-8');

    const result = await hashFile(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value).toBe('string');
      expect(result.value.length).toBe(64);
    }
  });
});

describe('verifyChecksum', () => {
  it('returns true when checksum matches', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const filePath = join(tmpDir, 'test.txt');
    writeFileSync(filePath, 'verify me', 'utf-8');

    const hash = computeSha256('verify me');
    const result = await verifyChecksum(filePath, hash);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('returns false when checksum mismatches', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    const filePath = join(tmpDir, 'test.txt');
    writeFileSync(filePath, 'content', 'utf-8');

    const result = await verifyChecksum(
      filePath,
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  it('returns error for non-existent file', async () => {
    const result = await verifyChecksum('/nonexistent/path', 'abc');
    expect(result.ok).toBe(false);
  });
});

describe('computeChecksums', () => {
  it('computes checksums for all files', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'compiler-test-'));
    writeFileSync(join(tmpDir, 'a.txt'), 'content a', 'utf-8');
    writeFileSync(join(tmpDir, 'b.txt'), 'content b', 'utf-8');

    const result = await computeChecksums(['a.txt', 'b.txt'], tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toEqual(['a.txt', 'b.txt']);
      expect(result.value['a.txt']).toBe(computeSha256('content a'));
      expect(result.value['b.txt']).toBe(computeSha256('content b'));
    }
  });

  it('returns errors for missing files', async () => {
    const result = await computeChecksums(['missing.txt'], '/tmp');
    expect(result.ok).toBe(false);
  });

  it('handles empty file list', async () => {
    const result = await computeChecksums([], '/tmp');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({});
    }
  });
});
