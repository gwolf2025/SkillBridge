# SkillBridge Playground

Local browser interface for exploring the SkillBridge conversion pipeline.

## Status

**Alpha preview.** This is a local-only development tool. No data is sent to any server. No user content is retained or logged.

## Architecture

```
Browser (React + Vite)
  │  HTTP (localhost:5173 → proxy → localhost:3071)
  ▼
Local API (Node.js, tsx)
  │  imports existing @skillbridge/* packages
  ▼
SkillBridge Conversion Pipeline
  │  adapter → IR → compatibility → compiler
  ▼
Result (diagnostics + generated output)
```

## Prerequisites

- Node.js 20+
- pnpm

## Commands

```bash
# Start development (API + frontend)
pnpm playground:dev

# Build for production preview
pnpm playground:build

# Production preview
pnpm playground:preview

# Run API tests
pnpm playground:test

# Playwright E2E tests (headless)
pnpm playground:test:e2e

# Playwright E2E tests (visible browser)
pnpm playground:test:e2e -- --headed

# Playwright HTML report
pnpx playwright show-report apps/playground/playwright-report
```

## Supported Adapters

- Portable
- Claude Code
- OpenAI Codex
- OpenCode

## Security

- The API server binds to `127.0.0.1` only
- Request body limit: 512 KB
- No database, no persistence, no telemetry
- No shell execution
- No arbitrary file access

## Known Limitations

- Preview-quality interface
- No mobile-optimized layout
- No dark/light theme toggle
- No support for JSON or YAML source formats
