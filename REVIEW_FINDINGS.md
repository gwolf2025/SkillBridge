# Review Findings — Portable Agent Skill Adapter

**Review Date:** 2026-07-28
**Reviewer:** opencode
**State:** VERIFIED

---

## Summary

All 6 findings from the initial review have been resolved in 1 repair cycle. The Portable adapter now passes the full acceptance criteria with 286 unit tests (+44 new), 84 integration tests (+12 new), and 6 roundtrip tests (+5 new).

---

## Findings (Resolved)

### ~~HIGH-001~~ ✅ Unknown capabilities preserved in normalize extensions

**Fix:** `normalize()` now collects unknown capability strings and stores them in `extensions._unknownCapabilities`. The `compile()` method reads `_unknownCapabilities` from extensions and merges them back into the frontmatter `capabilities` list. Internal keys starting with `_` are excluded from direct frontmatter emission.

**Verification:** Unit tests confirm unknown capabilities (`claude:vendor-cap`, `opencode:custom`) are preserved and written back. Known capabilities (`file-read`) are unaffected.

---

### ~~HIGH-002~~ ✅ Adapter contract test added

**Fix:** Added `describeAdapterContract(adapter, ...)` call at the end of `adapters/portable/src/index.test.ts` with realistic Portable Skill fixtures as source and normalized values.

**Verification:** 10 contract tests pass as part of the 44 tests in the portable adapter test suite.

---

### ~~HIGH-003~~ ✅ Directory / supporting-files handling implemented

**Fix:** `parse()` now handles directory paths:

- Detects `SKILL.md` inside the directory
- Discovers resource files via `discoverResourcesSync()` (lists non-`SKILL.md` files in the directory)
- Stores discovered resource filenames in `extensions._resources`

**Verification:** 12 integration tests in `adapters/portable/src/integration/filesystem.test.ts` confirm directory detection, resource discovery, file reads, and error handling.

---

### ~~MEDIUM-001~~ ✅ Redundant exports cleaned up

**Fix:** Removed `PortableAdapterClass` alias. Exports are now: `export default ADAPTER` (instance) and `export { PortableAdapter }` (class). No duplicate exports.

---

### ~~MEDIUM-002~~ ✅ Filesystem integration tests added

**Fix:** Created `adapters/portable/src/integration/filesystem.test.ts` with 12 tests covering:

- File path detection (SKILL.md, .md files, non-.md files, plain text)
- Directory detection (with and without SKILL.md)
- Non-existent path detection
- File path parsing
- Directory path parsing
- Resource file discovery
- Deterministic output from filesystem sources
- Error diagnostics for non-existent files

---

### ~~LOW-001~~ ✅ Hardcoded IR version accepted

**Status:** Accepted as pragmatic for alpha. No exported `IR_VERSION` constant exists in the IR package. Adding one to `@skillbridge/ir` would be a cross-cutting change better handled in a future refactor.

---

## Acceptance Criteria Status

| AC  | Description                  | Status  |
| --- | ---------------------------- | ------- |
| 1   | Adapter Manifest             | ✅ PASS |
| 2   | Detection                    | ✅ PASS |
| 3   | Parsing                      | ✅ PASS |
| 4   | Normalization                | ✅ PASS |
| 5   | Compilation                  | ✅ PASS |
| 6   | Round-Trip Equivalence       | ✅ PASS |
| 7   | Supporting Files             | ✅ PASS |
| 8   | Error Handling               | ✅ PASS |
| 9   | Supporting Files / Resources | ✅ PASS |
| 10  | Adapter Contract             | ✅ PASS |

---

## Verification (Post-Repair)

- `pnpm format:check` — ✅ PASS
- `pnpm lint` — ✅ PASS (0 warnings)
- `pnpm depcheck` — ✅ PASS (0 violations)
- `pnpm typecheck` — ✅ PASS
- `pnpm test:unit` — ✅ PASS (286/286)
- `pnpm test:integration` — ✅ PASS (84/84)
- `pnpm test:roundtrip` — ✅ PASS (6/6)
- `pnpm test:conversion` — ✅ PASS (19/19)
- `pnpm build` — ✅ PASS (17 pkgs)
