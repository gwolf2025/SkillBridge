# SkillBridge 0.1.0-alpha Specification

**Write an AI skill once. Run it anywhere.**

Vendor-neutral interoperability and conversion layer for AI-agent skills. This specification defines the 0.1.0-alpha milestone: the minimum viable product capable of ingesting, normalizing, analysing, compiling, and converting skills through the SkillBridge Intermediate Representation (IR).

---

## 1. Milestone Definition

### 1.1 What 0.1.0-alpha Delivers

- Ingest a `SKILL.md` package from any supported source format
- Normalize it through the vendor-neutral SkillBridge IR
- Analyse target-adapter compatibility and capability requirements
- Compile a target-adapter package format
- Surface explicit diagnostics for unsupported, lossy, or ambiguous mappings
- Support four initial adapters: Portable, OpenCode, Claude Code, OpenAI Codex
- Install skills into agent-specific agent directories
- Verify and repair installed skill integrity
- CLI with 13 subcommands: convert, compile, parse, validate, inspect, adapters, capabilities, doctor, install, uninstall, list, verify, repair

### 1.2 What 0.1.0-alpha Explicitly Excludes

The following capabilities are **out of scope** for the 0.1.0-alpha open-source milestone. They may be addressed in later milestones or in separate commercial offerings. See [OPEN_SOURCE_BOUNDARY.md](./OPEN_SOURCE_BOUNDARY.md).

- Hosted private registries
- Organizations, teams, authentication, and SSO
- Role-based access control
- Centralized policy distribution
- Audit logging and analytics
- Billing, usage metering, and cost management
- Public skill marketplace
- Remote model execution
- Managed enterprise deployment
- Premium support

### 1.3 Versioning

This repository follows semantic versioning. The `0.1.0-alpha` label indicates pre-release software where the public API may change without notice between alpha releases. The IR version constant (`IRVersion`) is `'0.1.0'`.

---

## 2. Conversion Pipeline Contract

Every conversion passes through the SkillBridge IR. There are **no direct pairwise converters**. For example, there is no "Claude-to-Codex" converter.

```
source skill
  → source adapter (detect, load, parse)
    → normalized SkillBridge IR
      → capability analysis (requirements vs target)
        → target adapter (compile, emit)
          → compiled target skill package
```

### 2.1 Pipeline Steps

| Step      | Owner                 | Input                  | Output               |
| --------- | --------------------- | ---------------------- | -------------------- |
| Detect    | Source adapter        | Raw bytes or file path | Detection boolean    |
| Load      | Source adapter        | File path              | Source document      |
| Parse     | Source adapter        | Source document        | Vendor-specific type |
| Normalize | Source adapter        | Vendor-specific type   | Normalized IR        |
| Analyse   | Compatibility package | Normalized IR          | Compatibility report |
| Compile   | Target adapter        | Normalized IR          | Target package       |
| Emit      | Target adapter        | Target package         | Compiled files       |

### 2.2 Rules

- Every conversion must pass through the SkillBridge IR.
- Parsing and compilation must remain independently testable.
- Unknown fields must never be silently discarded.
- Unsupported behaviour must produce explicit diagnostics.
- Lossy mappings must be clearly identified.
- Security restrictions must never be silently weakened.
- Permissions must be preserved or explicitly reported as changed.
- Supporting files must be retained or explicitly reported as unsupported.
- Original provenance must be retained.
- Original licence and notice metadata must be retained.
- Converted output should be deterministic where practical.
- Portable behaviour should support round-trip equivalence testing.
- An adapter must not claim native support for behaviour it only emulates.
- Conversion success must not imply behavioural equivalence unless tests establish it.

---

## 3. Package API Surface Summaries

### 3.1 `@skillbridge/core`

**Status:** Implemented. Types and runtime helpers.

