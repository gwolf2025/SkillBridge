# SkillBridge Agent Instructions

## Mission

Write an AI skill once. Run it anywhere.

SkillBridge is a vendor-neutral interoperability, conversion, compilation,
validation, installation, testing, and execution layer for reusable AI-agent
skills.

## Architecture Rules

- Every conversion must pass through the SkillBridge Intermediate Representation (IR).
- No direct pairwise converters (e.g., Claude-to-Codex).
- All conversions: source → adapter → IR → capability analysis → target adapter → output.
- core must not import adapters or commercial modules.
- ir, parser, compatibility, compiler must not import concrete adapters.
- conversion may depend on adapter-sdk interfaces but not concrete adapters.
- Open-source packages must never depend on commercial packages.

## Package Dependency Rules

- Core shared packages go in packages/.
- Vendor-specific logic lives in adapters/.
- The CLI app lives in apps/cli.
- No circular dependencies between workspace packages.

## Local-First Development

- Everything must work locally without Docker, cloud services, or paid APIs.
- Tests use fixtures, temporary directories, and mocks.
- GitHub is used only as remote and CI platform.

## Build Commands

- `pnpm build` — build all packages
- `pnpm clean` — clean all build artifacts
- `pnpm lint` — run ESLint
- `pnpm typecheck` — run TypeScript type checking
- `pnpm test` — run all tests
- `pnpm format` — format code with Prettier
- `pnpm verify` — full verification suite

## Testing Expectations

- Add tests for every behavior change.
- Tests must be meaningful (no "assert(true)").
- Use Vitest. Test files end in .test.ts or .spec.ts.
- Integration tests go in integration/ directories.
- Do not fake implementation just to make tests pass.

## Prohibitions

- No fake implementations that would mislead about functionality.
- No silent data loss during conversion.
- No silent weakening of permissions or security restrictions.
- No publishing packages or releases without explicit approval.
- No modifying files outside the repository.
- No destructive Git operations without explicit approval.
- No committing secrets or API keys.

## Documentation Requirements

- Update TASKS.md when starting or completing work.
- Record significant decisions in DECISIONS.md.
- Inspect existing code before editing.
