import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { safeLoadDirectory, safeLoadFile } from '@skillbridge/fs';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'fs-test-'));
}

function write(dir: string, relPath: string, content = '') {
  const parts = relPath.split(/[\\/]/);
  const full = join(dir, relPath);
  if (parts.length > 1) {
    mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
  }
  writeFileSync(full, content, 'utf-8');
}

describe('safeLoadFile (integration)', () => {
  it('loads a file successfully', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'test.txt', 'hello');
      const result = await safeLoadFile('test.txt', dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.path).toBe('test.txt');
      expect(result.value.size).toBe(5);
      expect(result.value.isSymlink).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects non-existent file', async () => {
    const dir = createTempDir();
    try {
      const result = await safeLoadFile('missing.txt', dir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('FS-004');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects directory', async () => {
    const dir = createTempDir();
    try {
      mkdirSync(join(dir, 'subdir'));
      const result = await safeLoadFile('subdir', dir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('FS-005');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects file exceeding size limit', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'big.txt', 'x'.repeat(100));
      const result = await safeLoadFile('big.txt', dir, { maxFileSizeBytes: 50 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('FS-006');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects symlink when followSymlinks is false', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'target.txt', 'secret');
      try {
        symlinkSync(join(dir, 'target.txt'), join(dir, 'link.txt'));
      } catch {
        // Symlinks may require elevated privileges on Windows — skip
        return;
      }
      const result = await safeLoadFile('link.txt', dir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('FS-007');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('safeLoadDirectory (integration)', () => {
  it('loads all files in a flat directory', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'a.txt', 'aaa');
      write(dir, 'b.txt', 'bbbb');
      write(dir, 'c.txt', 'ccccc');
      const result = await safeLoadDirectory(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalFiles).toBe(3);
      expect(result.value.totalSize).toBe(12);
      expect(result.value.files.length).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads files from nested directories', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'scripts/build.sh', 'echo build');
      write(dir, 'docs/guide.md', '# Guide');
      write(dir, 'src/index.ts', 'export const x = 1;');
      const result = await safeLoadDirectory(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalFiles).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips hidden files and directories', async () => {
    const dir = createTempDir();
    try {
      write(dir, '.hidden', 'secret');
      write(dir, '.config/settings.json', '{}');
      write(dir, 'visible.txt', 'hello');
      const result = await safeLoadDirectory(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalFiles).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('enforces maxFileCount limit', async () => {
    const dir = createTempDir();
    try {
      for (let i = 0; i < 10; i++) {
        write(dir, `file${i}.txt`, `${i}`);
      }
      const result = await safeLoadDirectory(dir, { maxFileCount: 3 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalFiles).toBeLessThanOrEqual(3);
      expect(result.value.diagnostics.some((d) => d.code === 'FS-011')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports rejected files as diagnostics', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'big.txt', 'x'.repeat(100));
      write(dir, 'small.txt', 'ok');
      const result = await safeLoadDirectory(dir, { maxFileSizeBytes: 50 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalFiles).toBe(1);
      expect(result.value.files[0].path).toBe('small.txt');
      expect(result.value.diagnostics.some((d) => d.code === 'FS-006')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty result for empty directory', async () => {
    const dir = createTempDir();
    try {
      const result = await safeLoadDirectory(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalFiles).toBe(0);
      expect(result.value.totalSize).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects non-existent root path', async () => {
    const result = await safeLoadDirectory('C:\\does-not-exist-12345');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('FS-013');
    }
  });

  it('rejects root path that is a file', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'notadir.txt', '');
      const result = await safeLoadDirectory(join(dir, 'notadir.txt'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('FS-014');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
