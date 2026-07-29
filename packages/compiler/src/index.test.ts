import { describe, it, expect } from 'vitest';
import {
  canonicalStringify,
  normalizeLineEndings,
  stableSortFiles,
  writeManifest,
  computeManifestChecksum,
  generateReport,
  AtomicOutputWriter,
  validateOutputPath,
  computeSha256,
  hashFile,
  verifyChecksum,
  computeChecksums,
} from './index.js';

describe('public exports', () => {
  it('exports deterministic utilities', () => {
    expect(canonicalStringify).toBeDefined();
    expect(canonicalStringify({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(normalizeLineEndings).toBeDefined();
    expect(normalizeLineEndings('a\r\nb')).toBe('a\nb');
    expect(stableSortFiles).toBeDefined();
    expect(stableSortFiles(['b', 'a'])).toEqual(['a', 'b']);
  });

  it('exports manifest utilities', () => {
    expect(writeManifest).toBeDefined();
    expect(computeManifestChecksum).toBeDefined();
  });

  it('exports report utilities', () => {
    expect(generateReport).toBeDefined();
  });

  it('exports staging utilities', () => {
    expect(AtomicOutputWriter).toBeDefined();
  });

  it('exports safety utilities', () => {
    expect(validateOutputPath).toBeDefined();
    expect(validateOutputPath('/a/b/c', '/a/b').ok).toBe(true);
  });

  it('exports checksum utilities', () => {
    expect(computeSha256).toBeDefined();
    expect(computeSha256('test')).toBeTruthy();
    expect(hashFile).toBeDefined();
    expect(verifyChecksum).toBeDefined();
    expect(computeChecksums).toBeDefined();
  });
});
