# Task: Implement the Codex (OpenAI) adapter

**Status:** READY_FOR_BUILD
**Date:** 2026-07-29

## Objective

Implement the full `@skillbridge/adapter-codex` adapter according to the approved specification at `adapters/codex/specification.md` and fixture plan at `adapters/codex/fixtures-plan.md`. Support detection, parsing, normalization, deterministic compilation, capability declaration, install planning (project and user scope), provenance preservation, open-standard field preservation, output verification, and explicit diagnostics for unsupported or experimental mappings. Do not implement direct Claude-to-Codex pairwise conversion.

Key differences from the Claude adapter: Codex requires both `name` and `description` in frontmatter, uses `.agents/skills/` for discovery instead of `.claude/skills/`, and has an optional `agents/openai.yaml` companion file for UI metadata and MCP tool dependencies. No tool permission system exists — `allowed-tools` is experimental.

## Acceptance Criteria

1. **Manifest**: `AdapterManifest` declares `adapter-codex` with `markdown` source/target formats and `detect`, `parse`, `normalize`, `compile`, `install-plan`, `install`, `uninstall`, `verify` capabilities.

2. **detect()**: Returns `true` for content strings starting with `---` and containing both `name` and `description` fields (Codex detection keys). Returns `true` for `.agents/skills/<name>/SKILL.md` file paths with valid frontmatter where `name` matches the parent directory. Returns `false` for non-`.md` paths, content without `name` or `description`, empty strings, or non-existent paths.

3. **parse()**: Returns `CodexSkillResult` with `name`, `description`, `frontmatter`, `body`, `extensions` for optional open-standard fields (`license`, `compatibility`, `metadata`, `allowed-tools`), and `openaiYaml` for parsed `agents/openai.yaml` companion content. When `agents/openai.yaml` exists in the same directory as `SKILL.md`, reads and parses it, preserving `interface`, `policy`, and `dependencies.tools` in the result. Produces diagnostics:
   - CODEX-001: malformed YAML in `SKILL.md` frontmatter
   - CODEX-002: malformed YAML in `agents/openai.yaml` companion file
   - CODEX-003: experimental `allowed-tools` field encountered (info-level)
   - CODEX-004: `name` constraint violation (uppercase, leading/trailing/consecutive hyphens, >64 chars)
   - CODEX-005: unknown frontmatter fields (info-level, preserved in extensions)

4. **normalize()**: Maps parsed Codex skill to `NormalizedSkill` (IR):
   - `identity.name` from parsed `name`
   - `identity.version` defaults to `'0.0.0'`
   - `identity.description` from parsed `description`
   - `invocation.instructions` from `body`
   - `capabilities` derived from `allowed-tools` (experimental): `Read` → `file-read`, `Write`/`Edit` → `file-write`, `Bash` → `command-exec`; no `allowed-tools` → both `file-read` and `command-exec` as broad defaults
   - `Permission[]` mapped from `allowed-tools`: same tool-to-permission mapping as Claude adapter
   - `source.format` = `'markdown'`
   - Fields with no IR equivalent (`license`, `compatibility`, `metadata`, `agents/openai.yaml` content) preserved in `extensions` with diagnostic
   - Companion `agents/openai.yaml` content stored under `extensions._codexOpenaiYaml`

5. **compile()**: Produces deterministic Codex `SKILL.md` markdown with YAML frontmatter. Fields emitted in deterministic order: `name`, `description`, then optional open-standard fields (`license`, `compatibility`, `metadata`, `allowed-tools`), then unknown extensions. Boolean values use `true`/`false`. Same input always produces same output. Does NOT emit `agents/openai.yaml` — that is handled by `install()`.

6. **installPlan()**: Returns plan with steps for:
   - Project-scope: copy to `.agents/skills/<name>/SKILL.md` (plus `agents/openai.yaml` if present)
   - User-scope: copy to `~/.agents/skills/<name>/SKILL.md` (plus `agents/openai.yaml` if present)
   - Dry-run via `options.dryRun` flag

7. **install()/uninstall()**: Performs install/uninstall of full skill directory (`SKILL.md` + optional `agents/openai.yaml` companions) using a configurable `baseDir` from context options (defaults to project `.agents/` or user `~/.agents/`). Tests use temp directories — never access real user config.

8. **verify()**: Verifies that compiled `SKILL.md` can be re-parsed and matches original identity fields (`name`, `description`, `body`).

9. **Provenance and open-standard fields**: Fields from the Agent Skills open standard (`license`, `compatibility`, `metadata`, `allowed-tools`) are preserved through the round-trip. Unknown frontmatter fields are preserved in extensions.

10. **Unsupported mappings**: Diagnostics produced for:
    - Malformed YAML → CODEX-001
    - Malformed `agents/openai.yaml` → CODEX-002
    - Experimental `allowed-tools` → CODEX-003 (info)
    - Invalid `name` → CODEX-004
    - Unknown frontmatter fields → CODEX-005 (info, preserved in extensions)
    - Features with no IR equivalent (`license`, `compatibility`, `metadata`, `agents/openai.yaml` fields) → diagnostic for each

