# Development Workflow

1. Ensure Node.js 20+ and pnpm are installed.
2. Clone the repository.
3. Run `pnpm install` to install dependencies.
4. Run `pnpm verify` to run the full verification suite.
5. Create a feature branch for your changes.
6. Write tests for behavior changes.
7. Run `pnpm verify` before committing.
8. Commit with clear, descriptive messages.
9. Open a pull request.

## Verification Order

1. Formatting check (`pnpm format:check`)
2. Linting (`pnpm lint`)
3. TypeScript type checking (`pnpm typecheck`)
4. Unit tests (`pnpm test:unit`)
5. Integration tests (`pnpm test:integration`)
6. Round-trip tests (`pnpm test:roundtrip`)
7. Conversion tests (`pnpm test:conversion`)
8. Build (`pnpm build`)
