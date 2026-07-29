import { describe, it, expect } from 'vitest';
import { validateOutputPath } from './safety.js';

describe('validateOutputPath', () => {
  const outputDir = '/output/dir';

  it('accepts path within outputDir', () => {
    const result = validateOutputPath('/output/dir/file.txt', outputDir);
    expect(result.ok).toBe(true);
  });

  it('accepts nested path within outputDir', () => {
    const result = validateOutputPath('/output/dir/sub/file.txt', outputDir);
    expect(result.ok).toBe(true);
  });

  it('rejects path traversal with ../', () => {
    const result = validateOutputPath('/output/dir/../outside.txt', outputDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMPILER-001');
    }
  });

  it('rejects path outside outputDir', () => {
    const result = validateOutputPath('/other/dir/file.txt', outputDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMPILER-001');
    }
  });

  it('rejects path that is the output directory itself', () => {
    const result = validateOutputPath('/output/dir', outputDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMPILER-002');
    }
  });

  it('rejects deeply nested traversal', () => {
    const result = validateOutputPath('/output/dir/sub/../../outside.txt', outputDir);
    expect(result.ok).toBe(false);
  });

  it('rejects absolute path outside', () => {
    const result = validateOutputPath('/etc/passwd', '/output/dir');
    expect(result.ok).toBe(false);
  });

  it('rejects path with same prefix but not inside outputDir', () => {
    const result = validateOutputPath('/output/directory/file.txt', '/output/dir');
    expect(result.ok).toBe(false);
  });
});
