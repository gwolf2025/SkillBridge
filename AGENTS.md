# SkillBridge Agent Instructions

**Write an AI skill once. Run it anywhere.** Vendor-neutral interoperability and conversion layer for AI-agent skills.

Pre-alpha bootstrap monorepo. 16 workspace packages: 3 with real code (core, ir, adapter-sdk), 8 are JSDoc stubs, 4 adapters (portable, claude, codex, opencode) and CLI app are all stubs. CI workflow exists at `.github/workflows/ci.yml`.

---

## Commands

Verification order (`pnpm verify` runs all):
`pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test:unit` → `pnpm test:integration` → `pnpm test:roundtrip` → `pnpm test:conversion` → `pnpm build`

- `pnpm lint` — ESLint with `--max-warnings 0`, `@typescript-eslint/no-explicit-any: error`
- `pnpm format` — Prettier (single quotes, trailing commas, printWidth 100, lf)
- `pnpm typecheck` / `pnpm build` — recursive (`pnpm -r`)
- `pnpm clean` — recursive (`pnpm -r clean`)
- Focused tests: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:roundtrip`, `pnpm test:conversion`

---

## Architecture

### Conversion Pipeline

Every conversion passes through the vendor-neutral SkillBridge IR:

`source skill → source adapter → SkillBridge IR → capability analysis → target adapter → compiled target`

No direct pairwise converters (e.g., no "Claude-to-Codex"). All conversions through IR.

### Package Responsibilities

| Package                   | Purpose                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `packages/core`           | Domain primitives, `Result<T,E>`, `Diagnostic`, `SkillBridgeError`               |
| `packages/schema`         | Runtime schemas, validation primitives                                           |
| `packages/ir`             | Vendor-neutral IR types and metadata                                             |
| `packages/parser`         | Source/package parsing, markdown, frontmatter                                    |
| `packages/compatibility`  | Capability comparison, degradation analysis                                      |
| `packages/compiler`       | Target-compilation infrastructure, manifests                                     |
| `packages/conversion`     | Pipeline orchestration (detect → parse → normalize → analyze → compile → verify) |
| `packages/runtime`        | Execution sessions, permission gates, tool bridges                               |
| `packages/adapter-sdk`    | Public `Adapter` interface and `AdapterManifest` contract                        |
| `packages/registry-local` | Local package cache                                                              |
| `packages/testing`        | Shared fixtures and test helpers                                                 |
| `apps/cli`                | CLI (stub — prints "pre-alpha" only)                                             |
| `adapters/*`              | Vendor-specific detection, parsing, normalization, compilation                   |

### Dependency Direction

```
core ← schema ← ir ← parser ← compatibility ← compiler ← conversion
                                                                    ↓
adapter-sdk ← adapters (portable, claude, codex, opencode)
       ↓
apps/cli
```

- core must not import adapters or commercial modules
- ir, parser, compatibility, compiler must not import concrete adapters
- conversion may depend on adapter-sdk interfaces but not concrete adapters
- No open-source package may import commercial code
- No circular dependencies between workspace packages

### Open-Source vs Commercial

Essential interop, parsing, conversion, compilation, basic adapters, and local testing remain open source under Apache 2.0. Future commercial capabilities (hosted registries, SSO, audit logging, analytics) would be separate and optional. See `OPEN_SOURCE_BOUNDARY.md`.

---

## Local-First Development

Everything must work locally without Docker, cloud services, or paid APIs. Tests use fixtures, temporary directories, and mocks. No env vars required (`.env.example` keys are all optional).

---

## Testing

- Vitest workspace with 4 projects: `unit`, `integration`, `roundtrip`, `conversion`
- Unit tests: `packages/*/src/**/*.test.ts` (excludes `integration/`, `roundtrip/`, `conversion/`)
- Project-specific tests: `packages/*/src/**/<project>/**/*.test.ts`
- Add tests for every behavior change. Tests must be meaningful (no `assert(true)`).
- Placeholder test suites exist — `'placeholder'.toBeDefined()` is not meaningful

---

## Conventions

- TypeScript strict mode, `noUnusedLocals`, `noUnusedParameters` — prefix unused params with `_`
- ESLint `no-explicit-any: error` — avoid `any` type
- pnpm hoisted linker (`node-linker=hoisted` in `.npmrc`), Node >=20, pnpm 11.17.0

---

## Rules

- Security restrictions must never be silently weakened. Permissions must be preserved or explicitly reported as changed.
- Unknown fields must never be silently discarded. Lossy mappings must produce explicit diagnostics.
- Unsupported behavior must produce explicit diagnostics.
- Original provenance must be retained through conversions.
- No fake implementations that mislead about functionality. Placeholder docs preferred over misleading stubs.
- No silent compatibility loss — adapters must not claim native support for emulated behavior.

---

## Process

- Inspect existing code before editing. Follow existing patterns and conventions.
- Avoid unrelated refactors. Change only what the task requires.
- Update `TASKS.md` when starting/completing work.
- Record irreversible architectural decisions in `DECISIONS.md`.
- Run `pnpm verify` before completing work.

---

## Prohibitions

- No publishing, deploying, pushing, or creating releases without explicit approval.
- No destructive Git operations (force-push, rebase shared branches, delete tags) without explicit approval.
- No committing secrets or API keys.
- No modifying files outside the repository.
