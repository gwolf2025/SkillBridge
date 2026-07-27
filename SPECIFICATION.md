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

| Step    | Owner                 | Input                  | Output               |
| ------- | --------------------- | ---------------------- | -------------------- |
| Detect  | Source adapter        | Raw bytes or file path | Detection boolean    |
| Load    | Source adapter        | File path              | Source document      |
| Parse   | Source adapter        | Source document        | Normalized IR        |
| Analyse | Compatibility package | Normalized IR          | Compatibility report |
| Compile | Target adapter        | Normalized IR          | Target package       |
| Emit    | Target adapter        | Target package         | Compiled files       |

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

**Status:** Partially implemented. Types and runtime helpers exist.

| Export              | Kind      | Description                                              |
| ------------------- | --------- | -------------------------------------------------------- |
| `Result<T, E>`      | Type      | `{ ok: true, value: T } \| { ok: false, error: E }`      |
| `ok<T>(value: T)`   | Function  | Creates a success result                                 |
| `fail<E>(error: E)` | Function  | Creates a failure result                                 |
| `Severity`          | Type      | `'error' \| 'warning' \| 'info' \| 'debug'`              |
| `Diagnostic`        | Interface | `severity`, `message`, `code?`, `source?`, `location?`   |
| `SkillBridgeError`  | Class     | Error with `code` string and `diagnostics: Diagnostic[]` |

**Required for 0.1.0-alpha:** None — current surface is sufficient. May need `DiagnosticCollector` utility and `ValidationError` type if missing.

### 3.2 `@skillbridge/schema`

**Status:** Stub (JSDoc only).

**Purpose:** Reusable runtime schemas, schema-version handling, validation primitives.

**Required for 0.1.0-alpha:** Define `SkillSchema` type for validating SKILL.md frontmatter. Implement schema-version resolver. Implement field-level validation with `Diagnostic` output.

### 3.3 `@skillbridge/ir`

**Status:** Partially implemented. Type definitions exist.

| Export                  | Kind      | Description                                                                                           |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `IRVersion`             | Type      | `'0.1.0'`                                                                                             |
| `CapabilityRequirement` | Type      | Enum of recognised capabilities                                                                       |
| `SourceFormat`          | Type      | `'markdown' \| 'yaml' \| 'json' \| 'package'`                                                         |
| `SourceMetadata`        | Interface | `format`, `version?`, `path?`                                                                         |
| `IRPackage`             | Interface | `irVersion`, `source`, `name`, `version`, `description?`, `capabilities`, `permissions`, `provenance` |

**Required for 0.1.0-alpha:** Add `NormalizedSkill` type with full skill body representation. Add `ResolvedIR` type combining source IR with resolved dependencies. Add `CompiledIR` type representing the result of compilation with manifest. Add validation functions (`validateIRPackage`). Add IR version migration helpers.

### 3.4 `@skillbridge/parser`

**Status:** Stub (JSDoc only).

**Purpose:** Shared package-loading and source-document parsing utilities. Markdown and frontmatter utilities. Safe resource discovery.

**Required for 0.1.0-alpha:** Implement SKILL.md frontmatter parser (YAML). Implement markdown body parser (section extraction). Implement package-boundary detection. Implement resource file discovery. All parsing must feed diagnostics to `Diagnostic` output.

### 3.5 `@skillbridge/compatibility`

**Status:** Stub (JSDoc only).

**Purpose:** Capability definitions, capability comparison, degradation analysis, compatibility reports, security-impact comparison.

**Required for 0.1.0-alpha:** Define `CapabilityMap` type matching requirements to adapter support. Implement `compareCapabilities()` producing a `CompatibilityReport` with per-capability status (native, emulated, unsupported, degraded). Implement `assessSecurityImpact()` comparing source permissions to target permissions.

### 3.6 `@skillbridge/compiler`

**Status:** Stub (JSDoc only).

**Purpose:** Shared target-compilation infrastructure. Deterministic output utilities. Compilation manifests, checksums.

**Required for 0.1.0-alpha:** Implement `CompilationManifest` type (checksums, file listing, metadata). Implement deterministic output writer. Implement manifest serialisation. No target-specific logic — concrete compilation lives in adapters.

### 3.7 `@skillbridge/conversion`

**Status:** Stub (JSDoc only).

**Purpose:** Orchestration of the complete conversion pipeline.

**Required for 0.1.0-alpha:** Implement `ConversionPipeline` class that chains: adapter detection → parsing → normalisation → capability analysis → compilation → verification. Implement `ConversionResult` type with full diagnostics, provenance chain, and output manifest. Implement adapter selection strategy (source format → matching adapter). May depend on adapter-sdk interfaces but not concrete adapters.