| Export                       | Kind      | Description                                                  |
| ---------------------------- | --------- | ------------------------------------------------------------ |
| `Result<T, E>`               | Type      | `{ ok: true, value: T } \| { ok: false, error: E }`          |
| `ok<T>(value: T)`            | Function  | Creates a success result                                     |
| `fail<E>(error: E)`          | Function  | Creates a failure result                                     |
| `Severity`                   | Type      | `'error' \| 'warning' \| 'info' \| 'debug'`                  |
| `SourceLocation`             | Interface | `line`, `column`, `file?`                                    |
| `Diagnostic`                 | Interface | `severity`, `message`, `code?`, `source?`, `location?`       |
| `DiagnosticCollector`        | Class     | Accumulates diagnostics, provides `hasErrors()`, `toArray()` |
| `ErrorCode`                  | Type      | `CORE-NNN` pattern                                           |
| `CoreErrorCodes`             | Const     | `INTERNAL_ERROR`, `INVALID_ARGUMENT`, `NOT_FOUND`, etc.      |
| `SkillBridgeError`           | Class     | Error with `code` string and `diagnostics: Diagnostic[]`     |
| `ValidationError`            | Class     | `SkillBridgeError` subclass with `fieldErrors`               |
| `hasReservedWindowsFilename` | Function  | Rejects CON, PRN, AUX, NUL, COM1-9, LPT1-9                   |
| `stripBom`                   | Function  | Removes UTF-8 BOM (`\uFEFF`) from string                     |
| `isCaseInsensitivePathEqual` | Function  | Case-insensitive path comparison                             |

### 3.2 `@skillbridge/schema`

**Status:** Implemented. Runtime validation schemas.

| Export           | Kind      | Description                                                         |
| ---------------- | --------- | ------------------------------------------------------------------- |
| `Schema<T>`      | Interface | `validate(value: unknown): Result<T, Diagnostic[]>`                 |
| `stringSchema`   | Function  | Validates strings with optional `minLength`, `maxLength`, `pattern` |
| `numberSchema`   | Function  | Validates numbers with optional `min`, `max`, `integer`             |
| `booleanSchema`  | Function  | Validates booleans                                                  |
| `enumSchema`     | Function  | Validates values against an allowed list                            |
| `arraySchema`    | Function  | Validates arrays with per-item schema validation                    |
| `objectSchema`   | Function  | Validates objects with per-field schema validation                  |
| `optionalSchema` | Function  | Wraps a schema to accept `undefined` or `null`                      |
| `validate`       | Function  | Shorthand for `schema.validate(value)`                              |

### 3.3 `@skillbridge/ir`

**Status:** Implemented. Full intermediate representation types and validation.

| Export                          | Kind      | Description                                                      |
| ------------------------------- | --------- | ---------------------------------------------------------------- |
| `IRVersion`                     | Type      | `'0.1.0'`                                                        |
| `Capability`                    | Type      | 22 capability string literals (file-read, command-exec, etc.)    |
| `SourceFormat`                  | Type      | `'markdown' \| 'yaml' \| 'json' \| 'package'`                    |
| `CapabilityVocabularyVersion`   | Type      | `'0.1.0'`                                                        |
| `CapabilityCategory`            | Type      | `'execution' \| 'filesystem' \| 'network' \| ...` (8 categories) |
| `ParameterInfo`                 | Interface | `type`, `description`, optional constraints                      |
| `CapabilityDefinition`          | Interface | `id`, `description`, `category`, `parameters?`                   |
| `CapabilityRequirement`         | Interface | `id`, `required`, `parameters?`                                  |
| `CAPABILITY_VOCABULARY_VERSION` | Const     | Version string                                                   |
| `CAPABILITY_VOCABULARY`         | Const     | Full vocabulary map with definitions                             |
| `getCapabilityDefinition`       | Function  | Look up a capability definition by ID                            |
| `isValidCapability`             | Function  | Type guard for capability strings                                |
| `SkillIdentity`                 | Interface | `name`, `version`, `description?`, `icon?`                       |
| `InvocationGuidance`            | Interface | Invocation hints (warmup, recommended template)                  |
| `SkillIO`                       | Interface | Input/output parameter definition                                |
| `SkillResource`                 | Interface | Resource file path and type                                      |
| `SkillScript`                   | Interface | Script command and language                                      |
| `SkillTool`                     | Interface | Tool name, description, and parameters                           |
| `Permission`                    | Interface | `resource`, `actions`                                            |
| `EnvironmentRequirement`        | Interface | Environment constraints (env vars, hostname, etc.)               |
| `ExecutionRequirement`          | Interface | Memory, timeout, network, sandbox requirements                   |
| `ConversionStep`                | Interface | Step name, timestamp, version                                    |
| `Provenance`                    | Interface | `convertedAt`, `convertedBy`, `sourcePackage`, `history`         |
| `LicenseMetadata`               | Interface | `spdx`, `name`, `url`                                            |
| `SourceMetadata`                | Interface | `format`, `version?`, `path?`                                    |
| `CompilationManifest`           | Interface | `files`, `checksums`, `metadata`, `compiledAt`, `compiledBy`     |
| `NormalizedSkill`               | Interface | Full skill representation with all sections                      |
| `ResolvedIR`                    | Interface | `NormalizedSkill` + optional `dependencies` + `diagnostics`      |
| `CompiledIR`                    | Interface | `ResolvedIR` + `CompilationManifest`                             |
| `normalizedSkillSchema`         | Const     | Validation schema for `NormalizedSkill`                          |
| `validateNormalizedSkill`       | Function  | Validates an IR package                                          |
| `validateCapabilityRequirement` | Function  | Validates a capability requirement                               |
| `PackageManifest`               | Interface | Package metadata (name, version, description, dependencies)      |
| `SkillPackageResourceDirs`      | Interface | Resource directory categories                                    |
| `SkillPackageMeta`              | Interface | Package-level metadata (manifest + resources)                    |
| `validatePackageManifest`       | Function  | Validates a package manifest                                     |
| `migrateIRPackage`              | Function  | IR version migration (currently identity-only)                   |

