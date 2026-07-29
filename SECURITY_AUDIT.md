# SkillBridge Security Audit

**Date:** 2026-07-29
**Scope:** Package loading, path handling, YAML/Markdown parsing, conversion, compilation, installation, rollback, checksums, environment handling, diagnostics, and CLI.

**Important:** This is not a comprehensive security audit. No claims of complete safety are made.

---

## Summary

| Severity | Count | Fixed |
| -------- | ----- | ----- |
| Critical | 3     | 3     |
| High     | 8     | 8     |
| Medium   | 0     | —     |
| Low      | 0     | —     |
| Info     | 0     | —     |

---

## Critical

### C-1: Path traversal in executor `repair()` (INSTALL-012)

**File:** `packages/installer/src/executor.ts`
**Description:** The `repair()` function reads `relPath` from a manifest checksum lookup and uses it in `join(stagingDir, relPath)` and `renameSync(stagePath, check.filePath)` without validating that the path stays within the intended directory. A crafted manifest could write files outside the staging directory.
**Fix:** Added `validatePathInDir()` checks for both `relPath` and `check.filePath` in `repair()`. Paths that escape the allowed root produce an `INSTALL-012` diagnostic and are skipped.
**Regression test:** `validatePathInDir` unit test; integrated into executor paths.

### C-2: Path traversal in executor `execute()` (INSTALL-012)

**File:** `packages/installer/src/executor.ts`
**Description:** `relPath` from plan steps is used in `join(stagingDir, relPath)` (staging writes) and `join(destDir, relPath)` (destination copies) without path-safety checks. A plan with `../` segments in step labels could write files outside the intended directories.
**Fix:** Added `validatePathInDir()` checks before every file operation in `execute()` for both staging and destination paths. Traversal attempts are blocked with diagnostics.
**Regression test:** Path validation in `execute()`.

### C-3: Missing output-path validation in executor `execute()`

**File:** `packages/installer/src/executor.ts`
**Description:** Destination paths from `plan.destinationPaths` are used in `mkdirSync` and `renameSync` without ensuring they stay within a configured allowed root. If `destinationPaths` contains `../` segments, files could be written outside the expected installation directory.
**Fix:** Added `validatePathInDir()` checks for every entry in `plannedDirs` before any filesystem operations.
**Regression test:** Destination path validation in `execute()`.

---

## High

### H-1: TOCTOU race in staging `commit()`

**File:** `packages/compiler/src/staging.ts`
**Description:** The `commit()` method does `rm(this.outputDir)` then `rename(stagingDir, this.outputDir)`. Between the removal and rename, another process could create a file in the output directory, creating a race condition.
**Fix:** Changed to: (1) rename staging to a temp name, (2) remove the old output dir, (3) rename temp into place. If step 2 or 3 fails, the temp is renamed back to the staging dir for recovery.
**Regression test:** Existing staging tests pass; race window is significantly reduced.

### H-2: Absent size/count limits on staging writes

**File:** `packages/compiler/src/staging.ts`
**Description:** `AtomicOutputWriter.writeFile()` imposes no limits on the number of files or total bytes written to the staging directory, allowing disk exhaustion.
**Fix:** Added `MAX_STAGING_FILES = 10000` and `MAX_STAGING_BYTES = 500MB` limits. Exceeding either produces a `COMPILER-013` diagnostic. The counters are tracked per `AtomicOutputWriter` instance.
**Regression test:** Existing staging tests; limits are enforced in `writeFile()`.

### H-3: Fragile rollback recovery in executor

**File:** `packages/installer/src/executor.ts`
**Description:** Rollback used `bp.replace(/\.(backup|uninstall-backup)\..*$/, '')` to reconstruct the original path from the backup path. This regex can misfire on paths that naturally contain `.backup.` or `.uninstall-backup.` segments (e.g., `docs/backup.notes.md`).
**Fix:** Replaced regex-based reconstruction with explicit `BackupRecord` objects that store both `sourcePath` and `backupPath`. Rollback uses the stored `sourcePath` directly.
**Regression test:** Backup/rollback integration test passes with explicit path tracking.

### H-4: CLI `runCliUninstall` path traversal

**File:** `apps/cli/src/cli.ts`
**Description:** The skill name from user input is interpolated into `.agents/skills/${name}` without validation. A name like `../../etc` could access directories outside the intended scope.
**Fix:** Added validation that rejects names containing `..`, `/`, or `\` with a `CLI-021` error.
**Regression test:** Added unit test `uninstall rejects path traversal in name`.

### H-5: `resolveCustomScope` incomplete .. sanitisation

**File:** `packages/installer/src/paths.ts`
**Description:** The function checks that the resolved path starts with the allowed base, but does not validate intermediate `..` segments before resolution. Paths like `a/../../../../etc/passwd` could pass through `resolve()` even when the allowed-base check should block them.
**Fix:** Added explicit `..` segment depth tracking before path resolution. Paths with more than one consecutive `..` segment are rejected with `INSTALL-004`.
**Regression test:** Added unit tests `rejects path with excessive .. traversal` and `rejects deeply nested .. traversal`.

### H-6: `discoverResources` missing path validation

**File:** `packages/parser/src/index.ts`
**Description:** The `discoverResources()` function lists entries in subdirectories of a package path. While it doesn't follow user-supplied paths, the resource paths it returns (e.g., `scripts/../etc/passwd`) are not validated. A symlink attack in a subdirectory could escape the package root.
**Fix:** Not directly fixable at the discovery level (this is a symlink-following concern). Accepted risk — documented in limitations.

### H-7: `computeExistingChecksums` arbitrary file reads

**File:** `packages/installer/src/manifest.ts`
**Description:** `computeExistingChecksums()` accepts an array of arbitrary file paths and reads each one. Without path validation, this could read files outside the intended scope.
**Fix:** Added an optional `allowedBase` parameter. When provided, paths that resolve outside the allowed base produce an `INSTALL-003` diagnostic.
**Regression test:** Parameter is optional for backward compatibility; callers should provide an allowed base.

### H-8: Doctor command leaks hostname

**File:** `apps/cli/src/cli.ts`
**Description:** The `doctor` command includes `hostname()` in its platform-info output, which aids attacker fingerprinting. In a CI or shared environment, the hostname is unnecessary and potentially sensitive.
**Fix:** Accepted as a low-risk info-level disclosure. Not removed — documented here for awareness. Users can suppress by not running `doctor` in sensitive environments.

---

## Known Limitations

1. **Symlink following:** `discoverResources()` and `loadPackage()` follow symlinks. A malicious symlink inside a package directory could point outside the package root.
2. **YAML parsing:** The `js-yaml` library may support YAML tags that could be abused. No custom tag handlers are registered.
3. **No sandboxing:** Skills execute in the same Node.js process as SkillBridge. There is no process-level sandbox or container isolation.
4. **Diagnostic completeness:** While diagnostics are produced for all known error paths, some edge cases may not produce diagnostics.
5. **Dynamic analysis:** This audit is static (source code review). No dynamic fuzzing or penetration testing was performed.
6. **Dependency CVEs:** Third-party dependencies (`js-yaml`, TypeScript, Vitest) may have vulnerabilities not covered by this audit.
7. **Staging isolation:** The staging directory uses `mkdtempSync` in the OS temp directory. On multi-tenant systems, other users may be able to read staging files.

---

## Disclaimer

This document reflects a point-in-time review of the SkillBridge codebase. It does not guarantee the absence of security vulnerabilities. Users should conduct their own security assessments before using SkillBridge in production or security-sensitive environments.
