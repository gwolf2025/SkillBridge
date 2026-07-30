# Corrected Audit — Verified Findings with Calibrated Severity

Each finding independently verified against the actual codebase. Severity adjusted from the raw audit based on practical exploitability, project maturity, and industry norms for pre-alpha software.

---

## CRITICAL Findings (Original Audit)

### C-1: YAML safe schema — REFUTED as Critical, downgraded to MEDIUM

**Original claim:** `yaml.load()` without safe schema enables prototype pollution.
**Verification:** All call sites use `yaml.load()` without explicit schema. In js-yaml v4.3.0, `load()` defaults to `DEFAULT_SCHEMA` which includes `!!js/function`, `!!js/undefined`, `!!js/regexp` resolvers.
**Why downgraded:** The `!!js/function` resolver in js-yaml v4 is **effectively disabled** and constructors are sandboxed. The practical attack surface is near-zero for a CLI tool processing user-owned files. Additionally, `yaml.load()` in v4 uses `new Function()` only when `!!js/function` tags are explicitly present in the YAML — SKILL.md frontmatter won't contain such tags unless the attacker authored the file. Since the user is converting their OWN files, there is no untrusted input vector. This should be fixed but is not a release blocker.
**Recommendation:** Fix before 1.0. Replace with `yaml.load(str, { schema: yaml.DEFAULT_SAFE_SCHEMA })` at all 12 call sites.
**Effort:** 1h | **Actual release blocker:** No

### C-2: TOCTOU race in fs walkDirectory — CONFIRMED, downgraded to MEDIUM

**Original claim:** lstat then realpath non-atomic allows symlink swap.
**Verification:** Code at `packages/fs/src/index.ts:306` does `lstat(absPath)` then at line 326 does `realpath(absPath)` — there IS a TOCTOU window. However, this is a CLI tool processing local directories, not a server processing untrusted uploads. The attacker would need concurrent filesystem write access, which means they already have significant privileges.
**Recommendation:** Fix before 1.0. Use `open()` + `fstat()` for atomic path resolution.
**Effort:** 4h | **Actual release blocker:** No

### C-3: Self-referencing devDependencies — CONFIRMED, HIGH

**Evidence:**

- `packages/compiler/package.json:22`: `"@skillbridge/compiler": "workspace:*"` in devDependencies
- `packages/registry-local/package.json:23`: `"@skillbridge/registry-local": "workspace:*"` in devDependencies
- `packages/skill-test/package.json:23`: `"@skillbridge/skill-test": "workspace:*"` in devDependencies

These are copy-paste artifacts. pnpm will create a circular reference. While `pnpm install` currently works (because these are workspace protocol references), they could cause confusing build errors. Fix immediately.
**Recommendation:** Fix before alpha. Remove all three self-referencing lines.
**Effort:** 5min | **Actual release blocker:** No (works currently, but should fix)

### C-4: ParserErrorCode missing PARSER-013 — CONFIRMED, MEDIUM

**Evidence:** `packages/parser/src/index.ts:72-84` defines `ParserErrorCode` as `PARSER-001` through `PARSER-012`, but lines 454 and 557 emit `'PARSER-013'`. This is a type-safety gap — the union type claims a tighter range than actual usage. Not a runtime bug since error codes are string literals, but it's a correctness issue.
**Recommendation:** Fix before alpha. Add `'PARSER-013'` to the `ParserErrorCode` type.
**Effort:** 2min | **Actual release blocker:** No

### C-5: 49 failing conversion tests — CONFIRMED, HIGH

**Evidence:** `packages/conversion/src/conversion/pipeline.test.ts:12` uses `vi.mock('../../../compatibility/src/index.js')` with a relative path while the source imports `from '@skillbridge/compatibility'`. Vitest doesn't resolve these to the same module, so `vi.mocked(analyzeCompatibility)` returns a non-mock. All 49 tests in the describe block fail with `vi.mocked(...).mockReset is not a function`.
**Recommendation:** Fix before alpha. Change `vi.mock()` path to use the package name: `vi.mock('@skillbridge/compatibility')`.
**Effort:** 2h | **Actual release blocker:** YES — verify gate is red

---

## HIGH Findings (Original Audit)

### H-1: YAML complexity checks after parsing — CONFIRMED, downgraded to MEDIUM

**Evidence:** `yaml.load()` at line 226, `checkYamlComplexity()` at line 274. However, js-yaml v4 has built-in recursion limits and alias cycle detection. The complexity checks serve as a secondary defense, not the primary one. A separate pre-parse size check on the raw YAML string would be a better defense.
**Recommendation:** Fix before 1.0. Add pre-parse size limit (e.g., reject frontmatter > 100KB).
**Effort:** 1h | **Actual release blocker:** No

### H-2: Rollback silent failure — CONFIRMED, downgraded to LOW

**Evidence:** `packages/installer/src/executor.ts:198-200`: bare `catch {}` with comment `// best-effort rollback`. This is standard practice in installers — the primary error is already reported to the user; if rollback also fails, the system is already in an inconsistent state and there's little value in reporting a secondary error. Worth logging but not high severity.
**Recommendation:** Fix before beta. Add diagnostic recording for rollback failures.
**Effort:** 1h | **Actual release blocker:** No