### 3.4 `@skillbridge/parser`

**Status:** Implemented. SKILL.md parsing, YAML frontmatter, section extraction, resource discovery, path safety.

| Export                  | Kind      | Description                                                                          |
| ----------------------- | --------- | ------------------------------------------------------------------------------------ |
| `parseSkillMd`          | Function  | Parses SKILL.md content; returns frontmatter, body sections, extensions, diagnostics |
| `parseSkillbridgeYaml`  | Function  | Parses `skillbridge.yaml` companion file                                             |
| `parseBodySections`     | Function  | Splits body on `## Heading` boundaries                                               |
| `discoverResources`     | Function  | Scans scripts/, references/, templates/, examples/, assets/, tests/                  |
| `validatePackagePath`   | Function  | Validates relative path safety (traversal, reserved names)                           |
| `loadPackage`           | Function  | Orchestrates full package loading from a directory path                              |
| `SkillMdResult`         | Interface | Parsed document with frontmatter, sections, extensions                               |
| `SkillMdSection`        | Interface | Section heading, body, and source location                                           |
| `SkillbridgeYamlResult` | Interface | Parsed companion YAML file                                                           |

**Error codes:** PARSER-001 through PARSER-013.

### 3.5 `@skillbridge/compatibility`

**Status:** Implemented. Capability comparison, compatibility analysis, security-impact assessment, inspection utilities.

| Export                         | Kind     | Description                                                    |
| ------------------------------ | -------- | -------------------------------------------------------------- |
| `CompatibilityMatrix`          | Class    | Cross-adapter compatibility matrix (JSON/Markdown output)      |
| `categorizePermission`         | Function | Classifies a permission into a category                        |
| `summarizePermissions`         | Function | Groups permissions by category with counts                     |
| `inspectPermissions`           | Function | Compares permissions between source and compiled skill         |
| `compareCapabilities`          | Function | Compares required vs supported capabilities                    |
| `analyzeCompatibility`         | Function | Full analysis: requirements → target → report                  |
| `assessSecurityImpact`         | Function | Compares source vs target permissions for security changes     |
| `generateCompatibilityReport`  | Function | Combines capability analysis with optional security assessment |
| `CompatibilityReportFormatter` | Class    | `toJSON()` and `toText()` output formatting                    |

**Compatibility levels:** `'native' | 'emulated' | 'missing' | 'degraded' | 'partial' | 'unknown'`

**Error codes:** COMPAT-001 through COMPAT-020.

### 3.6 `@skillbridge/compiler`

**Status:** Implemented. Deterministic output writer, checksum utilities, path safety, output manifests.

| Export                    | Kind     | Description                                                |
| ------------------------- | -------- | ---------------------------------------------------------- |
| `AtomicOutputWriter`      | Class    | Staging-based output writer with commit/rollback lifecycle |
| `canonicalStringify`      | Function | Stable JSON serialization with sorted keys                 |
| `normalizeLineEndings`    | Function | CRLF/CR → LF conversion                                    |
| `stableSortFiles`         | Function | Case-insensitive file sort with stable ordering            |
| `computeSha256`           | Function | SHA-256 hash of a string                                   |
| `hashFile`                | Function | SHA-256 hash of a file                                     |
| `verifyChecksum`          | Function | Verifies file content against expected hash                |
| `computeManifestChecksum` | Function | Stable manifest fingerprint                                |
| `validateOutputPath`      | Function | Path safety: reserved names, traversal, self-output        |
| `hasTraversal`            | Function | Checks for `..` path segments                              |

