# Release Checklist

Use this checklist for every SkillBridge release.

## Pre-Release

- [ ] Clean checkout verified (`git status` clean, correct branch)
- [ ] `pnpm install --frozen-lockfile` succeeds
- [ ] `pnpm verify` passes (all 9 gates)
- [ ] Version consistency checked (all packages match)
- [ ] Changelog updated and accurate
- [ ] Changeset created and versioned

## Release Artifacts

- [ ] `pnpm build` succeeds (all 19 packages)
- [ ] CLI smoke tests pass (--help, --version, adapters, parse, convert --dry-run)
- [ ] End-to-end conversion verified (deterministic, cross-adapter)
- [ ] Tarballs inspected (no test files, LICENSE/NOTICE present)
- [ ] `pnpm pack` succeeds for core package

## Documentation

- [ ] Release notes written (`docs/releases/v{VERSION}.md`)
- [ ] Known limitations reviewed and current
- [ ] README accuracy checked
- [ ] SPECIFICATION.md accuracy checked
- [ ] Security policy reviewed

## Legal

- [ ] LICENSE files present in all packages
- [ ] NOTICE files present in all packages
- [ ] License headers present in source files (optional for alpha)
- [ ] Third-party license compliance checked

## Security

- [ ] Secret scan completed (no tokens, keys, or credentials committed)
- [ ] No absolute paths committed
- [ ] No machine-specific configuration committed
- [ ] Dependency audit clean (`pnpm audit`)

## Publishing

- [ ] Git tag created (`git tag v{VERSION}`)
- [ ] Git tag pushed (`git push origin v{VERSION}`)
- [ ] npm packages published (`pnpm publish -r`)
- [ ] npm provenance enabled (if available)
- [ ] GitHub Release created with release notes

## Post-Release

- [ ] npm packages install correctly (`npm install @skillbridge/core`)
- [ ] Published CLI runs (`npx @skillbridge/cli --help`)
- [ ] First 48 hours monitored for critical issues
- [ ] Release announcement prepared (blog, social)

## Notes

- Items marked with `[ ]` are for the release author to complete
- Items marked with `[x]` have been verified locally during this build
- See [release-process.md](../docs/release-process.md) for detailed steps
