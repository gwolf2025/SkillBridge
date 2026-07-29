---
name: secret-rotator
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Rotates secrets stored in environment variables.
capabilities:
  - secrets
  - env-read
permissions:
  - resource: secret:*
    actions:
      - read
      - write
  - resource: env:*
    actions:
      - read
---

# Secret Rotator

Rotate secrets by generating new values and updating environment configuration.

## Security

- Requires read/write access to secrets
- Requires read access to environment variables
- Never logs secret values to output
