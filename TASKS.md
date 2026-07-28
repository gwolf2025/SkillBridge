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
- [x] **fs**: Implement safe filesystem loader with path safety, symlink protection, size/count limits, and file classification
- [ ] **compiler**: Implement `CompilationManifest`, deterministic output writer, manifest serialization
- [ ] **conversion**: Implement `ConversionPipeline`, `ConversionResult`, adapter selection strategy
  - [ ] **conversion/normalize**: Implement source-document-to-IR normalization pipeline with provenance, deterministic merge, body-section mapping, conflict detection, and extension preservation
- [ ] **adapter-sdk**: Extend `Adapter` with `install()`/`verify()`; add `AdapterRegistry`, `ConversionContext`, `AdapterError` types
- [ ] **registry-local**: Implement package cache directory structure, local install, listing, metadata queries
- [ ] **testing**: Implement sample SKILL.md fixtures, `createMockAdapter()`, `assertRoundTrip()`, contract test suite

## Backlog — Initial Adapters

- [ ] **adapter/portable**: Implement `detect()`, `parse()`, `compile()`; declare manifest; surface diagnostics
- [ ] **adapter/opencode**: Implement `detect()`, `parse()`, `compile()`; declare manifest; surface diagnostics
- [ ] **adapter/claude**: Implement `detect()`, `parse()`, `compile()`; declare manifest; surface diagnostics
- [ ] **adapter/codex**: Implement `detect()`, `parse()`, `compile()`; declare manifest; surface diagnostics

## Backlog — CLI and Integration

- [ ] **cli**: Implement `skillbridge convert` subcommand
- [ ] **cli**: Implement `skillbridge list-adapters` subcommand
- [ ] **cli**: Replace stub `main()` with real command dispatch
- [ ] **integration**: Write cross-package integration tests for full pipeline flows
- [ ] **roundtrip**: Write round-trip conversion tests for each adapter pair
- [ ] **conversion**: Write pipeline conversion tests for end-to-end scenarios

## Backlog — Testing and Quality

- [ ] **testing**: Replace all placeholder test suites with meaningful tests
- [ ] **testing**: Write adapter contract tests — each adapter must pass the same contract suite
- [ ] **fixtures**: Add fixture SKILL.md files for every source format and edge case

## Future — Deferred to Post-0.1.0-alpha

- [ ] **runtime**: Execution sessions, context assembly, permission gates, tool bridges
- [ ] **runtime**: Local execution sandbox
- [ ] **registry**: Remote registry protocol
- [ ] **community**: Adapter plugin API for third-party adapters
- [ ] **docs**: End-to-end tutorial and migration guides
