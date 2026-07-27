# Roadmap

## Phase 0: Repository Foundation (complete)

- [x] Repository structure and package boundaries
- [x] Build tooling and configuration
- [x] Testing foundation
- [x] CI pipeline
- [x] Core domain primitives (`Result`, `Diagnostic`, `SkillBridgeError`)
- [x] SkillBridge IR schema types (`IRPackage`, `CapabilityRequirement`)
- [x] Adapter SDK interfaces (`Adapter`, `AdapterManifest`)
- [x] Documentation (architecture, specification, boundary, workflow, agents)
- [x] Loop-engineering workflow (OpenCode agents and commands)

## Phase 1: 0.1.0-alpha — MVP Pipeline

### Core Foundations

- [ ] **core**: DiagnosticCollector and ValidationError
- [ ] **schema**: SkillSchema, version resolver, field-level validation
- [ ] **ir**: NormalizedSkill, ResolvedIR, CompiledIR; validation; version migration
- [ ] **parser**: SKILL.md frontmatter and body parser; resource discovery; diagnostics

### Core Abstractions

- [ ] **compatibility**: Capability comparison, compatibility reports, security impact
- [ ] **compiler**: Compilation manifest, deterministic output
- [ ] **conversion**: Pipeline orchestration, adapter selection
- [ ] **adapter-sdk**: Full interface surface, registry, conversion context
- [ ] **registry-local**: Local package cache
- [ ] **testing**: Fixtures, mock helpers, contract test suite

### Initial Adapters

- [ ] Portable adapter
- [ ] OpenCode adapter
- [ ] Claude Code adapter
- [ ] OpenAI Codex adapter

### CLI

- [ ] `skillbridge convert` subcommand
- [ ] `skillbridge list-adapters` subcommand
- [ ] Real command dispatch replacing pre-alpha stub

### Testing and Quality

- [ ] Replace all placeholder test suites
- [ ] Adapter contract tests
- [ ] Round-trip conversion tests
- [ ] Pipeline conversion tests
- [ ] Fixture coverage

## Phase 2: Post-0.1.0-alpha

- [ ] Execution abstractions and permission gates
- [ ] Local execution sandbox
- [ ] Tool bridges
- [ ] Remote registry protocol
- [ ] Community adapter plugin API
- [ ] End-to-end tutorials and migration guides

## Future (separate repository or commercial)

- [ ] Hosted private registries
- [ ] Organisations, teams, authentication, SSO
- [ ] Role-based access control
- [ ] Centralised policy distribution
- [ ] Audit logging and analytics
- [ ] Public skill marketplace
- [ ] Remote model execution

This roadmap is provisional and subject to change.