**Error codes:** COMPILER-001 through COMPILER-014.

### 3.7 `@skillbridge/conversion`

**Status:** Implemented. Pipeline orchestration, normalization, policy enforcement.

| Export                 | Kind      | Description                                                        |
| ---------------------- | --------- | ------------------------------------------------------------------ |
| `ConversionPipeline`   | Class     | Full pipeline: detect → parse → normalize → analyse → compile      |
| `ConversionResult`     | Interface | `output`, `diagnostics`, `compatibility`, `provenance`, `manifest` |
| `normalizePackageToIR` | Function  | Normalizes parsed document and companion YAML into IR              |
| `PolicyMode`           | Type      | `'strict' \| 'safe' \| 'permissive'`                               |
| `PolicyDecision`       | Interface | Decision type, action (allow/warn/block), detail, diagnostic       |
| `PolicyResult`         | Interface | Policy summary, blocked flag, decisions array                      |
| `applyPolicy`          | Function  | Applies policy mode to compatibility and security reports          |
| `FieldProvenance`      | Interface | Source tracking for each normalized field                          |

**Error codes:** CONV-001 through CONV-015.

### 3.8 `@skillbridge/runtime`

**Status:** Placeholder (JSDoc only). Not implemented. Execution is deferred to a later milestone.

**Exports:** None.

### 3.9 `@skillbridge/adapter-sdk`

**Status:** Implemented. Full adapter interface, conversion context, install plan, error types.

| Export              | Kind      | Description                                                         |
| ------------------- | --------- | ------------------------------------------------------------------- |
| `AdapterCapability` | Type      | `'detect' \| 'parse' \| 'normalize' \| 'compile' \| ...`            |
| `AdapterManifest`   | Interface | `name`, `version`, `vendor`, `supports`, `capabilities`             |
| `Adapter`           | Interface | Three-generic adapter with manifest, detect, parse, compile         |
| `ConversionContext` | Interface | Context carrying source, parsed data, and manifest through pipeline |
| `InstallPlan`       | Interface | Install steps, scope, overwrite policy, permissions                 |
| `AdapterSelector`   | Interface | Adapter selection strategy (source/target format matching)          |
| `DetectionResult`   | Interface | Detected adapter with confidence                                    |
| `AdapterError`      | Class     | Error type with code, message, and diagnostics                      |

**Adapter requirements:** Each adapter must implement `detect()`, `parse()`, and `compile()`. Optional methods: `normalize()`, `installPlan()`, `install()`, `uninstall()`, `verify()`, `invoke()`.

### 3.10 `@skillbridge/registry-local`

**Status:** Implemented. Local adapter registry and package cache.

| Export                 | Kind  | Description                                                 |
| ---------------------- | ----- | ----------------------------------------------------------- |
| `LocalAdapterRegistry` | Class | Adapter registry with detection ranking and selection       |
| `SkillPackageCache`    | Class | Local package cache: add, list, search, get, remove, verify |

### 3.11 `@skillbridge/testing`

**Status:** Implemented. Shared test fixtures, adapter contract tests, packaging invariant tests.

| Export                    | Kind     | Description                                    |
| ------------------------- | -------- | ---------------------------------------------- |
| `describeAdapterContract` | Function | Shared contract test suite for adapters        |
| `InMemoryTestAdapter`     | Class    | Test double implementing the Adapter interface |
| `HELLO_WORLD_SKILL`       | Const    | Example SKILL.md content (hello-world)         |
| `FILE_ORGANIZER_SKILL`    | Const    | Example SKILL.md content (file-organizer)      |
| `SECRET_ROTATOR_SKILL`    | Const    | Example SKILL.md content (secret-rotator)      |
| `CODE_ANALYZER_SKILL`     | Const    | Example SKILL.md content (code-analyzer)       |
| `VENDOR_HOOKS_SKILL`      | Const    | Example SKILL.md content (vendor-hooks)        |

**Packaging tests:** 115 tests validating version, private flag, files manifest, LICENSE, NOTICE, repository metadata, workspace dependencies across all 19 workspace packages.

### 3.12 `apps/cli`

**Status:** Implemented. 13 subcommands with JSON output, error codes, dry-run support, secret redaction.

