# Current Task

**Status:** COMPLETE
**Title:** Implement Portable Agent Skill Adapter
**Repair Cycle:** 0

---

## Description

Implement the full `Adapter` interface from `@skillbridge/adapter-sdk` in `adapters/portable/src/index.ts`, replacing the JSDoc stub. The Portable adapter is the **reference adapter** — it reads and writes the Portable Agent Skills format (SKILL.md with YAML frontmatter, markdown body, and supporting resource files).

The adapter must be able to:

1. **Detect** whether an input path/content is a Portable Agent Skill
2. **Parse** the SKILL.md into an intermediate parsed representation
3. **Normalize** the parsed representation into the canonical `NormalizedSkill` IR type
4. **Compile** a `NormalizedSkill` back into Portable Agent Skill format (round-trip capable)
5. Surface diagnostics for unknown fields, lossy mappings, and unsupported features
6. Preserve provenance, licensing, and supporting files through the pipeline

All conversions go through IR. The Portable adapter declares `detect`, `parse`, `normalize`, `compile` capabilities. Source format: `markdown`. Target format: `markdown`.

---

## Acceptance Criteria

### AC-1: Adapter Manifest

- [ ] `AdapterManifest` is correctly declared
- [ ] `name` is `"adapter-portable"`, `vendor` is `"skillbridge"`, `version` matches package.json
- [ ] `supports.sourceFormats` includes `"markdown"`
- [ ] `supports.targetFormats` includes `"markdown"`
- [ ] `capabilities` includes `detect`, `parse`, `normalize`, `compile`
- [ ] `adapterVersion` is set

### AC-2: Detection

- [ ] `detect(path)` returns `true` for valid SKILL.md file paths
- [ ] `detect(path)` returns `true` for directory paths containing SKILL.md
- [ ] `detect(path)` returns `false` for non-existent paths
- [ ] `detect(path)` returns `false` for paths without SKILL.md
- [ ] `detect(source)` accepts a string (path) or a string (content with `---\nname:` frontmatter)

### AC-3: Parsing

- [ ] `parse(source)` reads and parses SKILL.md using the parser from `@skillbridge/parser`
- [ ] YAML frontmatter fields (`name`, `version`, `description`, `capabilities`, `permissions`, `tools`, `scripts`, `inputs`, `outputs`) are extracted correctly
- [ ] Markdown body sections (`## Description`, `## Usage`, `## Arguments`, etc.) are extracted as sections
- [ ] `parse` returns an object containing both frontmatter and sections
- [ ] Malformed YAML produces a diagnostic error (does not throw)
- [ ] Missing SKILL.md produces a diagnostic error
- [ ] Unknown frontmatter fields are preserved in an `extensions` map and produce `warning` diagnostics

### AC-4: Normalization

- [ ] `normalize(source, parsed)` maps parsed frontmatter + sections to `NormalizedSkill`
- [ ] `identity.name`, `identity.version`, `identity.description` mapped from frontmatter
- [ ] `capabilities` mapped from frontmatter capability list (validated against `CAPABILITY_VOCABULARY`)
- [ ] `permissions` mapped from frontmatter permissions list
- [ ] `invocation.instructions` mapped from `## Description` and `## Usage` sections
- [ ] `inputs` mapped from `## Arguments` section (parameter table parsing)
- [ ] `source.format` set to `"markdown"`
- [ ] `provenance.sourcePackage` set if available
- [ ] Unknown frontmatter fields preserved in `extensions` with diagnostic warnings
- [ ] Capabilities not in the IR vocabulary produce `warning` diagnostics but are preserved in `extensions`
- [ ] Returns `NormalizedSkill` (not a wrapper object)

### AC-5: Compilation

- [ ] `compile(normalized)` converts `NormalizedSkill` back to Portable Agent Skill format string
- [ ] Output is valid SKILL.md with YAML frontmatter and markdown body
- [ ] Frontmatter includes `name`, `version`, `description`, `capabilities`, `permissions`
- [ ] Body sections reconstructed from `invocation`, `inputs`, `outputs` fields
- [ ] Extensions (unknown fields) are written back into frontmatter
- [ ] Output is deterministic (same input → same output)
- [ ] Line endings are LF (consistent with prettier config)

### AC-6: Round-Trip Equivalence

- [ ] `compile(normalize(source, parse(source)))` produces a SKILL.md semantically equivalent to the original
- [ ] For minimal, full, and minimal-frontmatter fixtures from `@skillbridge/testing`, round-trip preserves all fields
- [ ] Unknown fields survive round-trip (not silently dropped)
- [ ] Diagnostics are collected and reported (not thrown)

### AC-7: Supporting Files

- [ ] `detect` and `parse` handle package directories with supporting files (resources/ subdirectory)
- [ ] Supporting files are listed in the compiled output manifest
- [ ] Non-SKILL.md files in the package directory are retained in compilation

### AC-8: Error Handling

- [ ] All errors surfaced as `Diagnostic` objects via `Result` types
- [ ] `AdapterError` thrown for programming errors only (not for user-facing validation)
- [ ] `source` field on diagnostics uses `"adapter:portable"` prefix
- [ ] Pipeline-halting errors use `'error'` severity
- [ ] Non-fatal issues use `'warning'` or `'info'` severity