11. **`agents/openai.yaml` handling**: When `parse()` receives a path (not content string) and `agents/openai.yaml` exists adjacent to `SKILL.md`, the adapter reads and parses it. The companion file content is preserved through normalize/compile in extensions. On `install()`, both `SKILL.md` and `agents/openai.yaml` are written. On `detect()`, the companion file is ignored.

12. **Test isolation**: All filesystem tests use `mkdtempSync` temp directories. No test reads or writes to any real `~/.agents/` or `.agents/` directory.

13. **Determinism**: `compile()` is deterministic — same input always produces identical output string. No dates, random values, or filesystem state in output.

14. **Adapter contract**: Passes `describeAdapterContract()` from `@skillbridge/testing` with appropriate source and normalized fixtures.

## Required Tests

- **Unit** (`adapters/codex/src/index.test.ts`): Test detect, parse, normalize, compile, installPlan, install, uninstall, verify, manifest. At least 45 meaningful tests covering all ACs, error paths, edge cases, open-standard field preservation, `agents/openai.yaml` parsing, name validation, and the 15 testable assumptions from the fixture plan.

- **Integration** (`adapters/codex/src/integration/filesystem.test.ts`): Test filesystem I/O (detect/parse file paths, companion file discovery, install/uninstall to temp dirs, compile output written to disk). 10+ tests including companion file scenarios.

- **Roundtrip** (`adapters/codex/src/roundtrip/index.test.ts`): Parse → compile → re-parse and verify identity, fields, open-standard fields, and extensions survive. 5+ tests including companion file roundtrip.

- **Adapter contract**: `describeAdapterContract()` with valid source and normalized fixtures.

## Affected Packages

- `adapters/codex/src/index.ts` — main implementation
- `adapters/codex/src/index.test.ts` — unit tests
- `adapters/codex/src/integration/filesystem.test.ts` — integration tests
- `adapters/codex/src/roundtrip/index.test.ts` — roundtrip tests
- `adapters/codex/package.json` — add `js-yaml`, `@types/js-yaml`, `vitest` deps; add `test` script
- `adapters/codex/tsconfig.json` — remove explicit `rootDir` (matching portable/claude pattern)
- `adapters/codex/fixtures/` — fixture files per fixtures-plan.md

## Architecture Risks

- **Companion file handling**: `agents/openai.yaml` requires a secondary file I/O step during `parse()` when a path is provided. The `Adapter` interface's `parse(source: TSource)` operates on a single string. Options: (a) inject a custom `parse()` implementation that detects directory paths and reads both files, or (b) handle in a wrapper. The pattern established by portable/claude/opencode adapters parses the source string directly; the companion file adds complexity that may require a new `parseDirectory()` pattern or path-aware `parse()` overload.

- **No permission system**: Codex lacks a documented tool permission model like Claude's `allowed-tools`/`disallowed-tools` or OpenCode's resource globs. The experimental `allowed-tools` field is the closest concept. Mapping to IR `Permission[]` will be inherently lossy. The adapter must produce diagnostics for all lossy mappings (CODEX-003) and not fabricate a permission system that doesn't exist.

- **`name` constraint enforcement**: Codex requires `name` to match the parent directory name. The `detect()` method receives content strings (no path context), so directory-name matching can only happen during `parse()` when a file path is available. Additionally, the `name` must satisfy kebab-case constraints — validation must happen during parse.

- **`agents/openai.yaml` on install**: The `install()` method must create a directory (not just a single file) when `agents/openai.yaml` is present, plus write both files. This differs from the Claude adapter's single-file install pattern. Directory creation must use the skill's `name` as the directory name.

- **Unknown field preservation**: The open standard mandates preservation of unknown fields. Unlike Claude Code's adapter which diagnoses unknown fields, Codex may not warn. The plan adopts an info-level diagnostic (CODEX-005) to remain visible while preserving. If Codex silently ignores unknown fields, this diagnostic may be overly cautious.

## Security Risks

- **Experimental `allowed-tools`**: The `allowed-tools` field is experimental and its runtime behaviour in Codex is not documented. The adapter should not fabricate enforcement semantics. When present, map to IR capabilities with a diagnostic (CODEX-003) and preserve the original value in extensions.

- **Companion file MCP dependencies**: `agents/openai.yaml` may declare `dependencies.tools` referencing external MCP servers. The adapter must preserve these in extensions but cannot validate reachability, security, or correctness. No network access should be attempted during parse/compile.

- **No deny-list mechanism**: Unlike Claude Code's `disallowed-tools`, Codex has no documented mechanism for restricting tool access. The adapter must not silently introduce permission restrictions that don't exist in the source format.
