# Architectural Decisions

## ADR-001: Vendor-Neutral Intermediate Representation

All conversions pass through a shared SkillBridge IR rather than using
direct pairwise converters. This ensures O(n) adapter count instead of
O(n²) converter count, and guarantees consistent capability analysis.

## ADR-002: Monorepo with pnpm Workspaces

A monorepo structure with clear package boundaries enables independent
versioning, focused testing, and clean separation between shared and
vendor-specific code.

## ADR-003: Strict Conversion Rules

Unknown fields, lossy mappings, permission changes, and unsupported
behavior must produce explicit diagnostics. Silent degradation is never
acceptable.

## ADR-004: Adapter SDK for Extensibility

Third-party and first-party adapters integrate through the adapter-sdk
public interfaces. Core packages never depend on concrete adapters.

## ADR-005: Open Source Core under Apache 2.0

The open-source core includes all essential interoperability,
conversion, compilation, adapters, and local testing. Future commercial
capabilities will be separate and optional.

## ADR-006: Local-First Development

The development model assumes no cloud services, no Docker, and no paid
APIs. Tests use fixtures and mocks.

## ADR-007: No Fake Implementations

Placeholder documentation is preferred over misleading stub
implementations. No function claims to do work it does not perform.

## ADR-008: Repository Bootstrap (2026-07-27)

Initial repository foundation created with:

- pnpm workspace monorepo (17 packages)
- TypeScript strict mode across all packages
- ESLint + Prettier + Vitest + Changesets tooling
- IR type stubs (no conversion logic)
- Adapter SDK interfaces (no concrete adapter logic)
- Documentation (architecture, boundary, workflow, agents)
- Placeholder test suites for integration, roundtrip, conversion
- GitHub Actions CI workflow
- Local-first: no Docker, paid APIs, or cloud services required
