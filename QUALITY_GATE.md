# Quality Gates

All changes must pass these quality gates before merging:

1. **Formatting**: Prettier check passes with no changes.
2. **Linting**: ESLint passes with zero warnings.
3. **Type Checking**: TypeScript strict mode passes for all packages.
4. **Unit Tests**: All unit tests pass. No meaningless assertions.
5. **Integration Tests**: All integration tests pass.
6. **Round-Trip Tests**: All round-trip tests pass (once implemented).
7. **Conversion Tests**: All conversion tests pass (once implemented).
8. **Build**: All packages build without errors.

## Additional Requirements

- No fake or misleading implementations.
- No silent data loss, permission weakening, or security degradation.
- Unknown fields must never be silently discarded.
- Diagnostics must be explicit for unsupported or lossy behavior.
- Tests must be added for every behavior change.
- Documentation must be updated for architectural changes.
- Environment variables must never be required for basic functionality.
