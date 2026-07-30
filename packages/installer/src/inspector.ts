import { statSync } from 'node:fs';
import type { Result, Diagnostic } from '@skillbridge/core';
import { ok, fail } from '@skillbridge/core';

export interface DestinationState {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  sizeBytes?: number;
  mtime?: string;
}

export function inspect(path: string): Result<DestinationState, Diagnostic> {
  try {
    const stats = statSync(path);
    return ok({
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      sizeBytes: stats.size,
      mtime: stats.mtime.toISOString(),
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ exists: false, isFile: false, isDirectory: false });
    }
    return fail({
      severity: 'error',
      message: `cannot inspect path '${path}': ${(err as Error).message}`,
      code: 'INSTALL-001',
    });
  }
}
