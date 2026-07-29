import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillPackageCache } from './cache.js';
import type { AdapterManifest } from '../../adapter-sdk/src/index.js';

function createFixture(
  dir: string,
  name: string,
  version: string,
  extra?: Record<string, string>,
): string {
  const pkgDir = join(dir, `${name}-${version}`);
  mkdirSync(pkgDir, { recursive: true });
  const fm = { name, version, description: `Package ${name}`, capabilities: ['file-read'] };
  writeFileSync(join(pkgDir, 'SKILL.md'), `---\n${JSON.stringify(fm)}\n---\n\nBody.`, 'utf-8');
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      writeFileSync(join(pkgDir, k), v, 'utf-8');
    }
  }
  return pkgDir;
}

describe('SkillPackageCache', () => {
  let cacheDir: string;
  let fixtureDir: string;

  beforeAll(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'sb-cache-test-'));
    fixtureDir = mkdtempSync(join(tmpdir(), 'sb-cache-fixtures-'));
  });

  afterAll(() => {
    rmSync(cacheDir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  // AC1
  it('is constructable with default cache dir', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'default') });
    expect(cache).toBeDefined();
  });

  // AC2
  it('add copies a package and returns a CachedPackageEntry', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac2') });
    const pkgDir = createFixture(fixtureDir, 'test-pkg', '1.0.0');
    const result = cache.add(pkgDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('test-pkg');
      expect(result.value.version).toBe('1.0.0');
      expect(result.value.capabilities).toContain('file-read');
      expect(result.value.checksums).toBeDefined();
      expect(result.value.checksum).toBeDefined();
      expect(result.value.provenance.sourcePath).toBeTruthy();
    }
  });

  // AC3
  it('returns error when SKILL.md is missing', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac3') });
    const emptyDir = join(fixtureDir, 'no-skill');
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, 'other.txt'), 'data', 'utf-8');
    const result = cache.add(emptyDir);
    expect(result.ok).toBe(false);
  });

  // AC4
  it('returns error on duplicate name@version', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac4') });
    const pkgDir = createFixture(fixtureDir, 'dup-pkg', '1.0.0');
    cache.add(pkgDir);
    const result = cache.add(pkgDir);
    expect(result.ok).toBe(false);
  });

  // AC5
  it('returns error for nonexistent path', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac5') });
    const result = cache.add('/nonexistent/path');
    expect(result.ok).toBe(false);
  });

  // AC5 also
  it('returns error for file path (not directory)', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac5b') });
    const filePath = join(fixtureDir, 'a-file.txt');
    writeFileSync(filePath, 'data', 'utf-8');
    const result = cache.add(filePath);
    expect(result.ok).toBe(false);
  });

  // AC6
  it('list returns entries sorted by name asc, version desc', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac6') });
    const a1 = createFixture(fixtureDir, 'alpha', '2.0.0');
    const a2 = createFixture(fixtureDir, 'alpha', '1.0.0');
    const b1 = createFixture(fixtureDir, 'beta', '1.0.0');
    cache.add(a1);
    cache.add(a2);
    cache.add(b1);
    const list = cache.list();
    expect(list[0].name).toBe('alpha');
    expect(list[0].version).toBe('2.0.0');
    expect(list[1].name).toBe('alpha');
    expect(list[1].version).toBe('1.0.0');
    expect(list[2].name).toBe('beta');
  });

  // AC7
  it('get(name) returns latest version', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac7') });
    const v1 = createFixture(fixtureDir, 'get-pkg', '1.0.0');
    const v2 = createFixture(fixtureDir, 'get-pkg', '2.0.0');
    cache.add(v1);
    cache.add(v2);
    const entry = cache.get('get-pkg');
    expect(entry).toBeDefined();
    expect(entry!.version).toBe('2.0.0');
  });

  // AC8
  it('get(name, version) returns exact version', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac8') });
    const v1 = createFixture(fixtureDir, 'exact-pkg', '1.0.0');
    cache.add(v1);
    const entry = cache.get('exact-pkg', '1.0.0');
    expect(entry).toBeDefined();
    expect(entry!.version).toBe('1.0.0');
    expect(cache.get('exact-pkg', '2.0.0')).toBeUndefined();
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  // AC9
  it('search by name substring (case-insensitive)', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac9') });
    const a = createFixture(fixtureDir, 'MyPackage', '1.0.0');
    const b = createFixture(fixtureDir, 'other', '1.0.0');
    cache.add(a);
    cache.add(b);
    const results = cache.search({ name: 'mypackage' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('MyPackage');
  });

  // AC10
  it('search by capability', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac10') });
    const pkgDir = createFixture(fixtureDir, 'cap-pkg', '1.0.0');
    cache.add(pkgDir);
    const results = cache.search({ capability: 'file-read' });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // AC11
  it('search by sourceFormat', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac11') });
    const pkgDir = createFixture(fixtureDir, 'fmt-pkg', '1.0.0');
    cache.add(pkgDir);
    const results = cache.search({ sourceFormat: 'markdown' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    const noResults = cache.search({ sourceFormat: 'json' });
    expect(noResults).toHaveLength(0);
  });

  // AC12
  it('search() with no filters returns all entries', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac12') });
    const pkgDir = createFixture(fixtureDir, 'all-pkg', '1.0.0');
    cache.add(pkgDir);
    const results = cache.search({});
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // AC13
  it('remove(name) deletes all versions', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac13') });
    const v1 = createFixture(fixtureDir, 'rm-all', '1.0.0');
    const v2 = createFixture(fixtureDir, 'rm-all', '2.0.0');
    cache.add(v1);
    cache.add(v2);
    expect(cache.get('rm-all')).toBeDefined();
    const removed = cache.remove('rm-all');
    expect(removed).toBe(true);
    expect(cache.get('rm-all')).toBeUndefined();
    expect(cache.remove('nonexistent')).toBe(false);
  });

  // AC14
  it('remove(name, version) deletes specific version', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac14') });
    const v1 = createFixture(fixtureDir, 'rm-ver', '1.0.0');
    const v2 = createFixture(fixtureDir, 'rm-ver', '2.0.0');
    cache.add(v1);
    cache.add(v2);
    expect(cache.remove('rm-ver', '1.0.0')).toBe(true);
    expect(cache.get('rm-ver', '1.0.0')).toBeUndefined();
    expect(cache.get('rm-ver', '2.0.0')).toBeDefined();
    expect(cache.remove('rm-ver', '9.9.9')).toBe(false);
  });

  // AC15
  it('verify(name, version) checks checksums', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac15') });
    const pkgDir = createFixture(fixtureDir, 'verify-pkg', '1.0.0');
    cache.add(pkgDir);
    const result = cache.verify('verify-pkg', '1.0.0');
    expect(result.verified).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
  });

  // AC16
  it('verify() verifies all packages', () => {
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac16') });
    const a = createFixture(fixtureDir, 'v-all-a', '1.0.0');
    const b = createFixture(fixtureDir, 'v-all-b', '1.0.0');
    cache.add(a);
    cache.add(b);
    const result = cache.verify();
    expect(result.verified).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);
  });

  // AC17
  it('adapter compatibility summaries are populated', () => {
    const adapters: AdapterManifest[] = [
      {
        name: 'adapter-a',
        version: '1.0.0',
        vendor: 'test',
        adapterVersion: '0.1.0',
        supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
        capabilities: [],
      },
      {
        name: 'adapter-b',
        version: '1.0.0',
        vendor: 'test',
        adapterVersion: '0.1.0',
        supports: { sourceFormats: ['yaml'], targetFormats: ['json'] },
        capabilities: [],
      },
    ];
    const cache = new SkillPackageCache({ cacheDir: join(cacheDir, 'ac17'), adapters });
    const pkgDir = createFixture(fixtureDir, 'compat-pkg', '1.0.0');
    const result = cache.add(pkgDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.adapterCompatibility).toContain('adapter-a');
      expect(result.value.adapterCompatibility).not.toContain('adapter-b');
    }
  });

  // AC18 (index persistence)
  it('index persists across instances', () => {
    const cacheDir18 = join(cacheDir, 'ac18');
    const cache1 = new SkillPackageCache({ cacheDir: cacheDir18 });
    const pkgDir = createFixture(fixtureDir, 'persist-pkg', '1.0.0');
    cache1.add(pkgDir);

    const cache2 = new SkillPackageCache({ cacheDir: cacheDir18 });
    const entry = cache2.get('persist-pkg');
    expect(entry).toBeDefined();
    expect(entry!.version).toBe('1.0.0');
  });
});
