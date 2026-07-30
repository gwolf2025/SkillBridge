import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverResources, loadPackage } from '@skillbridge/parser';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'sb-test-'));
}

function write(dir: string, relPath: string, content = '') {
  const full = join(dir, relPath);
  try {
    mkdirSync(join(dir, relPath.split(/[\\/]/).slice(0, -1).join('/')), { recursive: true });
  } catch {
    /* exists */
  }
  writeFileSync(full, content, 'utf-8');
}

describe('discoverResources (integration)', () => {
  it('discovers resource directories', async () => {
    const dir = createTempDir();
    try {
      mkdirSync(join(dir, 'scripts'));
      mkdirSync(join(dir, 'references'));
      mkdirSync(join(dir, 'scripts', 'sub'));
      writeFileSync(join(dir, 'scripts', 'build.sh'), 'echo build', 'utf-8');
      writeFileSync(join(dir, 'references', 'guide.md'), '# Guide', 'utf-8');

      const result = await discoverResources(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scripts.length).toBeGreaterThan(0);
      expect(result.value.scripts.some((p) => p.includes('build.sh'))).toBe(true);
      expect(result.value.references.some((p) => p.includes('guide.md'))).toBe(true);
      expect(result.value.templates).toEqual([]);
      expect(result.value.examples).toEqual([]);
      expect(result.value.assets).toEqual([]);
      expect(result.value.tests).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty arrays when no resource dirs exist', async () => {
    const dir = createTempDir();
    try {
      const result = await discoverResources(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scripts).toEqual([]);
      expect(result.value.references).toEqual([]);
      expect(result.value.templates).toEqual([]);
      expect(result.value.examples).toEqual([]);
      expect(result.value.assets).toEqual([]);
      expect(result.value.tests).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadPackage (integration)', () => {
  it('loads a package with SKILL.md and resource dirs', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'SKILL.md', '---\nname: test\nversion: 1.0.0\n---\n\n## Description\nHello.\n');
      write(dir, 'LICENSE', 'MIT License');
      mkdirSync(join(dir, 'scripts'));
      write(dir, 'scripts/build.sh', 'echo build');

      const result = await loadPackage(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasSkillMd).toBe(true);
      expect(result.value.hasLicense).toBe(true);
      expect(result.value.hasNotice).toBe(false);
      expect(result.value.resourceDirs.scripts.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads a full package with skillbridge.yaml', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'SKILL.md', '# Skill');
      write(dir, 'skillbridge.yaml', 'name: full-pkg\nversion: 2.0.0\n');
      write(dir, 'LICENSE', 'MIT');
      write(dir, 'NOTICE', 'Copyright notice');
      mkdirSync(join(dir, 'templates'));
      write(dir, 'templates/readme.md', '# Template');

      const result = await loadPackage(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.manifest?.name).toBe('full-pkg');
      expect(result.value.hasLicense).toBe(true);
      expect(result.value.hasNotice).toBe(true);
      expect(result.value.resourceDirs.templates.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when SKILL.md is missing', async () => {
    const dir = createTempDir();
    try {
      const result = await loadPackage(dir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('PARSER-001');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns warnings in diagnostics for malformed frontmatter', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'SKILL.md', '---\nname: [broken\n---');
      const result = await loadPackage(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.diagnostics.length).toBeGreaterThan(0);
      expect(result.value.diagnostics.some((d) => d.code === 'PARSER-002')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('produces warnings for unknown fields in skillbridge.yaml', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'SKILL.md', '# Skill');
      write(dir, 'skillbridge.yaml', 'name: pkg\nunknown_field: hello\n');
      const result = await loadPackage(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const unknownWarnings = result.value.diagnostics.filter((d) => d.code === 'PARSER-008');
      expect(unknownWarnings.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('discovers all six resource directory types', async () => {
    const dir = createTempDir();
    try {
      write(dir, 'SKILL.md', '# Full Resource Test');
      const resourceDirs = ['scripts', 'references', 'templates', 'examples', 'assets', 'tests'];
      for (const rd of resourceDirs) {
        mkdirSync(join(dir, rd));
        write(dir, `${rd}/file.txt`, 'content');
      }
      const result = await loadPackage(dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const rd of resourceDirs) {
        expect(
          result.value.resourceDirs[rd as keyof typeof result.value.resourceDirs].length,
        ).toBeGreaterThan(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
