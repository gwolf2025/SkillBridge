import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Result, Diagnostic } from '../../core/src/index.js';
import { ok, fail } from '../../core/src/index.js';

export interface IntegrityManifest {
  files: Record<string, string>;
}

export function generate(
  plannedFiles: Record<string, string>,
): Result<IntegrityManifest, Diagnostic> {
  const files: Record<string, string> = {};

  for (const [relativePath, plannedContent] of Object.entries(plannedFiles)) {
    const hash = createHash('sha256').update(plannedContent, 'utf-8').digest('hex');
    files[relativePath] = hash;
  }

  return ok({ files });
}

export function computeExistingChecksums(
  filePaths: string[],
): Result<Record<string, string>, Diagnostic> {
  const result: Record<string, string> = {};
  for (const filePath of filePaths) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      result[filePath] = createHash('sha256').update(content, 'utf-8').digest('hex');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      return fail({
        severity: 'error',
        message: `cannot read file '${filePath}': ${(err as Error).message}`,
        code: 'INSTALL-003',
      });
    }
  }
  return ok(result);
}