### AC-9: Supporting Files / Resources

- [ ] Resource files found alongside SKILL.md are reported in compilation manifest
- [ ] Non-SKILL.md files are retained during round-trip when parsing a directory

### AC-10: Adapter Contract

- [ ] `describeAdapterContract(adapter, options)` passes all tests
- [ ] Contract tests use realistic Portable Skill fixtures as source/normalized inputs

---

## Required Tests

### Unit Tests (`adapters/portable/src/**/*.test.ts`)

1. **Manifest**: manifest has correct name, vendor, capabilities, formats
2. **Detect**: detects `.md` files with frontmatter, rejects bare text
3. **Detect**: detects directories containing `SKILL.md`
4. **Detect**: returns false for non-existent paths
5. **Parse**: parses full SKILL.md correctly (all frontmatter fields)
6. **Parse**: parses minimal SKILL.md (name + version only)
7. **Parse**: malformed YAML produces error diagnostic
8. **Parse**: unknown frontmatter fields preserved in extensions with warning
9. **Normalize**: maps all frontmatter to NormalizedSkill fields
10. **Normalize**: unknown capabilities produce warning diagnostics
11. **Normalize**: provenance is populated from source metadata
12. **Compile**: produces valid SKILL.md output
13. **Compile**: deterministic output (same input → same string)
14. **Compile**: extensions are written back to frontmatter
15. **Compile**: preserves LF line endings

### Round-Trip Tests (`adapters/portable/src/roundtrip/**/*.test.ts`)

1. **Minimal round-trip**: minimal SKILL.md fixture survives compile(normalize(parse(...)))
2. **Full round-trip**: full SKILL.md fixture survives round-trip
3. **Unknown fields round-trip**: unknown frontmatter fields survive round-trip
4. **Capabilities round-trip**: capability list survives round-trip

### Integration / Adapter Contract

1. **Contract test**: `describeAdapterContract` passes with realistic fixtures

---

## Affected Packages

- `adapters/portable` — primary implementation
- `packages/adapter-sdk` — types already defined; no changes expected
- `packages/ir` — types already defined; no changes expected
- `packages/parser` — used by the portable adapter; no changes expected
- `packages/testing` — fixtures already exist; no changes expected

---

## Architecture Decisions

### AD-1: Detect Implementation

`detect(path)` will check if the path exists. For files, it checks it ends with `.md` or is named `SKILL.md` and has YAML frontmatter (starts with `---`). For directories, it checks for the presence of a `SKILL.md` file inside.

### AD-2: Parse delegates to @skillbridge/parser

The portable adapter's `parse()` will call the shared parser from `@skillbridge/parser` which already handles SKILL.md parsing, frontmatter extraction, section detection, and diagnostics. The adapter wraps the parser result with its own context/formatting.

### AD-3: Normalize maps parser output → NormalizedSkill

The `normalize()` method converts `SkillMdResult` (from parser) into `NormalizedSkill`. Capability validation uses `isValidCapability()` from IR. Unknown capabilities go into `extensions` with warnings.

### AD-4: Compile generates valid SKILL.md

The `compile()` method converts `NormalizedSkill` back into a SKILL.md string. It uses `js-yaml` for frontmatter serialization and reconstructs markdown body sections from IR fields.

### AD-5: Round-Trip via deterministic compilation

Compilation must be deterministic (same input always produces same output). This is verified by round-trip tests: `compile(normalize(parse(source)))` must equal source in all semantically meaningful ways.

### AD-6: Supporting files via directory scanning

When parsing a directory, the resource files are scanned and their paths stored. During compilation, the manifest lists all files. The adapter does not compile non-SKILL.md files (the compiler package handles that), but it must report them.

### AD-7: No install/verify/uninstall/invoke

The Portable adapter does not implement install lifecycle. Installation and execution are handled by agent platforms. The manifest does not declare those capabilities.

---

## Security Risks

- **None.** The adapter is read-only (parse) and generates output (compile). It does not execute any skill commands. File system access is limited to reading SKILL.md and writing compiled output. No network access. No environment variable dependencies.

---

## Implementation Notes

### Dependencies to add to `adapters/portable/package.json`:

- `@skillbridge/adapter-sdk` (workspace dependency)
- `@skillbridge/core` (workspace dependency — for Result, Diagnostic, SkillBridgeError)
- `@skillbridge/ir` (workspace dependency — for NormalizedSkill, Capability, Permission)
- `@skillbridge/parser` (workspace dependency — for parseSkillMd, SkillMdResult)
- `js-yaml` (for YAML serialization in compile step)
- `@types/js-yaml` (dev dependency)

### tsconfig.json:

- Remove `rootDir` restriction if needed for cross-package imports (following pattern from `packages/adapter-sdk` and `packages/testing`)

### Round-trip test project config:

- Add `roundtrip` vitest project in the adapter's `vitest.config.ts` if it doesn't use the root config, or add roundtrip tests under the appropriate project path
- Follow the existing convention: `adapters/portable/src/**/roundtrip/**/*.test.ts` mapped to `roundtrip` project
