# Contributing to SkillBridge

Thank you for considering contributing to SkillBridge. This document provides guidelines and expectations for contributors.

## Quick Links

- [Developer Guide](./docs/guides/developer-guide.md) — full development setup and workflow
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Architecture](./ARCHITECTURE.md)
- [Specification](./SPECIFICATION.md)
- [Roadmap](./ROADMAP.md)

## Before You Start

- Review the [known limitations](./docs/known-limitations.md) to understand what is and isn't implemented
- Check open issues for existing discussions
- For significant changes, open an issue first to discuss the approach

## Development Setup

```bash
git clone https://github.com/skillbridge/skillbridge.git
cd skillbridge
pnpm install
pnpm verify
```

Requirements: Node.js 20+, pnpm 11.17.0.

## Code Standards

- TypeScript strict mode enabled
- `noUnusedLocals` and `noUnusedParameters` are errors — prefix unused params with `_`
- `@typescript-eslint/no-explicit-any` is an error — do not use `any`
- Prettier formatting (single quotes, trailing commas, LF)
- All code must pass `pnpm verify` before submission

## Architecture Rules

- No direct pairwise converters (no "Claude-to-Codex" adapter)
- Every conversion passes through the SkillBridge IR
- `core` must not import adapters or commercial modules
- Unknown fields must never be silently discarded
- Permissions must never be silently weakened
- Lossy mappings must produce explicit diagnostics

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Make your changes
4. Run `pnpm verify` locally
5. Add or update tests as needed
6. Commit with a descriptive message
7. Push and open a pull request

### PR Checklist

- [ ] `pnpm verify` passes
- [ ] Tests added for new behavior
- [ ] Tests cover error paths
- [ ] Documentation updated (if API or behavior changes)
- [ ] No `any` types introduced
- [ ] No new pairwise converters
- [ ] No silent permission weakening

## Testing

All tests run under Vitest in four projects:

| Project       | Pattern                                                    | Purpose                  |
| ------------- | ---------------------------------------------------------- | ------------------------ |
| `unit`        | `**/*.test.ts` (excludes integration/roundtrip/conversion) | Per-unit behavior        |
| `integration` | `**/integration/**/*.test.ts`                              | Cross-package flows      |
| `roundtrip`   | `**/roundtrip/**/*.test.ts`                                | Bidirectional conversion |
| `conversion`  | `**/conversion/**/*.test.ts`                               | Full pipeline conversion |

Run focused tests during development:

```bash
pnpm test:unit
pnpm test:integration
pnpm test:conversion
```

## Questions?

Open a [Discussion](https://github.com/skillbridge/skillbridge/discussions) for questions, ideas, and general conversation.
