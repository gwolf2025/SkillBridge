import { describe, it, expect } from 'vitest';
import { canonicalStringify, normalizeLineEndings, stableSortFiles } from './deterministic.js';

describe('canonicalStringify', () => {
  it('produces same output for same data regardless of key order', () => {
    const a = canonicalStringify({ b: 1, a: 2, c: 3 });
    const b = canonicalStringify({ a: 2, c: 3, b: 1 });
    expect(a).toBe(b);
  });

  it('handles nested objects with sorted keys', () => {
    const result = canonicalStringify({ z: { b: 1, a: 2 }, y: 3 });
    expect(result).toContain('"a": 2');
    expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"b"'));
  });

  it('preserves array order', () => {
    const result = canonicalStringify({ items: [3, 1, 2] });
    const parsed = JSON.parse(result);
    expect(parsed.items).toEqual([3, 1, 2]);
  });

  it('handles primitives', () => {
    expect(canonicalStringify('hello')).toBe('"hello"');
    expect(canonicalStringify(42)).toBe('42');
    expect(canonicalStringify(true)).toBe('true');
    expect(canonicalStringify(null)).toBe('null');
  });

  it('omits undefined values', () => {
    const result = canonicalStringify({ a: 1, b: undefined, c: 3 });
    expect(result).toContain('"a"');
    expect(result).toContain('"c"');
    expect(result).not.toContain('"b"');
  });

  it('serializes Date as ISO string', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const result = canonicalStringify({ timestamp: date });
    expect(result).toContain('"2026-01-01T00:00:00.000Z"');
  });

  it('outputs pretty-printed JSON with default spacing', () => {
    const result = canonicalStringify({ a: 1 });
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it('handles custom spacing', () => {
    const result = canonicalStringify({ a: 1 }, 0);
    expect(result).toBe('{"a":1}');
  });
});

describe('normalizeLineEndings', () => {
  it('converts CRLF to LF', () => {
    const result = normalizeLineEndings('line1\r\nline2\r\nline3');
    expect(result).toBe('line1\nline2\nline3');
  });

  it('preserves LF when no CRLF present', () => {
    const result = normalizeLineEndings('line1\nline2\nline3');
    expect(result).toBe('line1\nline2\nline3');
  });

  it('converts lone CR to LF', () => {
    const result = normalizeLineEndings('line1\rline2\rline3');
    expect(result).toBe('line1\nline2\nline3');
  });

  it('handles custom EOL', () => {
    const result = normalizeLineEndings('line1\nline2\nline3', '\r\n');
    expect(result).toBe('line1\r\nline2\r\nline3');
  });

  it('handles empty string', () => {
    expect(normalizeLineEndings('')).toBe('');
  });

  it('handles mixed line endings', () => {
    const result = normalizeLineEndings('line1\r\nline2\nline3\r');
    expect(result).toBe('line1\nline2\nline3\n');
  });
});

describe('stableSortFiles', () => {
  it('sorts case-insensitively', () => {
    const result = stableSortFiles(['B.txt', 'a.txt', 'c.txt']);
    expect(result).toEqual(['a.txt', 'B.txt', 'c.txt']);
  });

  it('handles empty array', () => {
    expect(stableSortFiles([])).toEqual([]);
  });

  it('returns a new sorted array without mutating input', () => {
    const input = ['c', 'a', 'b'];
    const result = stableSortFiles(input);
    expect(result).toEqual(['a', 'b', 'c']);
    expect(input).toEqual(['c', 'a', 'b']);
  });

  it('handles already sorted array', () => {
    const result = stableSortFiles(['a', 'b', 'c']);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('handles numeric prefixes in filenames', () => {
    const result = stableSortFiles(['10.txt', '2.txt', '1.txt']);
    expect(result).toEqual(['1.txt', '10.txt', '2.txt']);
  });

  it('handles identical strings', () => {
    const result = stableSortFiles(['a', 'a', 'b']);
    expect(result).toEqual(['a', 'a', 'b']);
  });
});
