import { resolve, normalize, sep } from 'node:path';
import { homedir } from 'node:os';
import type { Result, Diagnostic } from '../../core/src/index.js';
import { ok, fail } from '../../core/src/index.js';

export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function resolveProjectScope(baseDir: string): string {
  return resolve(baseDir);
}

export function resolveUserScope(): string {
  return resolve(homedir());
}

export function resolveCustomScope(
  customPath: string,
  allowedBase?: string,
): Result<string, Diagnostic> {
  const normalized = normalize(customPath);
  const parts = normalized.split(sep);
  let depth = 0;
  for (const part of parts) {
    if (part === '..') depth++;
    else if (part !== '.' && part !== '') depth = 0;
    if (depth > 1) {
      return fail({
        severity: 'error',
        message: `path traversal detected in '${customPath}': too many '..' segments`,
        code: 'INSTALL-004',
      });
    }
  }

  const resolved = resolve(customPath);

  if (allowedBase) {
    const base = resolve(allowedBase);
    const normalizedResolved = normalize(resolved);
    const normalizedBase = normalize(base);
    if (
      !normalizedResolved.startsWith(normalizedBase + sep) &&
      normalizedResolved !== normalizedBase
    ) {
      return fail({
        severity: 'error',
        message: `custom path '${customPath}' escapes allowed base '${allowedBase}'`,
        code: 'INSTALL-004',
      });
    }
  }

  return ok(resolved);
}
