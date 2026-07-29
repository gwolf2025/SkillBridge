# SkillBridge Developer Guide

**Write an AI skill once. Run it anywhere.**

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Repository Architecture](#3-repository-architecture)
4. [Building and Verifying](#4-building-and-verifying)
5. [Windows PowerShell Workflows](#5-windows-powershell-workflows)
6. [WSL Notes (Optional)](#6-wsl-notes-optional)
7. [Test Strategy](#7-test-strategy)
8. [Adapter Development](#8-adapter-development)
9. [Fixtures](#9-fixtures)
10. [Conversion Pipeline](#10-conversion-pipeline)
11. [Permission Preservation](#11-permission-preservation)
12. [Release Boundaries](#12-release-boundaries)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

- **Node.js** 20.x or later (LTS recommended)
- **pnpm** 11.17.0 — install via `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@11.17.0 --activate`
- **Git** with `core.autocrlf` set to `input` on Windows (see §5)
- A **Windows** development environment (PowerShell 5.1). WSL 2 is optional.

## 2. Quick Start

```powershell
# Clone and enter the repository
git clone https://github.com/skillbridge/skillbridge.git
cd skillbridge

# Install dependencies (hoisted linker)
pnpm install

# Run the full verification pipeline (9 gates)
pnpm verify

# Run focused test suites
pnpm test:unit
pnpm test:integration
pnpm test:roundtrip
pnpm test:conversion
```

## 3. Repository Architecture

SkillBridge is a pnpm monorepo with 16+ workspace packages, 4 adapters, and a CLI application.

### Package Responsibility

| Package                   | Purpose                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`           | Domain primitives, `Result<T,E>`, `Diagnostic`, `SkillBridgeError`, `DiagnosticCollector`                                                                                                                                              |
| `packages/schema`         | Runtime schemas, validation primitives (`stringSchema`, `objectSchema`, `arraySchema`, etc.)                                                                                                                                           |
| `packages/ir`             | Vendor-neutral IR types (`NormalizedSkill`, `Permission`, `Capability`, `Provenance`), `CAPABILITY_VOCABULARY`                                                                                                                         |
| `packages/parser`         | Source/package parsing, `parseSkillMd()`, `parseSkillbridgeYaml()`, `loadPackage()`, `discoverResources()`                                                                                                                             |
| `packages/compatibility`  | Capability comparison (`analyzeCompatibility`, `CompatibilityReport`), security impact (`assessSecurityImpact`), permission inspection (`inspectPermissions`, `PermissionInspectionReport`), matrix formatting (`CompatibilityMatrix`) |
| `packages/compiler`       | Atomic output writer (`AtomicOutputWriter`), checksums (`computeSha256`, `hashFile`), deterministic output (`canonicalStringify`), manifest generation (`writeManifest`)                                                               |
| `packages/conversion`     | Pipeline orchestration (`ConversionPipeline.run()`), IR normalization (`normalizePackageToIR`), policy enforcement, field provenance                                                                                                   |
| `packages/runtime`        | Execution sessions, permission gates, tool bridges (stub — no implementation)                                                                                                                                                          |
| `packages/adapter-sdk`    | Public `Adapter` interface, `AdapterManifest`, `AdapterRegistry`, `ConversionContext`, `InstallPlan`                                                                                                                                   |
| `packages/registry-local` | Adapter registry (`LocalAdapterRegistry` implements `AdapterSelector`), package cache (`SkillPackageCache`)                                                                                                                            |
| `packages/installer`      | Installation planning (`plan`), conflict detection, integrity manifests, dry-run formatting, atomic executor (`execute`), verification (`verifyInstalled`), repair                                                                     |
| `packages/testing`        | Shared fixtures, `InMemoryTestAdapter`, `describeAdapterContract` contract test suite, 5 example skills                                                                                                                                |
| `packages/skill-test`     | Skill test specification types, validation (`validateSkillTest`), mock test runner (`runSuite`), JSON/JUnit reporters                                                                                                                  |
| `packages/fs`             | Safe filesystem loader, path safety, symlink protection, size/count limits                                                                                                                                                             |
| `adapters/portable`       | Portable Agent Skills adapter                                                                                                                                                                                                          |
| `adapters/claude`         | Claude Code Agent Skills adapter                                                                                                                                                                                                       |
| `adapters/codex`          | OpenAI Codex Agent Skills adapter                                                                                                                                                                                                      |
| `adapters/opencode`       | OpenCode agent/command adapter                                                                                                                                                                                                         |
| `apps/cli`                | Command-line application with `convert`, `compile`, `parse`, `validate`, `inspect`, `adapters`, `capabilities`, `doctor`, `install`, `uninstall`, `list`, `verify`, `repair` commands                                                  |

### Dependency Direction

```
core ← schema ← ir ← parser ← compatibility ← compiler ← conversion
                                                                    ↓
adapter-sdk ← adapters (portable, claude, codex, opencode)
       ↓
apps/cli
```

- `core` must not import adapters or commercial modules
- `ir`, `parser`, `compatibility`, `compiler` must not import concrete adapters
- `conversion` may depend on `adapter-sdk` interfaces but not concrete adapters
- No open-source package may import commercial code
- No circular dependencies between workspace packages

### Allowed-Import Matrix

Entries in this table are defined by `ARCHITECTURE.md` and enforced by `.dependency-cruiser.js` and `packages/core/src/integration/boundary.test.ts` (55 tests).

|                    | core | schema | ir  | parser | compat | compiler | conversion | runtime | adapter-sdk | registry-local | testing | adapters | cli |
| ------------------ | ---- | ------ | --- | ------ | ------ | -------- | ---------- | ------- | ----------- | -------------- | ------- | -------- | --- |
| **core**           | —    | —      | —   | —      | —      | —        | —          | —       | —           | —              | —       | ✗        | —   |
| **schema**         | ✓    | —      | —   | —      | —      | —        | —          | —       | —           | —              | —       | ✗        | —   |
| **ir**             | ✓    | ✓      | —   | —      | —      | —        | —          | —       | —           | —              | —       | ✗        | —   |
| **parser**         | ✓    | —      | ✓   | —      | —      | —        | —          | —       | —           | —              | —       | ✗        | —   |
| **compat**         | ✓    | —      | ✓   | —      | —      | —        | —          | —       | —           | —              | —       | ✗        | —   |
| **compiler**       | ✓    | —      | —   | —      | —      | —        | —          | —       | —           | —              | —       | ✗        | —   |
| **conversion**     | ✓    | —      | ✓   | ✓      | ✓      | —        | —          | —       | ✓           | ✓              | —       | ✗        | —   |
| **runtime**        | ✓    | —      | ✓   | —      | —      | ✓        | —          | —       | ✓           | —              | —       | —        | —   |
| **adapter-sdk**    | ✓    | —      | ✓   | —      | —      | —        | —          | —       | —           | —              | —       | —        | —   |
| **registry-local** | ✓    | —      | —   | —      | —      | —        | —          | —       | ✓           | —              | —       | —        | —   |
| **testing**        | ✓    | —      | ✓   | ✓      | —      | —        | —          | —       | ✓           | —              | —       | —        | —   |
| **adapters**       | ✓    | —      | ✓   | ✓      | —      | —        | —          | —       | ✓           | —              | —       | ✗        | —   |
| **cli**            | ✓    | —      | ✓   | ✓      | ✓      | ✓        | ✓          | —       | ✓           | ✓              | ✓       | ✓        | —   |

## 4. Building and Verifying

### All 9 Gates (in order)

```powershell
pnpm verify
```

This runs these gates sequentially:

1. **`pnpm format:check`** — Prettier check (single quotes, trailing commas, printWidth 100, lf)
2. **`pnpm lint`** — ESLint with `--max-warnings 0`, `@typescript-eslint/no-explicit-any: error`
3. **`pnpm depcheck`** — dependency-cruiser (no circular deps, no forbidden imports)
4. **`pnpm typecheck`** — TypeScript strict mode (`tsc -p tsconfig.typecheck.json --noEmit`)
5. **`pnpm test:unit`** — Vitest unit tests
6. **`pnpm test:integration`** — Vitest integration tests
7. **`pnpm test:roundtrip`** — Vitest roundtrip tests
8. **`pnpm test:conversion`** — Vitest conversion tests
9. **`pnpm build`** — `pnpm -r build` (TypeScript compilation)

### Individual Commands

| Command                 | Purpose                               |
| ----------------------- | ------------------------------------- |
| `pnpm install`          | Install dependencies (hoisted linker) |
| `pnpm build`            | Compile all packages                  |
| `pnpm clean`            | Remove `dist/` from all packages      |
| `pnpm format`           | Format all files with Prettier        |
| `pnpm lint`             | ESLint check                          |
| `pnpm typecheck`        | TypeScript type check                 |
| `pnpm test:unit`        | Run unit tests only                   |
| `pnpm test:integration` | Run integration tests only            |
| `pnpm test:roundtrip`   | Run roundtrip tests only              |
| `pnpm test:conversion`  | Run conversion tests only             |

### Focused Test Patterns

Run specific packages:

```powershell
pnpm test:unit --project unit packages/compatibility
pnpm test:unit --project unit packages/installer apps/cli
pnpm test:integration --project integration packages/installer
pnpm test:conversion --project conversion apps/cli
```

## 5. Windows PowerShell Workflows

The host development platform is Windows with PowerShell 5.1.

### Node.js and pnpm Setup

```powershell
# Install Node.js 20+ (use nvm-windows or official installer)
# Verify:
node --version  # v20.x or later

# Install pnpm
npm install -g pnpm
pnpm --version  # 11.17.0
```

### Git Line-Ending Configuration

PowerShell commands use `;` for chaining and `if ($?)` for conditionals (not `&&`):

```powershell
# Clone with LF line endings (required for Prettier checks)
git config --global core.autocrlf input
git clone https://github.com/skillbridge/skillbridge.git
cd skillbridge

# Build and verify
pnpm install; if ($?) { pnpm verify }
```

### Running Commands

```powershell
# Sequential commands (not &&)
pnpm test:unit; if ($?) { pnpm test:integration }

# Filter by test name
pnpm test:unit --project unit -t "manifest"

# Watch mode
pnpm test:unit --project unit --watch
```

## 6. WSL Notes (Optional)

WSL 2 with Ubuntu or Debian provides a familiar Linux environment:

```bash
# Inside WSL
sudo apt install nodejs npm
npm install -g pnpm
git clone https://github.com/skillbridge/skillbridge.git
cd skillbridge
pnpm install
pnpm verify
```

**Differences from Windows PowerShell:**

- Use `&&` instead of `; if ($?)` for sequential commands
- Shell scripts in `scripts/` directories may require executable permissions (`chmod +x`)
- Path separators are `/` (forward slash)
- Temp directories use `/tmp/` instead of `%TEMP%`

## 7. Test Strategy

### Vitest Workspace (4 projects)

The file `vitest.workspace.ts` defines four test projects:

| Project       | Path Pattern                                                                                                                              | Purpose                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `unit`        | `packages/*/src/**/*.test.ts`, `adapters/*/src/**/*.test.ts`, `apps/*/src/**/*.test.ts` (excluding integration/, roundtrip/, conversion/) | Pure unit tests, no filesystem or cross-package       |
| `integration` | `**/integration/**/*.test.ts`                                                                                                             | Filesystem I/O, cross-package flows, temp directories |
| `roundtrip`   | `**/roundtrip/**/*.test.ts`                                                                                                               | Parse → compile → re-parse identity verification      |
| `conversion`  | `**/conversion/**/*.test.ts`                                                                                                              | End-to-end conversion pipeline, adapter matrix        |

### Adapter Contract Tests

Every adapter must pass the same contract suite via `describeAdapterContract()`:

```typescript
import { describeAdapterContract } from '@skillbridge/testing';

describeAdapterContract(myAdapter, {
  source: '...',
  normalized: { ... },
  detectRejectInput: '',
});
```

### Test Requirements

- Every behavior change must include tests
- Tests must be meaningful — no `expect(true).toBe(true)` placeholders
- All tests use isolated temp directories for filesystem operations
- No test accesses real user directories (homedir, `.config`, etc.)

## 8. Adapter Development

### Adapter Interface

Every adapter implements the `Adapter<TSource, TTarget, TNormalized>` interface from `@skillbridge/adapter-sdk`:

```typescript
interface Adapter<TSource, TTarget, TNormalized> {
  manifest: AdapterManifest;
  detect(source: TSource): boolean;
  parse(source: TSource): TNormalized;
  normalize?(source: TSource, parsed: TNormalized): NormalizedSkill;
  compile(normalized: TNormalized): TTarget;
  installPlan?(context: ConversionContext<TSource, TNormalized>): InstallPlan;
  install?(context: ConversionContext<TSource, TNormalized>): Result<void, Diagnostic[]>;
  uninstall?(context: ConversionContext<TSource, TNormalized>): Result<void, Diagnostic[]>;
  verify?(context: ConversionContext<TSource, TNormalized>): Result<boolean, Diagnostic[]>;
  invoke?(context: ConversionContext<TSource, TNormalized>): Result<TTarget, Diagnostic[]>;
}
```

### AdapterManifest

```typescript
interface AdapterManifest {
  name: string;
  version: string;
  vendor: string;
  adapterVersion: string;
  supports: { sourceFormats: string[]; targetFormats: string[] };
  capabilities: AdapterCapability[];
  description?: string;
  homepage?: string;
  extensions?: Record<string, unknown>;
}
```

Capabilities include: `'detect'`, `'parse'`, `'normalize'`, `'compile'`, `'install-plan'`, `'install'`, `'uninstall'`, `'invoke'`, `'verify'`.

### Diagnostic Codes

Adapters use diagnostic codes matching their name prefix (e.g., `CLAUDE-001`, `CODEX-001`, `OPENCODE-001`). The convention is `{ADAPTER-PREFIX}-{NNN}`.

### Testing with InMemoryTestAdapter

```typescript
import { InMemoryTestAdapter } from '@skillbridge/testing';

const adapter = new InMemoryTestAdapter({
  manifest: { name: 'test', version: '1.0.0', vendor: 'test', ... },
  trackCalls: true,
});
```

### Registering an Adapter

```typescript
import { LocalAdapterRegistry } from '@skillbridge/registry-local';
import myAdapter from './my-adapter.js';

const registry = new LocalAdapterRegistry();
registry.register(myAdapter);
```

## 9. Fixtures

### Shared Fixtures (`@skillbridge/testing`)

The `@skillbridge/testing` package exports these fixture constants:

| Export                         | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `minimalSkillMd`               | Minimal SKILL.md (no frontmatter, no body)  |
| `fullSkillMd`                  | SKILL.md with frontmatter and body sections |
| `minimalFrontmatterSkillMd`    | SKILL.md with minimal frontmatter           |
| `badYamlSkillMd`               | SKILL.md with malformed YAML frontmatter    |
| `arrayFrontmatterSkillMd`      | SKILL.md with array frontmatter (invalid)   |
| `validSkillbridgeYaml`         | Valid skillbridge.yaml                      |
| `unknownFieldsSkillbridgeYaml` | skillbridge.yaml with unknown fields        |
| `badYamlSkillbridgeYaml`       | Malformed skillbridge.yaml                  |
| `minimalSkillbridgeYaml`       | Minimal skillbridge.yaml                    |
| `validPackageManifest`         | Pre-built valid package manifest object     |
| `emptySkillMd`                 | Empty string fixture                        |

### Example Skills

Five Apache-2.0 example skills are available at `fixtures/examples/` and exported as named constants:

| Export                 | Type                       | Capabilities                                |
| ---------------------- | -------------------------- | ------------------------------------------- |
| `HELLO_WORLD_SKILL`    | Simple                     | `file-read`                                 |
| `FILE_ORGANIZER_SKILL` | Intermediate               | `file-read`, `file-write`, `list-directory` |
| `SECRET_ROTATOR_SKILL` | Permission-sensitive       | `secrets`, `env-read`                       |
| `CODE_ANALYZER_SKILL`  | Resource-bearing           | `file-read`, `command-exec`, `search-files` |
| `VENDOR_HOOKS_SKILL`   | Intentionally incompatible | `hooks`, `subagent`                         |

All example skills are labeled `DEMONSTRATION ONLY — Not intended for production use.`

## 10. Conversion Pipeline

### Policy Modes

The `ConversionPipeline.run()` accepts three `PolicyMode` values:

| Mode             | Behaviour                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`         | Blocks conversion on any non-native capability. Only capabilities with `native` support level are allowed.                            |
| `safe` (default) | Blocks on security weakening, warns on missing/degraded capabilities. Capabilities with `emulated` support are allowed with warnings. |
| `permissive`     | Allows conversion with explicit diagnostics for all degradations. No capabilities are blocked.                                        |

The deprecated `'relaxed'` policy was removed — its use now produces a `CONV-012` error diagnostic.

### Policy Decisions

The `PolicyResult` contains an array of `PolicyDecision` objects:

```typescript
type PolicyDecision = {
  type:
    'degradation' | 'missing-resource' | 'assumption' | 'security-impact' | 'unknown-capability';
  action: 'allow' | 'warn' | 'block';
  detail: string;
  diagnostic?: Diagnostic;
};
```

### Conversion Steps

1. **Select source adapter** — via `AdapterSelector.selectSourceAdapter()`
2. **Select target adapter** — via `AdapterSelector.selectTargetAdapter()`
3. **Parse** — `sourceAdapter.parse(source)`
4. **Normalize** — `sourceAdapter.normalize(source, parsed)` → `NormalizedSkill`
5. **Analyze compatibility** — `analyzeCompatibility()` compares source capabilities against target profile
6. **Assess security impact** — `assessSecurityImpact()` compares source vs target permissions
7. **Apply policy** — `applyPolicy()` evaluates compatibility/security results against policy mode
8. **Compile** — `targetAdapter.compile(parsed)` produces target output
9. **Verify** — `targetAdapter.verify()` (if available) checks output integrity

## 11. Permission Preservation

### Security Impact Assessment

The `assessSecurityImpact()` function in `@skillbridge/compatibility` compares required permissions against declared permissions:

```typescript
interface SecurityImpactReport {
  preservedPermissions: PermissionComparison[];
  weakenedPermissions: PermissionComparison[];
  addedPermissions: PermissionComparison[];
  removedPermissions: PermissionComparison[];
  diagnostics: Diagnostic[];
}
```

### Rules

- Permissions must never be **silently weakened** — any reduction in actions produces a diagnostic
- Permissions expanded beyond the source produce `addedPermissions` entries
- Permissions removed from source produce `removedPermissions` entries
- Security policy in `strict` and `safe` modes blocks on weakening
- All diagnostics are surfaced through the pipeline result

### Permission Inspection

The `inspectPermissions()` function compares source and compiled `NormalizedSkill` permissions:

```typescript
inspectPermissions(source, compiled, hooks?): PermissionInspectionReport
```

The report includes category summaries (filesystem, shell, network, secrets, etc.), per-resource comparisons (preserved/weakened/expanded/new/removed), provenance preservation, and `PolicyHook` callback integration.

**Disclaimer:** `"Static inspection does not prove a skill is safe"` — always included in both `toText()` and `toJSON()` output.

## 12. Release Boundaries

### Open Source (Apache 2.0)

The following are and will remain open source:

- All adapter interoperability code (IR, parser, compiler, pipeline)
- All format converters and policy engines
- All testing infrastructure
- Local-only registry and installer

### Future Commercial (Separate, Optional)

The following may become commercial capabilities in future releases:

- Hosted registries and package discovery services
- SSO and team management features
- Audit logging and compliance reporting
- Analytics and usage dashboards

### Boundary Rule

No open-source package may import from the `commercial/` directory. This is enforced by `.dependency-cruiser.js` and boundary tests in `packages/core/src/integration/boundary.test.ts`. See `OPEN_SOURCE_BOUNDARY.md` for details.

## 13. Troubleshooting

### ESLint `--max-warnings 0`

The lint gate rejects any warning. Fix all warnings before committing:

```powershell
pnpm lint
```

Common violations: unused variables (prefix with `_`), `any` type (use `unknown`), unescaped regex special characters.

### `no-explicit-any: error`

TypeScript's `any` is forbidden. Use `unknown` with type guards instead:

```typescript
// Incorrect
function parse(value: any): string { ... }

// Correct
function parse(value: unknown): string {
  if (typeof value !== 'string') throw new Error();
  return value;
}
```

### TypeCheck in Strict Mode

`tsconfig.base.json` enables `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. Ensure all parameters are used or prefixed with `_`.

### Missing Peer Dependencies

If `pnpm install` reports missing peer dependencies:

```powershell
pnpm install --no-strict-peer-dependencies
```

### Hoisted Linker Quirks

With `node-linker=hoisted`, workspace package symlinks may fail on Windows (EISDIR error). If this occurs:

1. Remove the problematic package from the dependent's `package.json` dependencies
2. Use relative imports directly (e.g., `../../../packages/core/src/index.js`)
3. Run `pnpm install` again

### ESLint Ignores Generated Code

The `dist/` and `node_modules/` directories are excluded from linting. If you see errors from `dist/`, you may need to run `pnpm clean` first.

### Windows Path Separators

The codebase normalizes paths to POSIX (`/`) for display and comparison. Use `toPosixPath()` from `@skillbridge/installer` or manual `.replace(/\\/g, '/')` for cross-platform consistency.

### `pnpm clean` Not Cleaning

`pnpm clean` runs `rimraf dist` in each workspace package. If `dist/` persists:

```powershell
pnpm clean; Remove-Item -Recurse -Force node_modules; pnpm install
```

### Test Isolation

Filesystem tests must use `mkdtempSync` from `node:fs` or `os.tmpdir()`-based temp directories. Never write to real user directories like `~/.agents/` or `~/.config/` in tests.

### Format Check Fails After Edit

Prettier enforces consistent formatting. Run `pnpm format` before committing to auto-fix:

```powershell
pnpm format
pnpm format:check  # verify
```
