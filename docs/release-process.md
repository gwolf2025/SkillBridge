# Release Process

## Overview

SkillBridge uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation. The release process is partially automated and partially manual.

## Versioning

SkillBridge follows [Semantic Versioning](https://semver.org/). All packages in the monorepo share the same version number. The IR version (`IRVersion`) is tracked separately in `@skillbridge/ir`.

- **Alpha** (0.1.x-alpha): Pre-release. Breaking changes may occur between alpha releases.
- **Beta** (0.x.0-beta): API stabilization period.
- **Stable** (1.x.0): Public API is stable.

See [versioning.md](./versioning.md) for detailed versioning policy.

## Prerequisites

- Clean working tree (`git status` shows no uncommitted changes)
- `pnpm verify` passes
- All CI checks pass
- You have npm publish access for the `@skillbridge` scope

## Release Steps

### 1. Prepare

```bash
git checkout main
git pull
pnpm install --frozen-lockfile
pnpm verify
```

### 2. Create Changeset

```bash
pnpm changeset
```

Follow the prompts to select packages and describe the changes.

### 3. Version

```bash
pnpm changeset version
```

This updates package versions and changelog entries.

### 4. Build and Test

```bash
pnpm build
pnpm verify
pnpm pack               # Verify all packages pack correctly
```

### 5. Release Checklist

Run through the [release checklist](../.github/RELEASE_CHECKLIST.md).

### 6. Commit and Tag

```bash
git add .
git commit -m "chore: release v0.1.0-alpha"
git tag v0.1.0-alpha
git push origin main --tags
```

### 7. Publish to npm

```bash
pnpm publish -r
```

Or use npm provenance for supply-chain security:

```bash
pnpm publish -r --provenance
```

### 8. Create GitHub Release

- Navigate to GitHub Releases
- Choose the tag
- Paste release notes from `docs/releases/v0.1.0-alpha.md`
- Publish

### 9. Post-Release

- Verify the npm packages install correctly:

```bash
mkdir /tmp/test-install && cd /tmp/test-install
npm init -y
npm install @skillbridge/core
node -e "console.log(require('@skillbridge/core'))"
```

- Monitor the first 48 hours for critical bug reports
- Update the release notes if issues are found

## Hotfix Process

For critical bugs discovered after release:

1. Create a fix branch from the release tag
2. Apply the fix
3. Create a new changeset with `patch` bump
4. Version, build, test
5. Publish as a patch release
6. Merge the fix back to main

## Automation (Future)

Automated release via GitHub Actions:

```yaml
# .github/workflows/release.yml (planned)
on:
  push:
    branches: [main]
    paths: ['.changeset/*.md']
```

The workflow would:

1. Run `pnpm changeset version`
2. Commit the version changes
3. Build all packages
4. Publish to npm
5. Create a GitHub Release
