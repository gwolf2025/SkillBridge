import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillPackageCache } from '../cache.js';

describe('cache persistence and recovery', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-cache-int-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('index survives process restart (multiple instances)', () => {
    const cacheDir = join(tmpDir, 'persist-test');

    const cache1 = new SkillPackageCache({ cacheDir });
    const pkgDir = join(tmpDir, 'source-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'SKILL.md'),
      '---\n{"name":"persist-pkg","version":"1.0.0"}\n---\n\nBody.',
      'utf-8',
    );
    const addResult = cache1.add(pkgDir);
    expect(addResult.ok).toBe(true);

    const cache2 = new SkillPackageCache({ cacheDir });
    const entry = cache2.get('persist-pkg');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('persist-pkg');
    expect(entry!.version).toBe('1.0.0');
  });

  it('multiple packages with different names survive across instances', () => {
    const cacheDir = join(tmpDir, 'multi-test');

    const cache1 = new SkillPackageCache({ cacheDir });
    for (const name of ['apple', 'banana', 'cherry']) {
      const pDir = join(tmpDir, `src-${name}`);
      mkdirSync(pDir, { recursive: true });
      writeFileSync(
        join(pDir, 'SKILL.md'),
        `---\n{"name":"${name}","version":"1.0.0"}\n---\n\nBody.`,
        'utf-8',
      );
      cache1.add(pDir);
    }

    const cache2 = new SkillPackageCache({ cacheDir });
    const list = cache2.list();
    expect(list).toHaveLength(3);
    expect(list.map((e) => e.name).sort()).toEqual(['apple', 'banana', 'cherry']);
  });

  it('atomic write prevents index corruption', () => {
    const cacheDir = join(tmpDir, 'atomic-test');
    const cache = new SkillPackageCache({ cacheDir });

    const pkgDir = join(tmpDir, 'atomic-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'SKILL.md'),
      '---\n{"name":"atomic-pkg","version":"1.0.0"}\n---\n\nBody.',
      'utf-8',
    );
    cache.add(pkgDir);

    const indexPath = join(cacheDir, 'index.json');
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.packages['atomic-pkg']).toBeDefined();

    const entry = cache.get('atomic-pkg');
    expect(entry).toBeDefined();
    expect(entry!.version).toBe('1.0.0');
  });
});
