import { describe, it, expect } from 'vitest';
import { generate } from './manifest.js';

describe('generate', () => {
  it('creates integrity manifest with correct hashes', () => {
    const result = generate({ 'path/to/file.md': 'content' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files['path/to/file.md']).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(result.value.files['path/to/file.md'])).toBe(true);
    }
  });

  it('handles multiple files', () => {
    const result = generate({ 'a.md': 'aaa', 'b.md': 'bbb' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.files)).toHaveLength(2);
      expect(result.value.files['a.md']).not.toBe(result.value.files['b.md']);
    }
  });

  it('produces deterministic output', () => {
    const a = generate({ 'f.md': 'hello' });
    const b = generate({ 'f.md': 'hello' });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.files['f.md']).toBe(b.value.files['f.md']);
    }
  });

  it('handles empty content', () => {
    const result = generate({ 'empty.md': '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files['empty.md']).toHaveLength(64);
    }
  });
});