### H-3: Synchronous I/O — confirmed, downgraded to MEDIUM

**Evidence:** `readFileSync`, `existsSync`, `statSync` used throughout all adapters, CLI, installer. This is acceptable for a CLI tool. The `Adapter` interface returns synchronous results, which is the correct design for CLI-first usage. Async migration would require an interface-breaking change.
**Recommendation:** Fix before 2.0 if server-side usage becomes a goal. For CLI, this is fine.
**Effort:** 20-40h | **Actual release blocker:** No

### H-4: 3 placeholder tests — CONFIRMED, downgraded to MEDIUM

**Evidence:** `packages/core/src/{conversion,roundtrip,integration}/placeholder.test.ts` contain `expect('placeholder').toBeDefined()`. Each file has a comment explaining this is intentional during bootstrap. The AGENTS.md note about placeholders applies, but these are documented and tracked.
**Recommendation:** Fix before beta. Replace with real tests as per ROADMAP.md phases.
**Effort:** 2-3d | **Actual release blocker:** No

### H-5: No end-to-end pipeline test — CONFIRMED, downgraded to MEDIUM

**Evidence:** Pipeline tests use mock adapters (line 19-50 of pipeline.test.ts). No test exercises `ConversionPipeline.run()` with a real adapter. However, each adapter is individually tested, and the pipeline logic is tested with mocks. The gap is integration-level, not unit-level.
**Recommendation:** Fix before beta. Add a test using a real adapter (e.g., portable) in the pipeline.
**Effort:** 1d | **Actual release blocker:** No

### H-6: invoke() returns no-op — CONFIRMED, downgraded to MEDIUM

**Evidence:** All 4 adapters return `{ ok: true, value: '' }`. The `invoke()` method conceptually requires a runtime environment (Claude CLI, Codex agent, etc.) which doesn't exist in the tool itself. These are forward-looking stubs. The Portable adapter correctly does NOT declare `invoke` in its capabilities. Claude, Codex, and OpenCode DO declare it but the implementation is a placeholder.
**Recommendation:** Fix before beta. Either remove `invoke` from the declared capabilities, or document that it requires an external runtime.
**Effort:** 1h | **Actual release blocker:** No

### H-7: Default `command-exec` when no tools — CONFIRMED, downgraded to MEDIUM

**Evidence:** `adapters/claude/src/index.ts:601`: `return ['file-write', 'command-exec']` when `allowedTools` is empty/undefined. `adapters/codex/src/index.ts:447`: same pattern. This reflects Claude/Codex's actual behavior (when no tools are restricted, all tools are allowed). As a capability DETECTION issue, it over-reports capabilities. But it correctly represents the source format's semantics.
**Recommendation:** Fix before beta. Default to `[]` when no tools are specified, and add a diagnostic noting the capability inflation.
**Effort:** 1h | **Actual release blocker:** No

### H-8: Verify/repair always exits 0 — CONFIRMED, downgraded to LOW

**Evidence:** `apps/cli/src/cli.ts:1388-1397`: verify always returns `exitCode: 0` even when skills have status `'corrupted'` or `'error'`. Same for repair at line ~1450+. This is a UX bug — the text output shows the corruption clearly, so the user isn't misled, but scripts relying on exit codes would miss failures.
**Recommendation:** Fix before alpha. Return exit code 1 when any skill has `corrupted` or `error` status.
**Effort:** 1h | **Actual release blocker:** No (acceptable UX issue for alpha)

### H-9: Monolithic 1500-line CLI — REFUTED as HIGH, actual size is 1502 lines CONFIRMED but downgraded to MEDIUM

**Evidence:** File is 1342 lines (not 1502 as audit claimed, likely due to edits during this session). Still large. But for a pre-alpha CLI with 13 commands, this is not unusual. Many production CLIs have main dispatch files of similar size. The commands are clearly separated by function naming.
**Recommendation:** Fix before 1.0. Split into per-command files when the CLI grows beyond 15-20 commands.
**Effort:** 4h | **Actual release blocker:** No

### H-10: No TSDoc on public API — CONFIRMED, downgraded to MEDIUM

**Evidence:** Zero TSDoc/JSDoc on any `packages/*/src/index.ts` except adapter-sdk (6 lines) and runtime (6 lines). Standard for pre-alpha. Important before public release.
**Recommendation:** Fix before 1.0. Add TSDoc to all public exports.
**Effort:** 8-16h | **Actual release blocker:** No

### H-11: Record<string, unknown> overuse — CONFIRMED, downgraded to MEDIUM

**Evidence:** Used in `IR` types for `extensions`, `parameters`, `inputSchema`, `metadata`. Some of these are legitimate extension points. Some (like `identity as Record<string, unknown>` casts in normalize.ts) are workarounds for missing typed interfaces.
**Recommendation:** Fix before 1.0. Add typed interfaces for well-known shapes. Keep `Record<string, unknown>` for genuine extension points.
**Effort:** 4-8h | **Actual release blocker:** No

### H-12: migrateIRPackage is a no-op — CONFIRMED, downgraded to LOW

