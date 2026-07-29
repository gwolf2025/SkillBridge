export { canonicalStringify, normalizeLineEndings, stableSortFiles } from './deterministic.js';
export type { OutputManifest, WriteManifestOptions } from './manifest.js';
export { writeManifest, computeManifestChecksum } from './manifest.js';
export type { CompilationReport } from './report.js';
export { generateReport } from './report.js';
export type { StagingOptions } from './staging.js';
export { AtomicOutputWriter } from './staging.js';
export { validateOutputPath } from './safety.js';
export { computeSha256, hashFile, verifyChecksum, computeChecksums } from './checksum.js';
