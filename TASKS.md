# Tasks

## Completed

- [x] **documentation**: Define SkillBridge 0.1.0-alpha product specification (SPECIFICATION.md), rewrite implementation backlog (TASKS.md), update ROADMAP.md
- [x] **architecture**: Implement package dependency boundary enforcement — dependency-cruiser config, 50 boundary tests, ARCHITECTURE.md allowed-import matrix, `pnpm depcheck` in verify pipeline

## Current Sprint — Core Foundations

- [x] **core**: Add `DiagnosticCollector` utility, `ValidationError`, `SourceLocation`, error codes, and serialization
- [x] **schema**: Implement `@skillbridge/schema` with `Schema<T>`, all constructors, `validate`
- [x] **ir**: Add `NormalizedSkill`, `ResolvedIR`, `CompiledIR` types; validation functions; version migration
- [x] **parser**: Implement package specification — SKILL.md parser, skillbridge.yaml validator, resource discovery, path safety, fixtures; all with `Diagnostic` output
  - [x] **parser/enhance**: Add source-location tracking, absent-vs-malformed distinction, line-ending normalization, extension-field preservation, and structured diagnostics to `parseSkillMd()`

## Backlog — Core Abstractions

- [x] **compatibility**: Define `CapabilityMap`, `compareCapabilities()`, `CompatibilityReport`, `assessSecurityImpact()`
  - [x] **compatibility/reports**: Expand `CompatibilityLevel` with `partial`/`unknown`, add `SemanticDegradation`/`MissingResource`/`Assumption` types, `CompatibilityReportFormatter`, `generateCompatibilityReport()`, security integration, unknown safeguard
- [x] **fs**: Implement safe filesystem loader with path safety, symlink protection, size/count limits, and file classification
- [x] **compiler**: Implement `CompilationManifest`, deterministic output writer, manifest serialization
- [x] **conversion**: Implement `ConversionPipeline`, `ConversionResult`, adapter selection strategy
  - [x] **conversion/normalize**: Implement source-document-to-IR normalization pipeline with provenance, deterministic merge, body-section mapping, conflict detection, and extension preservation
  - [x] **conversion/orchestrator**: Implement full pipeline orchestration with compatibility analysis, policy enforcement, manifest generation, output verification, field provenance tracking
- [x] **adapter-sdk**: Extend `Adapter` with `install()`/`verify()`/`uninstall()`/`invoke()`/`installPlan()`; add `AdapterRegistry`, `ConversionContext`, `InstallPlan`, `AdapterError` types
- [x] **registry-local**: Implement `LocalAdapterRegistry` with detection ranking, confidence scoring, ambiguity detection, and version-aware adapter storage
- [x] **testing**: Implement `InMemoryTestAdapter`, `AdapterContract` test suite, expanded SKILL.md/testing fixtures

## Backlog — Initial Adapters

- [x] **adapter/portable**: Implement `detect()`, `parse()`, `compile()`; declare manifest; surface diagnostics
- [x] **adapter/opencode**: Implement full adapter — detect, parse, normalize, compile, installPlan, install, uninstall, verify; 44 unit + 12 integration + 6 roundtrip tests + contract; 2 HIGH + 2 MEDIUM + 3 LOW findings fixed during repair
  - [x] **adapter/opencode/research**: Produce specification, field mapping, permission model, fixtures plan. See `adapters/opencode/specification.md` and `fixtures-plan.md`.
- [x] **adapter/claude**: Implement full adapter — detect, parse, normalize, compile, installPlan, install, uninstall, verify; 32 fixtures; 61 unit + 11 integration + 9 roundtrip tests + contract; 3 LOW findings
  - [x] **adapter/claude/research**: Document source format, frontmatter fields, discovery paths, invocation, permissions, unsupported behavior, fixture plan, specs, ACs. See `adapters/claude/specification.md` and `fixtures-plan.md`.
- [x] **adapter/codex**: Implement full adapter — detect, parse, normalize, compile, installPlan, install, uninstall, verify; companion file handling; open-standard preservation; 16 fixtures; 45+ unit + 10+ integration + 5+ roundtrip tests + contract
  - [x] **adapter/codex/research**: Document source format, frontmatter fields, discovery paths, invocation, permissions, `agents/openai.yaml` companion file, cross-agent comparison, limitations, unknowns, fixture plan. See `adapters/codex/specification.md` and `fixtures-plan.md`.

## Backlog — CLI and Integration

- [x] **cli**: Implement CLI foundation with `skillbridge convert`, `skillbridge list-adapters`, `--help`, `--version`, `--json`, structured errors, exit codes; 20 unit + 10 integration tests
- [x] **cli**: Implement 6 CLI subcommands — `parse`, `validate`, `inspect`, `adapters`, `capabilities`, `doctor`; 32 unit + 13 integration tests; secret redaction
- [x] **cli**: Implement `convert --output-dir`, `--dry-run`, `--overwrite`; add `compile` command; 11 end-to-end conversion tests
- [x] **installer**: Implement `@skillbridge/installer` package — scope resolution, conflict detection, integrity manifests, dry-run output, backup plans; 33 unit + 5 integration tests
- [x] **cli**: Implement `skillbridge install`, `uninstall`, `list`, `verify`, `repair` subcommands with atomic executor, backup, rollback
- [ ] **cli**: Add conversion-pipeline integration to `install`/`repair` commands
- [ ] **integration**: Write cross-package integration tests for full pipeline flows
- [ ] **roundtrip**: Write round-trip conversion tests for each adapter pair
- [ ] **conversion**: Write pipeline conversion tests for end-to-end scenarios

## Backlog — Testing and Quality

- [x] **compatibility**: Implement permission and trust inspection system — categorize, summarize, compare permissions; PolicyHook callbacks; safety disclaimer
- [x] **skill-test**: Implement `@skillbridge/skill-test` — skill-test spec, types, validation, 11 assertion types, fixtures, 19 unit tests
- [ ] **testing**: Replace all placeholder test suites with meaningful tests
- [ ] **testing**: Write adapter contract tests — each adapter must pass the same contract suite
- [ ] **fixtures**: Add fixture SKILL.md files for every source format and edge case

## Future — Deferred to Post-0.1.0-alpha

- [ ] **runtime**: Execution sessions, context assembly, permission gates, tool bridges
- [ ] **runtime**: Local execution sandbox
- [ ] **registry**: Remote registry protocol
- [ ] **community**: Adapter plugin API for third-party adapters
- [ ] **docs**: End-to-end tutorial and migration guides
