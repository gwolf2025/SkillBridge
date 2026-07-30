import type { CompilationManifest } from '@skillbridge/ir';
import type { Result, Diagnostic } from '@skillbridge/core';
import { ok } from '@skillbridge/core';
import { canonicalStringify } from './deterministic.js';
import { AtomicOutputWriter } from './staging.js';
import { computeSha256 } from './checksum.js';

export interface OutputManifest extends CompilationManifest {
  source: string;
}

export interface WriteManifestOptions {
  outputDir: string;
  manifestFileName?: string;
  stagingPrefix?: string;
}

export async function writeManifest(
  manifest: OutputManifest,
  options: WriteManifestOptions,
): Promise<Result<void, Diagnostic>> {
  const manifestFileName = options.manifestFileName ?? 'manifest.json';
  const writer = new AtomicOutputWriter({
    outputDir: options.outputDir,
    prefix: options.stagingPrefix ?? '.manifest-staging-',
  });

  const prepareResult = await writer.prepare();
  if (!prepareResult.ok) {
    return prepareResult;
  }

  const json = canonicalStringify(manifest);
  const content = json + '\n';

  const writeResult = await writer.writeFile(manifestFileName, content);
  if (!writeResult.ok) {
    await writer.rollback();
    return writeResult;
  }

  const commitResult = await writer.commit();
  if (!commitResult.ok) {
    return commitResult;
  }

  return ok(undefined);
}

export function computeManifestChecksum(manifest: OutputManifest): string {
  const json = canonicalStringify(manifest);
  return computeSha256(json);
}
