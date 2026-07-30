# Recommended Repository Metadata

The following values should be applied in the GitHub repository settings. They are recommendations, not yet applied.

## GitHub Description

```
Write an AI skill once. Run it anywhere. — Vendor-neutral interoperability layer for AI-agent skills.
```

## Website

```
https://skillbridge.dev
```

## Topics

```
ai, skills, interoperability, conversion, agents, skillbridge, developer-tools, claude-code, openai-codex, opencode
```

## Social Preview

The social preview image should convey the core concept visually: a single SKILL.md flowing through an IR hub and emerging as multiple agent formats.

Suggested approach: "Input → IR → Output" diagram on a dark background with the tagline "Write once. Run anywhere."

## Discussions Categories

| Category         | Purpose                              |
| ---------------- | ------------------------------------ |
| 📣 Announcements | Release notes and project updates    |
| 💡 Ideas         | Feature suggestions and improvements |
| 🙏 Q&A           | Questions and troubleshooting        |
| 🔌 Adapters      | Adapter development and requests     |
| 🗣 General        | General conversation                 |

## Issue Labels

| Label              | Color   | Purpose                       |
| ------------------ | ------- | ----------------------------- |
| `bug`              | #d73a4a | Confirmed bug                 |
| `enhancement`      | #a2eeef | Feature request               |
| `adapter`          | #1d76db | New adapter or adapter change |
| `documentation`    | #0075ca | Documentation                 |
| `good first issue` | #7057ff | Good for new contributors     |
| `help wanted`      | #008672 | Needs contributor             |
| `question`         | #d876e3 | Question                      |
| `security`         | #e99695 | Security-related              |
| `blocker`          | #b60205 | Blocks release                |
| `alpha`            | #0052cc | v0.1.0-alpha scope            |

## Branch Protection Rules

Branch: `main`

- Require pull request reviews (1 minimum)
- Dismiss stale reviews when new commits are pushed
- Require status checks before merging
  - `format:check`
  - `lint`
  - `typecheck`
  - `test:unit`
  - `test:integration`
  - `test:roundtrip`
  - `test:conversion`
  - `build`
- Require branches to be up to date
- Do not allow bypassing protections

## Required CI Checks

All 9 gates from `pnpm verify`:

1. `format:check`
2. `lint`
3. `depcheck` (dependency-cruiser)
4. `typecheck`
5. `test:unit`
6. `test:integration`
7. `test:roundtrip`
8. `test:conversion`
9. `build`

## Merge Strategy

- **Squash merge** preferred (clean history)
- **Rebase merge** acceptable (preserves authorship)
- **Merge commits** discouraged

## Default Branch

`main`

Protected. No direct pushes. All changes through pull requests.

## Release Naming Convention

Tags: `v{VERSION}` (e.g., `v0.1.0-alpha`)

Release titles: `v0.1.0-alpha — Short Description`

Pre-releases: Include `alpha` or `beta` suffix. Mark as "Pre-release" on GitHub.

Stable releases: No suffix. Mark as "Latest" on GitHub.
