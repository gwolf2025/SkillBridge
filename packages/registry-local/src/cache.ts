import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
  existsSync,
  readdirSync,
  statSync,
  cpSync,
  rmSync,
  mkdtempSync,
} from 'node:fs';
import { join, resolve, normalize, relative, sep, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import type { Result, Diagnostic } from '@skillbridge/core';
import { ok, fail } from '@skillbridge/core';
import type { AdapterManifest } from '@skillbridge/adapter-sdk';

export interface CachedPackageEntry {
  name: string;
  version: string;
  description?: string;
  capabilities: string[];
  sourceFormats: string[];
  provenance: {
    sourcePath: string;
    addedAt: string;
  };
  checksums: Record<string, string>;
  checksum: string;
  adapterCompatibility?: string[];
}

export interface VerificationResult {
  verified: number;
  failed: number;
  failures: Array<{ file: string; expected: string; actual: string }>;
}

export interface CacheSearchQuery {
  name?: string;
  capability?: string;
  sourceFormat?: string;
}

export interface CacheOptions {
  cacheDir?: string;
  adapters?: AdapterManifest[];
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function sha256File(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return sha256(content);
}

interface IndexData {
  packages: Record<string, CachedPackageEntry[]>;
}

export class SkillPackageCache {
  private cacheDir: string;
  private index: IndexData = { packages: {} };
  private indexPath: string;
  private adapterManifests: AdapterManifest[] = [];

  constructor(options?: CacheOptions) {
    this.cacheDir = resolve(options?.cacheDir ?? '.skillbridge/cache');
    this.indexPath = join(this.cacheDir, 'index.json');
    this.adapterManifests = options?.adapters ?? [];

    try {
      mkdirSync(this.cacheDir, { recursive: true });
    } catch {
      // directory may already exist
    }

    this.loadIndex();
  }

  setAdapters(adapters: AdapterManifest[]): void {
    this.adapterManifests = adapters;
  }

  add(packagePath: string): Result<CachedPackageEntry, Diagnostic[]> {
    const resolvedPath = resolve(normalize(packagePath));

    if (!existsSync(resolvedPath)) {
      return fail([
        { severity: 'error', message: `path does not exist: ${packagePath}`, code: 'CACHE-001' },
      ]);
    }

    const stat = statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return fail([
        {
          severity: 'error',
          message: `path is not a directory: ${packagePath}`,
          code: 'CACHE-002',
        },
      ]);
    }

    const skillMdPath = join(resolvedPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      return fail([
        { severity: 'error', message: `missing SKILL.md in ${packagePath}`, code: 'CACHE-003' },
      ]);
    }

    const skillMdContent = readFileSync(skillMdPath, 'utf-8');
    const parsed = parseFrontmatter(skillMdContent);

    const name = (parsed.name as string) || dirname(resolvedPath).split(sep).pop() || 'unnamed';
    const version = (parsed.version as string) || '0.0.0';

    if (this.index.packages[name]) {
      const existing = this.index.packages[name].find((e) => e.version === version);
      if (existing) {
        return fail([
          {
            severity: 'error',
            message: `package '${name}@${version}' is already cached`,
            code: 'CACHE-004',
          },
        ]);
      }
    }

    const capabilities: string[] = Array.isArray(parsed.capabilities)
      ? (parsed.capabilities as string[])
      : [];
    const description = typeof parsed.description === 'string' ? parsed.description : undefined;

    const sourceFormats: string[] = ['markdown'];

    const checksums: Record<string, string> = {};
    const allFiles = collectFiles(resolvedPath);
    for (const file of allFiles) {
      const relPath = relative(resolvedPath, file).replace(/\\/g, '/');
      checksums[relPath] = sha256File(file);
    }

    const checksum = sha256(JSON.stringify(checksums));

    const targetDir = join(this.cacheDir, name, version);
    mkdirSync(targetDir, { recursive: true });

    const stagingDir = mkdtempSync(join(tmpdir(), 'sb-cache-'));
    try {
      for (const [relPath] of Object.entries(checksums)) {
        const src = join(resolvedPath, relPath);
        const dest = join(stagingDir, relPath);
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(src, dest);
      }

      const targetParent = join(this.cacheDir, name);
      mkdirSync(targetParent, { recursive: true });

      try {
        rmSync(targetDir, { recursive: true, force: true });
      } catch {
        // ignore
      }

      renameSync(stagingDir, targetDir);
    } catch (e) {
      try {
        rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return fail([
        {
          severity: 'error',
          message: `failed to copy package: ${(e as Error).message}`,
          code: 'CACHE-005',
        },
      ]);
    }

    const now = new Date().toISOString();
    const entry: CachedPackageEntry = {
      name,
      version,
      description,
      capabilities,
      sourceFormats,
      provenance: { sourcePath: resolvedPath, addedAt: now },
      checksums,
      checksum,
      adapterCompatibility: this.computeAdapterCompatibility(sourceFormats),
    };

    if (!this.index.packages[name]) {
      this.index.packages[name] = [];
    }
    this.index.packages[name].push(entry);
    this.saveIndex();

    return ok(entry);
  }

  list(): CachedPackageEntry[] {
    const result: CachedPackageEntry[] = [];
    for (const entries of Object.values(this.index.packages)) {
      for (const entry of entries) {
        result.push(entry);
      }
    }
    result.sort((a, b) => {
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return nameCmp;
      return compareVersions(b.version, a.version);
    });
    return result;
  }

  get(name: string, version?: string): CachedPackageEntry | undefined {
    const entries = this.index.packages[name];
    if (!entries) return undefined;
    if (version) {
      return entries.find((e) => e.version === version);
    }
    const sorted = [...entries].sort((a, b) => compareVersions(b.version, a.version));
    return sorted[0];
  }

  search(query: CacheSearchQuery): CachedPackageEntry[] {
    let results = this.list();

    if (query.name) {
      const q = query.name.toLowerCase();
      results = results.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (query.capability) {
      results = results.filter((e) => e.capabilities.includes(query.capability!));
    }
    if (query.sourceFormat) {
      results = results.filter((e) => e.sourceFormats.includes(query.sourceFormat!));
    }

    return results;
  }

  remove(name: string, version?: string): boolean {
    const entries = this.index.packages[name];
    if (!entries) return false;

    if (version) {
      const idx = entries.findIndex((e) => e.version === version);
      if (idx === -1) return false;
      entries.splice(idx, 1);
      const pkgDir = join(this.cacheDir, name, version);
      try {
        rmSync(pkgDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      if (entries.length === 0) {
        delete this.index.packages[name];
        try {
          rmSync(join(this.cacheDir, name), { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
      this.saveIndex();
      return true;
    }

    delete this.index.packages[name];
    try {
      rmSync(join(this.cacheDir, name), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    this.saveIndex();
    return true;
  }

  verify(name?: string, version?: string): VerificationResult {
    const verified: string[] = [];
    const failures: VerificationResult['failures'] = [];

    const processEntry = (entry: CachedPackageEntry): void => {
      const pkgDir = join(this.cacheDir, entry.name, entry.version);
      for (const [relPath, storedHash] of Object.entries(entry.checksums)) {
        const fullPath = join(pkgDir, relPath);
        try {
          const actualHash = sha256File(fullPath);
          if (actualHash === storedHash) {
            verified.push(fullPath);
          } else {
            failures.push({ file: fullPath, expected: storedHash, actual: actualHash });
          }
        } catch {
          failures.push({ file: fullPath, expected: storedHash, actual: 'FILE_NOT_FOUND' });
        }
      }
    };

    if (name) {
      const entries = this.index.packages[name];
      if (entries) {
        for (const entry of version ? entries.filter((e) => e.version === version) : entries) {
          processEntry(entry);
        }
      }
    } else {
      for (const entries of Object.values(this.index.packages)) {
        for (const entry of entries) {
          processEntry(entry);
        }
      }
    }

    return { verified: verified.length, failed: failures.length, failures };
  }

  private computeAdapterCompatibility(sourceFormats: string[]): string[] {
    const compatible: string[] = [];
    for (const m of this.adapterManifests) {
      const matches = sourceFormats.some((fmt) => m.supports.sourceFormats.includes(fmt));
      if (matches) {
        compatible.push(m.name);
      }
    }
    return compatible;
  }

  private loadIndex(): void {
    if (existsSync(this.indexPath)) {
      try {
        const raw = readFileSync(this.indexPath, 'utf-8');
        this.index = JSON.parse(raw) as IndexData;
      } catch {
        this.index = { packages: {} };
      }
    }
  }

  private saveIndex(): void {
    mkdirSync(dirname(this.indexPath), { recursive: true });
    const tmpPath = join(tmpdir(), `sb-index-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify(this.index, null, 2), 'utf-8');
    try {
      renameSync(tmpPath, this.indexPath);
    } catch {
      try {
        rmSync(tmpPath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!content.startsWith('---')) return result;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return result;

  const rawFm = content.slice(3, endIndex).trim();
  if (!rawFm) return result;

  try {
    const parsed = JSON.parse(rawFm);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // If JSON fails, try basic YAML key-value parsing
    for (const line of rawFm.split('\n')) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        let value: unknown = match[2].trim();
        if (/^['"].*['"]$/.test(value as string)) {
          value = (value as string).slice(1, -1);
        }
        result[match[1]] = value;
      }
    }
  }

  return result;
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          files.push(...collectFiles(fullPath));
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // ignore
  }
  return files;
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const na = partsA[i] || 0;
    const nb = partsB[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}
