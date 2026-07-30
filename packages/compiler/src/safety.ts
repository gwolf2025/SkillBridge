import { resolve, relative, normalize } from 'node:path';
import type { Result, Diagnostic } from '@skillbridge/core';
import { ok, fail } from '@skillbridge/core';
import { hasReservedWindowsFilename } from '@skillbridge/core';

function hasTraversal(rel: string): boolean {
  return (
    rel.startsWith('..') ||
    rel === '' ||
    rel
      .replace(/\\/g, '/')
      .split('/')
      .some((part) => part === '..')
  );
}

export function validateOutputPath(
  targetPath: string,
  outputDir: string,
): Result<string, Diagnostic> {
  const resolvedTarget = resolve(targetPath);
  const resolvedOutput = resolve(outputDir);

  const normalizedTarget = normalize(resolvedTarget);
  const normalizedOutput = normalize(resolvedOutput);

  if (hasReservedWindowsFilename(targetPath)) {
    return fail({
      severity: 'error',
      message: `Output path contains reserved Windows filename: ${targetPath}`,
      code: 'COMPILER-014',
      source: 'compiler',
    });
  }

  if (normalizedTarget === normalizedOutput) {
    return fail({
      severity: 'error',
      message: `Output path is the output directory itself: ${targetPath}`,
      code: 'COMPILER-002',
      source: 'compiler',
    });
  }

  const rel = relative(normalizedOutput, normalizedTarget);

  if (hasTraversal(rel)) {
    return fail({
      severity: 'error',
      message: `Output path traversal detected: ${targetPath} is outside ${outputDir}`,
      code: 'COMPILER-001',
      source: 'compiler',
    });
  }

  return ok(normalizedTarget);
}
