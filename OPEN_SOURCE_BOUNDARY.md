# Open Source Boundary

## What Belongs in the Open-Source Core

The following are open source under Apache License 2.0 and must remain usable
without commercial services:

- schemas
- SkillBridge IR
- source parsing
- compatibility analysis
- conversion orchestration
- target compilation
- adapter SDK
- official basic adapters
- local validation
- local installation
- local testing
- local execution abstractions
- local registry support
- CLI tools
- documentation
- community plugin support

## What May Become Commercial

The following capabilities may become hosted or enterprise services in the
future but are not included in this repository:

- hosted private registries
- organizations and teams
- authentication and SSO
- role-based access control
- centralized policy distribution
- audit logging
- hosted compatibility testing
- continuous certification
- analytics
- usage and cost management
- managed enterprise deployment
- premium support

## Boundary Rules

- Essential interoperability, parsing, conversion, compilation, basic adapters,
  and local testing must never be placed behind a commercial boundary.
- No open-source package may import commercial code.
- The commercial/ directory is documentation-only.
- Future commercial providers will integrate through public interfaces.
- The open-source core must remain fully usable without any commercial service.