| Command        | Description                                            | Flags                                                   |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `convert`      | Convert a skill between formats                        | `--from`, `--to`, `--output-dir`, `--dry-run`, `--json` |
| `compile`      | Compile a skill to a specific format                   | `--output-dir`, `--dry-run`, `--json`                   |
| `parse`        | Parse a skill and show IR                              | `--json`                                                |
| `validate`     | Validate a skill file                                  | `--json`                                                |
| `inspect`      | Inspect a skill's capabilities and permissions         | `--json`                                                |
| `adapters`     | List available adapters                                | `--format` (markdown/matrix), `--json`                  |
| `capabilities` | Display the IR capability vocabulary                   | `--format` (markdown/json), `--json`                    |
| `doctor`       | Run system diagnostics (Node, pnpm, disk, env secrets) | `--json`                                                |
| `install`      | Install a skill from a file                            | `--dry-run`, `--force`, `--json`                        |
| `uninstall`    | Uninstall a skill by name                              | `--json`                                                |
| `list`         | List installed skills                                  | `--json`                                                |
| `verify`       | Verify integrity of installed skills                   | `--json`                                                |
| `repair`       | Repair corrupted installed skills                      | `--json`                                                |

**Exit codes:** 0 (success), 1 (error).

**Error codes:** CLI-001 through CLI-021.

### 3.13 `adapters/*`

All four adapters are implemented with real detection, parsing, normalization, compilation, and installation logic. Each adapter is 450–920 lines of TypeScript.

| Adapter                         | Source Format | Capabilities                                                                 | Lines |
| ------------------------------- | ------------- | ---------------------------------------------------------------------------- | ----- |
| `@skillbridge/adapter-portable` | `markdown`    | detect, parse, normalize, compile                                            | ~460  |
| `@skillbridge/adapter-claude`   | `markdown`    | detect, parse, normalize, compile, install, uninstall, verify, invoke (stub) | ~920  |
| `@skillbridge/adapter-codex`    | `markdown`    | detect, parse, normalize, compile, install, uninstall, verify, invoke (stub) | ~740  |
| `@skillbridge/adapter-opencode` | `markdown`    | detect, parse, normalize, compile, install, uninstall, verify, invoke (stub) | ~710  |

**Note:** `invoke()` methods return a no-op placeholder. Invocation requires an external runtime environment (Claude CLI, Codex agent, etc.) and is not yet integrated.

---

## 4. Adapter Contract

Every adapter MUST:

1. Implement the `Adapter` interface from `@skillbridge/adapter-sdk`.
2. Declare an `AdapterManifest` with accurate `supports.sourceFormats` and `supports.targetFormats`.
3. Implement `detect(source)` to return `true` only for sources the adapter can handle.
4. Implement `parse(source)` to return a vendor-specific parsed representation.
5. Implement `normalize?(source, parsed)` to return a `NormalizedSkill` (optional — pipeline uses adapter parse output directly if absent).
6. Implement `compile(normalized)` to return the target-format output.
7. Surface all errors as `Diagnostic` objects.
8. Preserve provenance from source through to compiled output.
9. Never silently discard unknown fields — emit a diagnostic for each.

Every adapter MUST NOT:

1. Create pairwise conversion logic (e.g., "Claude-to-Codex" in a single adapter).
2. Claim native support for behaviour it only emulates.
3. Silently weaken permissions or security restrictions.
4. Require environment variables for basic functionality.

---

## 5. Diagnostic Schema

Diagnostics flow through every pipeline stage. The type is defined in `@skillbridge/core`:

```typescript
interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  code?: string;
  source?: string;
  location?: { line: number; column: number; file?: string };
}
```

### 5.1 Severity Semantics

| Severity  | Meaning                                        | Pipeline Effect   |
| --------- | ---------------------------------------------- | ----------------- |
| `error`   | The conversion cannot proceed                  | Pipeline halts    |
| `warning` | The conversion proceeds with degraded fidelity | Reported to user  |
| `info`    | Informational note about the conversion        | Logged            |
| `debug`   | Detailed debug information                     | Hidden by default |

### 5.2 Diagnostic Code Namespaces

Each package defines its own diagnostic code namespace:

| Package                      | Prefix          | Range                                                 |
| ---------------------------- | --------------- | ----------------------------------------------------- |
| `@skillbridge/core`          | `CORE-`         | 001–006                                               |
| `@skillbridge/schema`        | `SCHEMA-`       | 001–012                                               |
| `@skillbridge/ir`            | `IR-`           | 001–                                                  |
| `@skillbridge/parser`        | `PARSER-`       | 001–013                                               |
| `@skillbridge/compatibility` | `COMPAT-`       | 001–020                                               |
| `@skillbridge/compiler`      | `COMPILER-`     | 001–014                                               |
| `@skillbridge/conversion`    | `CONV-`         | 001–015                                               |
| `apps/cli`                   | `CLI-`          | 001–021                                               |
| Adapters                     | Vendor-specific | e.g., CLAUDE-001–005, CODEX-001–005, OPENCODE-001–007 |

