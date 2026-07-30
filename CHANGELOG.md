# Changelog

## 0.1.0-alpha � 2026-07-30

### Features

- Initial Alpha release of all 14 packages (@skillbridge/core, schema, ir, parser, compatibility, compiler, conversion, adapter-sdk, runtime, registry-local, testing, fs, installer, skill-test)
- Four adapter implementations: portable, claude, codex, opencode
- CLI application with 13 commands: convert, compile, parse, validate, inspect, adapters, capabilities, doctor, install, uninstall, list, verify, repair
- Conversion pipeline with strict/safe/permissive policy modes
- Installation planner with backup, rollback, and integrity verification
- Cross-platform Windows and POSIX support
- Security audit completed � 11 findings fixed

### Limitations

- Pre-alpha quality � APIs may change without notice
- No remote registry or publishing support
- No sandboxed skill execution
- No CI/CD integration

## 0.0.0 — 2026-07-27

- Repository bootstrap.
- Package structure and workspace configuration.
- Build tooling (TypeScript, ESLint, Prettier, Vitest, Changesets).
- Documentation (architecture, open-source boundary, agent instructions).
- No functional conversion, parsing, or compilation code yet.
