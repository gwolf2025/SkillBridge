# SkillBridge Architecture

## Conversion Pipeline

Every conversion passes through a shared vendor-neutral Intermediate Representation (IR).

```
source skill
  → source adapter (detect, load, parse)
    → normalized SkillBridge IR
      → capability analysis (requirements vs target)
        → target adapter (compile, emit)
          → compiled target skill package
```

No direct pairwise converters exist. For example, there is no
"Claude-to-Codex" converter. All conversions go through the IR.

## Package Responsibilities

### packages/core

Shared domain primitives, diagnostics, result types, common errors, shared utilities.
No vendor-specific logic.

### packages/schema

Reusable runtime schemas, schema-version handling, validation primitives.
No adapter-specific behavior.

### packages/ir

Vendor-neutral SkillBridge Intermediate Representation.
Source, normalized, resolved, and compiled representations.
Provenance and compatibility metadata.
No dependency on concrete adapters.

### packages/parser

Shared package-loading and source-document parsing utilities.
Markdown and frontmatter utilities.
Safe resource discovery.
No vendor-specific mapping rules.

### packages/compatibility

Capability definitions, capability comparison, degradation analysis,
compatibility reports, security-impact comparison.

### packages/compiler

Shared target-compilation infrastructure.
Deterministic output utilities.
Compilation manifests, checksums.
No vendor-specific target logic.

### packages/conversion

Orchestration of the complete conversion pipeline: source adapter selection,
parsing, normalization, target adapter selection, capability analysis,
compilation, diagnostics, provenance, output verification.
No vendor-specific mappings.

### packages/runtime

Future local execution abstractions: execution sessions, context assembly,
permission gates, tool bridges. No hard dependency on a model provider.

### packages/adapter-sdk

Public interfaces for first-party and third-party adapters.
Adapter manifests, detection, parsing, normalization, capability declaration,
compilation, installation, invocation, verification, diagnostics.

### packages/registry-local

Future local package cache and registry abstractions.
No hosted-service implementation.

### packages/testing

Shared fixtures, adapter contract tests, round-trip test helpers,
compatibility test helpers, conversion test helpers, filesystem safety test helpers.

### apps/cli

Command-line application.
No core business logic that cannot be reused through packages.

### adapters/*

All vendor-specific parsing, normalization, compilation, discovery,
and installation logic. Adapters depend on adapter SDK and shared packages.
Shared core packages must not depend on adapters.

## Dependency Direction

```
core ← schema ← ir ← parser ← compatibility ← compiler ← conversion
                                                                    ↓
adapter-sdk ← adapters (portable, claude, codex, opencode, …)
       ↓
apps/cli
```

- **core** must not import adapters or commercial modules.
- **ir** must not import concrete adapters.
- **parser** must not import concrete adapters.
- **compatibility** must not import concrete adapters.
- **compiler** must not import concrete adapters.
- **conversion** may depend on adapter-sdk interfaces but not concrete adapters.
- Concrete adapters may depend on shared packages.
- CLI may compose adapters and shared packages.
- Open-source packages must never depend on commercial packages.
- Adapter-specific logic must remain inside adapter packages.
- Pairwise source-to-target conversion logic is prohibited.

## Conversion Rules

- Every conversion must pass through the SkillBridge IR.
- Parsing and compilation must remain independently testable.
- Unknown fields must never be silently discarded.
- Unsupported behavior must produce explicit diagnostics.
- Lossy mappings must be clearly identified.
- Security restrictions must never be silently weakened.
- Permissions must be preserved or explicitly reported as changed.
- Supporting files must be retained or explicitly reported as unsupported.
- Original provenance must be retained.
- Original license and notice metadata must be retained.
- Converted output should be deterministic where practical.
- Portable behavior should support round-trip equivalence testing.
- An adapter must not claim native support for behavior it only emulates.
- Conversion success must not imply behavioral equivalence unless tests establish it.

## Open-Source vs Commercial Boundaries

See [OPEN_SOURCE_BOUNDARY.md](./OPEN_SOURCE_BOUNDARY.md) for the full boundary
definition. Core interoperability, parsing, conversion, compilation, basic
adapters, and local testing remain open source.

## Extensibility

Third-party adapters integrate through the adapter-sdk public interfaces.
No changes to core packages are required to add a new adapter.
