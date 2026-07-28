import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, normalize, relative, sep, extname } from 'node:path';
import type { Result, Diagnostic } from '../../core/src/index.js';

export interface FsLoaderOptions {
  maxFileSizeBytes?: number;
  maxFileCount?: number;
  followSymlinks?: boolean;
}

export interface LoadedFile {
  path: string;
  absolutePath: string;
  size: number;
  isSymlink: boolean;
}

export interface LoadResult {
  files: LoadedFile[];
  totalSize: number;
  totalFiles: number;
  diagnostics: Diagnostic[];
}

export interface FileClassification {
  isScript: boolean;
  isConfig: boolean;
  isDocumentation: boolean;
  isAsset: boolean;
  isTest: boolean;
}

const DEFAULT_OPTIONS: Required<FsLoaderOptions> = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileCount: 1000,
  followSymlinks: false,
};

const SCRIPT_EXTENSIONS = new Set([
  '.sh',
  '.bat',
  '.cmd',
  '.ps1',
  '.py',
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
]);

const CONFIG_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config']);

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);

const ASSET_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.css',
]);

export function validatePathSafety(
  proposedPath: string,
  rootPath: string,
): Result<string, Diagnostic[]> {
  const normalizedRoot = resolve(rootPath);

  if (!proposedPath || proposedPath.trim().length === 0) {
    return {
      ok: false,
      error: [{ severity: 'error', message: 'path must not be empty', code: 'FS-001' }],
    };
  }

  if (isAbsolute(proposedPath)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `absolute path not allowed: ${proposedPath}`,
          code: 'FS-002',
        },
      ],
    };
  }

  const normalized = normalize(join(normalizedRoot, proposedPath));

  if (!normalized.startsWith(normalizedRoot)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `path escapes package root: ${proposedPath}`,
          code: 'FS-003',
        },
      ],
    };
  }

  return { ok: true, value: normalized };
}

export async function safeLoadFile(
  relativePath: string,
  rootPath: string,
  options?: FsLoaderOptions,
): Promise<Result<LoadedFile, Diagnostic[]>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const pathResult = validatePathSafety(relativePath, rootPath);
  if (!pathResult.ok) return pathResult;

  const absolutePath = pathResult.value;

  let linkStat: import('node:fs').Stats;
  try {
    linkStat = await lstat(absolutePath);
  } catch {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `file not found: ${relativePath}`,
          code: 'FS-004',
        },
      ],
    };
  }

  if (linkStat.isDirectory()) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `not a file: ${relativePath}`,
          code: 'FS-005',
        },
      ],
    };
  }

  const isSymlink = linkStat.isSymbolicLink();

  if (isSymlink) {
    if (!opts.followSymlinks) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `symlink not allowed: ${relativePath}`,
            code: 'FS-007',
          },
        ],
      };
    }
    try {
      const resolved = await realpath(absolutePath);
      if (!resolved.startsWith(resolve(rootPath))) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `symlink escapes package root: ${relativePath} -> ${resolved}`,
              code: 'FS-008',
            },
          ],
        };
      }
    } catch {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `unable to resolve symlink: ${relativePath}`,
            code: 'FS-009',
          },
        ],
      };
    }
  }

  let fileStat: import('node:fs').Stats;
  try {
    fileStat = isSymlink ? await stat(absolutePath) : linkStat;
  } catch {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `unable to stat target: ${relativePath}`,
          code: 'FS-015',
        },
      ],
    };
  }

  if (fileStat.size > opts.maxFileSizeBytes) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `file exceeds size limit (${fileStat.size} > ${opts.maxFileSizeBytes}): ${relativePath}`,
          code: 'FS-006',
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      path: relativePath.split(sep).join('/'),
      absolutePath,
      size: fileStat.size,
      isSymlink,
    },
  };
}

export function classifyFile(relativePath: string): FileClassification {
  const normalized = relativePath.split(sep).join('/');
  const ext = extname(normalized).toLowerCase();
  const dirs = normalized.split('/');

  const isTest =
    dirs.includes('test') ||
    dirs.includes('tests') ||
    dirs.includes('__tests__') ||
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.spec.ts');

  return {
    isScript: SCRIPT_EXTENSIONS.has(ext) && !isTest,
    isConfig: CONFIG_EXTENSIONS.has(ext),
    isDocumentation: DOC_EXTENSIONS.has(ext),
    isAsset: ASSET_EXTENSIONS.has(ext),
    isTest,
  };
}

async function walkDirectory(
  dirPath: string,
  rootPath: string,
  opts: Required<FsLoaderOptions>,
  results: LoadedFile[],
  diagnostics: Diagnostic[],
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    diagnostics.push({
      severity: 'warning',
      message: `unable to read directory: ${dirPath}`,
      code: 'FS-010',
    });
    return;
  }

  for (const entry of entries) {
    if (results.length >= opts.maxFileCount) {
      diagnostics.push({
        severity: 'warning',
        message: `file count limit (${opts.maxFileCount}) reached, skipping remaining files`,
        code: 'FS-011',
      });
      return;
    }

    if (entry.startsWith('.')) continue;

    const absPath = join(dirPath, entry);
    const relPath = relative(rootPath, absPath);

    let entryStat: import('node:fs').Stats;
    try {
      entryStat = await lstat(absPath);
    } catch {
      diagnostics.push({
        severity: 'warning',
        message: `unable to stat: ${relPath}`,
        code: 'FS-012',
      });
      continue;
    }

    if (entryStat.isSymbolicLink()) {
      if (!opts.followSymlinks) {
        diagnostics.push({
          severity: 'warning',
          message: `skipping symlink: ${relPath}`,
          code: 'FS-007',
        });
        continue;
      }
      try {
        const resolved = await realpath(absPath);
        if (!resolved.startsWith(resolve(rootPath))) {
          diagnostics.push({
            severity: 'warning',
            message: `symlink escapes package root: ${relPath} -> ${resolved}`,
            code: 'FS-008',
          });
          continue;
        }
      } catch {
        diagnostics.push({
          severity: 'warning',
          message: `unable to resolve symlink: ${relPath}`,
          code: 'FS-009',
        });
        continue;
      }
    }

    if (entryStat.isDirectory()) {
      await walkDirectory(absPath, rootPath, opts, results, diagnostics);
      continue;
    }

    if (entryStat.isFile()) {
      const loadResult = await safeLoadFile(relPath, rootPath, opts);
      if (loadResult.ok) {
        results.push(loadResult.value);
      } else {
        diagnostics.push(...loadResult.error);
      }
    }
  }
}

export async function safeLoadDirectory(
  rootPath: string,
  options?: FsLoaderOptions,
): Promise<Result<LoadResult, Diagnostic[]>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const diagnostics: Diagnostic[] = [];
  const files: LoadedFile[] = [];

  let rootStat: import('node:fs').Stats;
  try {
    rootStat = await stat(rootPath);
  } catch {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `root path not accessible: ${rootPath}`,
          code: 'FS-013',
        },
      ],
    };
  }

  if (!rootStat.isDirectory()) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `root path is not a directory: ${rootPath}`,
          code: 'FS-014',
        },
      ],
    };
  }

  await walkDirectory(rootPath, rootPath, opts, files, diagnostics);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return {
    ok: true,
    value: { files, totalSize, totalFiles: files.length, diagnostics },
  };
}