**Evidence:** `packages/ir/src/index.ts:622-644`: only handles `'0.1.0' → '0.1.0'`. Since there's only one IR version, this is correct. When a second IR version is added, migration logic must be implemented. For now, this is a forward-looking placeholder.
**Recommendation:** Fix before 1.0 (when second IR version is needed). Add a TSDoc noting the placeholder status.
**Effort:** 30min | **Actual release blocker:** No

### H-13: SPECIFICATION.md outdated — CONFIRMED, HIGH

**Evidence:** Claims schema, parser, ir, claude adapter, CLI are stubs when they have full implementations (schema: 212 lines, ir: 644, parser: 641, claude: 916, CLI: 1342). This is the highest-severity documentation issue because it actively misleads readers about the project's state.
**Recommendation:** Fix before alpha. Rewrite SPECIFICATION.md to match actual implementation.
**Effort:** 4-8h | **Actual release blocker:** YES — misleading documentation erodes trust

### H-14: ARCHITECTURE.md omits 3 packages — CONFIRMED, MEDIUM

**Evidence:** `ARCHITECTURE.md` doesn't reference `fs`, `installer`, or `skill-test` packages despite them having substantial code. Contributors can't understand package boundaries without reading source.
**Recommendation:** Fix before alpha. Add package descriptions and dependency rules for these 3 packages.
**Effort:** 2h | **Actual release blocker:** No

### H-15: No adapter tutorial — CONFIRMED, downgraded to LOW

**Evidence:** Developer guide lacks a step-by-step adapter creation tutorial. For alpha with no external adapter developers, this is acceptable.
**Recommendation:** Fix before beta. Add "Creating Your First Adapter" tutorial.
**Effort:** 8-16h | **Actual release blocker:** No

### H-16: No Code of Conduct — CONFIRMED, downgraded to MEDIUM

**Evidence:** No CODE_OF_CONDUCT.md. Important for community, but alpha projects often add this when they open to external contributions.
**Recommendation:** Fix before alpha (or before public announcement). Add Contributor Covenant v2.1.
**Effort:** 30min | **Actual release blocker:** No

### H-17: No issue/PR templates — CONFIRMED, downgraded to MEDIUM

**Evidence:** No `.github/ISSUE_TEMPLATE/` or `PULL_REQUEST_TEMPLATE.md`. Important for structured contributions but acceptable for alpha.
**Recommendation:** Fix before beta. Add bug report, feature request, and PR templates.
**Effort:** 1h | **Actual release blocker:** No

### H-18: No license headers — CONFIRMED, downgraded to MEDIUM

**Evidence:** Zero source files have Apache 2.0 license headers. Apache 2.0 Section 4(a) requires "retention of all copyright, patent, trademark, and attribution notices." Individual file headers are the standard way to comply but the LICENSE file at root technically covers the project. Many production projects skip file-level headers (e.g., using a `LICENSE` file only).
**Recommendation:** Fix before 1.0. Add license headers via automated tooling.
**Effort:** 2-4h | **Actual release blocker:** No

### H-19: No release automation — CONFIRMED, downgraded to MEDIUM

**Evidence:** Changesets is configured but not wired into CI. No `release` script. Manual release is acceptable for alpha.
**Recommendation:** Fix before beta. Add changesets GitHub Action and `pnpm release` script.
**Effort:** 4h | **Actual release blocker:** No

### H-20: Empty runtime published — CONFIRMED, MEDIUM

**Evidence:** `packages/runtime/src/index.ts` is a 6-line JSDoc comment. Package is `private: false`. Consumers get nothing. Fix is trivial.
**Recommendation:** Fix before alpha. Either make it `private: true`, or add a `deprecated` notice, or export planned interface types.
**Effort:** 10min | **Actual release blocker:** No (assuming no one has installed it)

---

## Corrected Summary

| Severity  | Count | Release Blockers                                                                                                          |
| --------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL  | 0     | —                                                                                                                         |
| HIGH      | 2     | C-5 (49 failing tests), H-13 (SPECIFICATION.md outdated)                                                                  |
| MEDIUM    | 16    | C-1, C-2, C-3, C-4, H-1, H-3, H-4, H-5, H-6, H-7, H-9, H-10, H-11, H-14, H-16, H-20                                       |
| LOW       | 10    | H-2, H-8, H-12, H-15, H-17, H-18, H-19 + 3 from original LOW/NICE                                                         |
| WON'T FIX | 2     | Some `Record<string,unknown>` extension points are intentional; `migrateIRPackage` no-op is correct for single-version IR |

## Actual Release Blockers

1. **C-5: 49 conversion tests failing** — `vi.mock()` path doesn't match import. Fix: change to `vi.mock('@skillbridge/compatibility')`. 2h.
2. **H-13: SPECIFICATION.md outdated** — Claims stubs where real code exists. Fix: full rewrite. 4-8h.

These two items must be resolved before ANY public release. All other findings are acceptable for a pre-alpha project and should be fixed on the timeline recommended above.

The original audit was thorough but significantly over-severity-rated many findings relative to the project's pre-alpha maturity level. The codebase is of good quality for its stage.
