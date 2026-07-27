# SkillBridge

**Write an AI skill once. Run it anywhere.**

SkillBridge is a vendor-neutral interoperability, conversion, compilation,
validation, installation, testing, and execution layer for reusable AI-agent
skills.

## Core Concept

SkillBridge converts skills created for one agent ecosystem into formats
usable by other agent ecosystems—without creating a separate one-off
converter for every source-target pair.

Every conversion passes through a shared **SkillBridge Intermediate
Representation (IR)**:

```
source skill → source adapter → SkillBridge IR → target adapter → compiled target
```

There are no direct pairwise converters (e.g., "Claude-to-Codex"). All
conversions go through the vendor-neutral IR.

## What SkillBridge Is Not

SkillBridge is **not** another coding agent. It is an interoperability
layer for coding agents and other AI-agent systems.

## Project Status

**Pre-alpha / bootstrap phase.** The repository structure, package
boundaries, build tooling, and documentation are in place. Conversion,
parsing, and compilation functionality have not yet been implemented.
Features are not presented as implemented until they work.

## Planned Initial Adapters

- Portable Agent Skills
- Claude Code
- OpenAI Codex
- OpenCode

## Licensing

The open-source core is licensed under **Apache License 2.0**.

Essential interoperability, parsing, conversion, compilation, basic
adapters, and local testing remain open source. Future commercial
capabilities (hosted registries, SSO, audit logging, etc.) would be
separate and optional.

See [OPEN_SOURCE_BOUNDARY.md](./OPEN_SOURCE_BOUNDARY.md) for details.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- pnpm

### Install

```bash
pnpm install
```

### Run Verification

```bash
pnpm verify
```

This runs formatting checks, linting, type checking, tests, and build.

No paid model APIs are required for local development.

## Documentation

- [Architecture](./ARCHITECTURE.md)
- [Open Source Boundary](./OPEN_SOURCE_BOUNDARY.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Roadmap](./ROADMAP.md)
- [Agent Instructions](./AGENTS.md)
- [Architectural Decisions](./DECISIONS.md)
- [Workflow](./WORKFLOW.md)
- [Quality Gates](./QUALITY_GATE.md)

## Repository Structure

```
apps/
  cli/                    Command-line application
packages/
  core/                   Shared domain primitives
  schema/                 Runtime schemas
  ir/                     SkillBridge IR
  parser/                 Source parsing utilities
  compatibility/          Capability analysis
  compiler/               Target compilation
  conversion/             Conversion orchestration
  runtime/                Execution abstractions
  adapter-sdk/            Adapter public interfaces
  registry-local/         Local package cache
  testing/                Test fixtures and helpers
adapters/
  portable/               Portable adapter
  claude/                 Claude Code adapter
  codex/                  OpenAI Codex adapter
  opencode/               OpenCode adapter
docs/
  architecture/           Architecture documentation
  specifications/         Specifications
  adapters/               Adapter documentation
  guides/                 User guides
examples/
  skills/                 Example skills
  fixtures/               Test fixtures
commercial/               Commercial boundary documentation
```