### 5.3 Error Handling

Pipeline stages use `Result<T, E>` from `@skillbridge/core` to return either a successful value or a failure with one or more `Diagnostic` objects. Stages that produce non-fatal warnings accumulate diagnostics alongside the result.

---

## 6. Testing Requirements

### 6.1 Test Projects

The Vitest workspace defines four projects:

| Project       | Path Pattern                                                                | Purpose                  |
| ------------- | --------------------------------------------------------------------------- | ------------------------ |
| `unit`        | `packages/*/src/**/*.test.ts` (excludes integration, roundtrip, conversion) | Per-unit behaviour       |
| `integration` | `packages/*/src/**/integration/**/*.test.ts`                                | Cross-package flows      |
| `roundtrip`   | `packages/*/src/**/roundtrip/**/*.test.ts`                                  | Bidirectional conversion |
| `conversion`  | `packages/*/src/**/conversion/**/*.test.ts`                                 | Full pipeline conversion |

### 6.2 Requirements

- Every new function, type, or module must have unit tests.
- Integration tests for changes spanning multiple packages or involving I/O.
- Round-trip tests for bidirectional conversion logic.
- Conversion tests for pipeline orchestration changes.
- Tests must be meaningful. No `assert(true)` or `expect(true).toBe(true)`.
- Tests must cover error paths: malformed input, missing data, invalid state.

### 6.3 Current Test Counts

| Project       | Test Files | Tests |
| ------------- | ---------- | ----- |
| `unit`        | 39         | 891   |
| `integration` | 13         | 156   |
| `roundtrip`   | 5          | 29    |
| `conversion`  | 5          | 104   |

---

## 7. Repository Conventions

### 7.1 TypeScript

- Strict mode enabled. `noUnusedLocals` and `noUnusedParameters` are errors.
- Prefix unused parameters with `_`.
- `@typescript-eslint/no-explicit-any` is an error. Do not use `any`.
- Target ES2022, module system Node16.

### 7.2 Formatting

- Prettier with single quotes, trailing commas, printWidth 100, LF line endings.

### 7.3 Package Manager

- pnpm 11.17.0 with hoisted linker (`node-linker=hoisted` in `.npmrc`).
- Node.js >=20.

### 7.4 Dependency Direction

```
core ← schema ← ir ← parser ← compatibility ← compiler ← conversion
                                                                     ↓
adapter-sdk ← adapters (portable, claude, codex, opencode)
       ↓
apps/cli
```

Additional packages:

- `packages/fs` depends on `@skillbridge/core` only.
- `packages/installer` depends on `@skillbridge/adapter-sdk` and `@skillbridge/core`.
- `packages/skill-test` depends on `@skillbridge/core` and `@skillbridge/schema`.
- `packages/runtime` currently empty (execution deferred to later milestone).

Rules:

- core must not import adapters or commercial modules.
- ir, parser, compatibility, compiler must not import concrete adapters.
- conversion may depend on adapter-sdk interfaces but not concrete adapters.
- No circular dependencies.

### 7.5 Local-First

Everything works locally. No Docker, cloud services, or paid APIs required. Tests use fixtures, temporary directories, and mocks. No environment variables are required (`.env.example` keys are all optional).

---

## 8. Exclusions

The following are explicitly excluded from the open-source 0.1.0-alpha milestone and from `@skillbridge/*` open-source packages. See [OPEN_SOURCE_BOUNDARY.md](./OPEN_SOURCE_BOUNDARY.md) for the full boundary definition.

- Hosted private registries
- Multi-tenant organisations and teams
- Authentication, authorisation, SSO
- Role-based access control
- Centralised policy distribution
- Audit logging as a service
- Hosted compatibility testing and continuous certification
- Analytics, usage metering, cost management
- Public marketplace or skill discovery platform
- Remote model execution or hosted inference
- Managed enterprise deployment
- Premium support services

No open-source package may import code from commercial packages. The `commercial/` directory is documentation-only. Future commercial capabilities will integrate through public interfaces defined in `@skillbridge/adapter-sdk`.
