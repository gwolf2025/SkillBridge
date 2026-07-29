# Task: Implement shared deterministic compiler infrastructure

**Status:** PLANNED
**Date:** 2026-07-28

## Objective

Replace the `@skillbridge/compiler` stub with a shared compiler infrastructure providing deterministic output, stable file ordering, normalized line endings, canonical JSON serialization, output-directory safety, atomic staging, file manifests with SHA-256 checksums, compilation reports, reproducibility tests, and cleanup after failure. No vendor-specific target formatting.

## Context

The `compiler` package is currently a JSDoc-only stub. The `CompilationManifest` type lives in `@skillbridge/ir` but is used inline in the conversion pipeline's `generateManifest()` function, which produces empty checksums. Adapters currently write output directly — there is no shared deterministic writer, no atomic staging, no manifest generation, no checksumming, and no output-directory safety. This task extracts that shared infrastructure.

## Design

### Dependency Structure

- `@skillbridge/compiler` depends on: `@skillbridge/core` (Result, Diagnostic, DiagnosticCollector) and `@skillbridge/ir` (CompilationManifest)
- No dependency on adapters, adapter-sdk, conversion, or any commercial package

### Module Layout

```
src/
  index.ts            — public re-exports
  manifest.ts         — OutputManifest, writeManifest
  report.ts           — CompilationReport, generateReport
  staging.ts          — AtomicOutputWriter, StagingOptions
  deterministic.ts    — canonicalStringify, normalizeLineEndings, stableSortFiles
  safety.ts           — validateOutputPath
  checksum.ts         — computeSha256, hashFile, verifyChecksum, computeChecksums
```

### Type Definitions

```typescript
// Extends IR's CompilationManifest
interface OutputManifest extends CompilationManifest {
  source: string;
  compiledAt: string;
  compiledBy: string;
  files: string[];
  checksums: Record<string, string>;
  metadata: Record<string, unknown>;
}

interface CompilationReport {
  manifest: OutputManifest;
  fileCount: number;
  totalBytes: number;
  warnings: string[];
  errors: string[];
  startedAt: string;
  completedAt: string;
  reproducible: boolean;
}

interface StagingOptions {
  outputDir: string;
  prefix?: string; // temp dir name prefix (default: '.skillbridge-staging-')
  keepOnFailure?: boolean; // debug option to inspect staging dir
  dryRun?: boolean; // validate without writing
}
```

### Key Functions

| Export                                                                            | Description                                                                                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `canonicalStringify(value, space?)`                                               | Deterministic JSON with sorted keys, stable across Node versions                                                              |
| `normalizeLineEndings(content, eol?)`                                             | Normalize to LF (default) or specified EOL sequence                                                                           |
| `stableSortFiles(files)`                                                          | Case-insensitive sort with deterministic tiebreaking                                                                          |
| `computeSha256(input)`                                                            | SHA-256 hex digest of a string or Buffer                                                                                      |
| `hashFile(filePath)`                                                              | SHA-256 hex digest of file contents                                                                                           |
| `verifyChecksum(filePath, expected)`                                              | Returns `Result<boolean, Diagnostic>`                                                                                         |
| `computeChecksums(files, baseDir)`                                                | Compute SHA-256 for all files, returning `Record<string, string>`                                                             |
| `validateOutputPath(targetPath, outputDir)`                                       | Reject path traversal, ensure within output dir                                                                               |
| `writeManifest(manifest, outputDir)`                                              | Write canonical manifest.json, return Result                                                                                  |
| `generateReport(manifest, warnings, errors, startedAt, completedAt, totalBytes?)` | Build structured CompilationReport                                                                                            |
| `AtomicOutputWriter` class                                                        | `prepare()` → creates temp dir; `commit()` → atomic rename; `rollback()` → cleanup; `writeFile(name, content)` → stage a file |

### Atomic Staging Flow

```
writer = new AtomicOutputWriter({ outputDir })
stagingDir = await writer.prepare()
await writer.writeFile('file1.txt', 'content1')
await writer.writeFile('manifest.json', manifestJSON)
await writer.commit()  // rename stagingDir → outputDir atomically
// On error:
await writer.rollback()  // remove stagingDir
```

### Behavioral Rules

