import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ConflictInfo } from '@skillbridge/adapter-sdk';
import type { Result, Diagnostic } from '@skillbridge/core';
import { ok, fail } from '@skillbridge/core';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function detect(
  targetPath: string,
  plannedContent: string,
): Result<ConflictInfo | null, Diagnostic> {
  try {
    const existingContent = readFileSync(targetPath, 'utf-8');
    const existingHash = sha256(existingContent);
    const plannedHash = sha256(plannedContent);

    if (existingHash === plannedHash) {
      return ok(null);
    }

    return ok({
      targetPath,
      plannedChecksum: plannedHash,
      existingChecksum: existingHash,
      severity: 'warning',
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok(null);
    }
    return fail({
      severity: 'error',
      message: `cannot detect conflict for '${targetPath}': ${(err as Error).message}`,
      code: 'INSTALL-002',
    });
  }
}

export { sha256 };
