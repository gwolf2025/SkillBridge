import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import type { Result, Diagnostic } from '@skillbridge/core';
import { ok, fail } from '@skillbridge/core';

export function computeSha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function hashFile(filePath: string): Promise<Result<string, Diagnostic>> {
  try {
    await access(filePath);
  } catch {
    return fail({
      severity: 'error',
      message: `File not found: ${filePath}`,
      code: 'COMPILER-007',
      source: 'compiler',
    });
  }

  try {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    return await new Promise<Result<string, Diagnostic>>((resolve) => {
      stream.on('data', (chunk: string | Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(ok(hash.digest('hex'))));
      stream.on('error', (err: Error) =>
        resolve(
          fail({
            severity: 'error',
            message: `Failed to hash file ${filePath}: ${err.message}`,
            code: 'COMPILER-007',
            source: 'compiler',
          }),
        ),
      );
    });
  } catch {
    return fail({
      severity: 'error',
      message: `Failed to hash file: ${filePath}`,
      code: 'COMPILER-007',
      source: 'compiler',
    });
  }
}

export async function verifyChecksum(
  filePath: string,
  expected: string,
): Promise<Result<boolean, Diagnostic>> {
  const hashResult = await hashFile(filePath);
  if (!hashResult.ok) {
    return hashResult;
  }
  if (hashResult.value !== expected) {
    return ok(false);
  }
  return ok(true);
}

export async function computeChecksums(
  files: string[],
  baseDir: string,
): Promise<Result<Record<string, string>, Diagnostic[]>> {
  const errors: Diagnostic[] = [];
  const checksums: Record<string, string> = {};

  for (const file of files) {
    const fullPath = baseDir ? `${baseDir}/${file}` : file;
    const result = await hashFile(fullPath);
    if (result.ok) {
      checksums[file] = result.value;
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return fail(errors);
  }
  return ok(checksums);
}