1. **canonicalStringify**: Must sort all object keys recursively. Must not depend on property insertion order. Must handle arrays, nested objects, null, undefined (omitted), Dates (ISO string).
2. **normalizeLineEndings**: Replace `\r\n` with `\n`. Optionally replace `\n` with custom EOL.
3. **stableSortFiles**: Case-insensitive primary sort, locale-independent. Case-sensitive string comparison as final tiebreaker.
4. **validateOutputPath**: Reject if resolved path is outside outputDir. Reject `..` traversal. Reject absolute paths inside staging. Return `Result<string, Diagnostic>` with COMPILER-0XX codes.
5. **AtomicOutputWriter**: `prepare()` creates a temp dir via `mkdtemp` with a configurable prefix. `commit()` removes the existing output dir then renames the staging dir to the final output dir. `rollback()` removes temp dir.
6. **writeManifest**: Serialize manifest with `canonicalStringify`, normalize line endings, write via AtomicOutputWriter.
7. **computeChecksums**: Process files in stable order. Use streaming SHA-256 for large files. Skip directories, symlinks.

### Error Codes (COMPILER-*)

| Code         | Description                              |
| ------------ | ---------------------------------------- |
| COMPILER-001 | Output path traversal detected           |
| COMPILER-002 | Output path outside output directory     |
| COMPILER-003 | Failed to create staging directory       |
| COMPILER-004 | Failed to stage file                     |
| COMPILER-005 | Failed to commit staging (rename failed) |
| COMPILER-006 | Failed to rollback staging               |
| COMPILER-007 | File not found for checksum              |
| COMPILER-008 | Checksum mismatch                        |
| COMPILER-012 | Staging directory not prepared           |

## Test Plan

### Unit Tests

**deterministic.test.ts:**

- canonicalStringify produces same output for same data regardless of key order
- canonicalStringify handles nested objects, arrays, primitives, null, Date
- canonicalStringify omits undefined values
- normalizeLineEndings converts CRLF to LF
- normalizeLineEndings preserves LF
- normalizeLineEndings with custom EOL
- stableSortFiles is case-insensitive
- stableSortFiles handles empty array
- stableSortFiles directories before files

**checksum.test.ts:**

- computeSha256 produces expected hex for known input
- computeSha256 handles empty input
- hashFile reads and hashes a file
- hashFile returns error for non-existent file (COMPILER-007)
- verifyChecksum matches expected hash
- verifyChecksum reports mismatch (COMPILER-008)
- computeChecksums processes all files in directory
- computeChecksums returns stable order results

**safety.test.ts:**

- validateOutputPath accepts path within outputDir
- validateOutputPath rejects `../` traversal
- validateOutputPath rejects absolute path outside outputDir
- validateOutputPath rejects path that escapes via symlink (resolved)

**staging.test.ts:**

- AtomicOutputWriter.prepare creates staging directory
- AtomicOutputWriter.writeFile writes content to staging
- AtomicOutputWriter.commit renames staging to final
- AtomicOutputWriter.rollback removes staging
- AtomicOutputWriter writes then reads back correct content
- AtomicOutputWriter.commit fails without prepare (COMPILER-012)
- AtomicOutputWriter writeFile validates output path safety
- AtomicOutputWriter produces deterministic manifest via canonicalStringify

**manifest.test.ts:**

- writeManifest produces valid manifest.json with checksums
- writeManifest serializes with canonical JSON
- writeManifest includes all required fields
- generateReport contains all fields
- generateReport reflects reproducible=true when no errors/warnings
- generateReport reflects reproducible=false when errors present
- computeChecksums returns correct checksum for each file

**index.test.ts:**

- All public exports are accessible
- Smoke test: full write flow (prepare → write → commit → verify checksum)

### Integration Tests

**compiler-pipeline.test.ts** (in integration/):

- Full deterministic compile flow with AtomicOutputWriter
- Two identical compilations produce identical manifests
- Staging directory is cleaned up on failure
- Output directory safety prevents traversal attacks

## Acceptance Criteria

1. **Deterministic JSON**: `canonicalStringify` produces identical output for identical data regardless of key insertion order
2. **Line ending normalization**: `normalizeLineEndings` converts CRLF→LF deterministically
3. **Stable file ordering**: `stableSortFiles` produces case-insensitive, locale-independent order
4. **SHA-256 checksums**: `computeSha256`, `hashFile`, `verifyChecksum` compute and verify correctly
5. **Output directory safety**: `validateOutputPath` rejects all path traversal and out-of-directory paths
6. **Atomic staging**: `AtomicOutputWriter` creates, stages, commits (atomic rename), and rollbacks correctly
7. **Manifest generation**: `writeManifest` produces a deterministic manifest.json with checksums for all staged files
8. **Compilation reports**: `generateReport` produces structured reports with fileCount, totalBytes, reproducible flag
9. **Cleanup after failure**: Rollback removes staging directory; commit failure does not leave partial output
10. **Full flow test**: At least one test that writes multiple files, commits, reads back, and verifies checksums all match
11. **No vendor-specific logic**: No references to portable, claude, codex, opencode, or any concrete adapter
12. **All quality gates pass**: format check, lint, typecheck, unit tests, integration tests, build