### 3.8 `@skillbridge/runtime`

**Status:** Stub (JSDoc only).

**Purpose:** Future local execution abstractions.

**Required for 0.1.0-alpha:** None. Execution is deferred to a later milestone.

### 3.9 `@skillbridge/adapter-sdk`

**Status:** Partially implemented. Type definitions exist.

| Export                                   | Kind      | Description                                                                                     |
| ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `AdapterCapability`                      | Type      | `'detect' \| 'parse' \| 'normalize' \| 'compile' \| 'install' \| 'invoke' \| 'verify'`          |
| `AdapterManifest`                        | Interface | `name`, `version`, `vendor`, `supportedSourceFormats`, `supportedTargetFormats`, `capabilities` |
| `Adapter<TSource, TTarget, TNormalized>` | Interface | `manifest`, `detect()`, `parse()`, `compile()`                                                  |

**Required for 0.1.0-alpha:** Extend `Adapter` with `install()` and `verify()` methods. Add `AdapterRegistry` for runtime adapter discovery. Add `ConversionContext` type carrying diagnostics and provenance through the pipeline. Add `AdapterError` types.

### 3.10 `@skillbridge/registry-local`

**Status:** Stub (JSDoc only).

**Purpose:** Future local package cache and registry abstractions.

**Required for 0.1.0-alpha:** Implement local package cache directory structure. Implement package install from local filesystem. Implement package listing and metadata queries. No hosted-service dependency.

### 3.11 `@skillbridge/testing`

**Status:** Stub (JSDoc only).

**Purpose:** Shared fixtures, adapter contract tests, round-trip test helpers.

**Required for 0.1.0-alpha:** Implement sample `SKILL.md` fixtures. Implement `createMockAdapter()` helper. Implement `assertRoundTrip()` conversion helper. Implement contract test suite that each adapter must pass.

### 3.12 `apps/cli`

**Status:** Stub (prints "pre-alpha" only).

**Required for 0.1.0-alpha:** Implement `skillbridge convert` subcommand accepting source path, source format, and target format. Implement `skillbridge list-adapters` subcommand. Implement `skillbridge version` subcommand. No core business logic — delegate to packages.

### 3.13 `adapters/*`

All four adapters (portable, claude, codex, opencode) are stubs.

**Required for 0.1.0-alpha:** Each adapter must implement `detect()`, `parse()`, and `compile()` from the Adapter SDK. Each must declare its supported source and target formats in its manifest. Each must surface explicit diagnostics for unsupported capabilities. Adapters must not create pairwise conversion logic.

---

## 4. Adapter Contract

Every adapter MUST:

1. Implement the `Adapter` interface from `@skillbridge/adapter-sdk`.
2. Declare an `AdapterManifest` with accurate `supportedSourceFormats` and `supportedTargetFormats`.
3. Implement `detect(source)` to return `true` only for sources the adapter can handle.
4. Implement `parse(source)` to return a normalized IR package.
5. Implement `compile(normalized)` to return the target-format output.
6. Surface all errors as `Diagnostic` objects via `DiagnosticCollector` or equivalent.
7. Preserve provenance from source through to compiled output.
8. Never silently discard unknown fields — emit a diagnostic for each.

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
  location?: { line: number; column: number };
}
```

### 5.1 Severity Semantics

| Severity  | Meaning                                        | Pipeline Effect   |
| --------- | ---------------------------------------------- | ----------------- |
| `error`   | The conversion cannot proceed                  | Pipeline halts    |
| `warning` | The conversion proceeds with degraded fidelity | Reported to user  |
| `info`    | Informational note about the conversion        | Logged            |
| `debug`   | Detailed debug information                     | Hidden by default |

### 5.2 Diagnostic Codes

TBD per package. Each package should define its own diagnostic code namespace prefixed by the package name (e.g., `PARSER-001`, `COMPAT-001`, `COMPILER-001`).

### 5.3 Error Handling

Pipeline stages use `Result<T, E>` from `@skillbridge/core` to return either a successful value or a `SkillBridgeError` containing one or more `Diagnostic` objects. Stages that produce non-fatal warnings accumulate diagnostics alongside the result.

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
- Placeholder test suites currently assert `'placeholder'.toBeDefined()` — these must be replaced with real tests before 0.1.0-alpha ships.

### 6.3 Fixtures

The `@skillbridge/testing` package provides shared fixtures:

- Sample `SKILL.md` files for each source format
- Pre-built IR packages for testing compilation
- Expected output fixtures for each target adapter

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
