import { describe, it, expect } from 'vitest';
import { validateOutputPath } from './safety.js';
import { normalizeLineEndings } from './deterministic.js';

describe('validateOutputPath (Windows compatibility)', () => {
  it('rejects reserved Windows filenames', () => {
    const result = validateOutputPath('/tmp/CON/config.json', '/tmp');
    expect(result.ok).toBe(false);
  });

  it('rejects path traversal with backslash', () => {
    const result = validateOutputPath('/tmp/..\\..\\etc/passwd', '/tmp');
    expect(result.ok).toBe(false);
  });
});

describe('normalizeLineEndings (cross-platform)', () => {
  it('normalizes CRLF to LF', () => {
    expect(normalizeLineEndings('hello\r\nworld')).toBe('hello\nworld');
  });

  it('normalizes CR-only to LF', () => {
    expect(normalizeLineEndings('hello\rend')).toBe('hello\nend');
  });

  it('leaves LF-only unchanged', () => {
    expect(normalizeLineEndings('hello\nworld')).toBe('hello\nworld');
  });

  it('handles mixed line endings', () => {
    expect(normalizeLineEndings('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('converts to CRLF when specified', () => {
    expect(normalizeLineEndings('hello\nworld', '\r\n')).toBe('hello\r\nworld');
  });
});
