# Commercial Services

This directory is **documentation-only**.

No commercial code is included in this repository.

## Boundary

- Future commercial providers will integrate through public interfaces
  defined in `@skillbridge/adapter-sdk` and other shared packages.
- The open-source core (all packages in `packages/`, `adapters/`, and `apps/`)
  must remain fully usable without any commercial service.
- No open-source package may import code from the `commercial/` directory.
- Commercial capabilities (hosted registries, SSO, audit logging, etc.) are
  not part of this repository and will be developed separately.

## Relationship

Commercial services, when available, will provide value-added capabilities
on top of the open-source core. The core interoperability, conversion,
compilation, basic adapters, and local testing will never require a
commercial subscription.
