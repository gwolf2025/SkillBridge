import { resolve, relative, normalize, sep } from 'node:path';
import type { Result, Diagnostic } from '../../core/src/index.js';
import { ok, fail } from '../../core/src/index.js';

export function validateOutputPath(
  targetPath: string,
  outputDir: string,
): Result<string, Diagnostic> {
  const resolvedTarget = resolve(targetPath);
  const resolvedOutput = resolve(outputDir);

  const normalizedTarget = normalize(resolvedTarget);
  const normalizedOutput = normalize(resolvedOutput);

  if (normalizedTarget === normalizedOutput) {
    return fail({
      severity: 'error',
      message: `Output path is the output directory itself: ${targetPath}`,
      code: 'COMPILER-002',
      source: 'compiler',
    });
  }

  const rel = relative(normalizedOutput, normalizedTarget);

  if (rel.startsWith('..') || rel === '' || rel.split(sep).some((part) => part === '..')) {
    return fail({
      severity: 'error',
      message: `Output path traversal detected: ${targetPath} is outside ${outputDir}`,
      code: 'COMPILER-001',
      source: 'compiler',
    });
  }

  return ok(normalizedTarget);
}
