# Versioning Policy

## Package Versioning

All SkillBridge workspace packages share the same version number. This is enforced by Changesets.

- **0.1.0-alpha**: Initial pre-release (current)
- **0.2.0-alpha**: Next alpha (breaking changes permitted)
- **0.5.0-beta**: API stabilization (breaking changes discouraged)
- **1.0.0**: Public API stable

## IR Versioning

The SkillBridge Intermediate Representation has its own version, defined as `IRVersion` in `@skillbridge/ir`:

```typescript
type IRVersion = '0.1.0';
```

IR versions are independent of package versions. A package release may or may not include an IR version bump.

### IR Version Compatibility

| Package Version | IR Version | Compatible?                                    |
| --------------- | ---------- | ---------------------------------------------- |
| 0.1.0-alpha     | 0.1.0      | Current                                        |
| Future          | 0.1.0      | Backward compatible                            |
| Future          | 0.2.0      | Breaking changes to IR types require migration |

### Migration

When the IR version changes, `migrateIRPackage()` in `@skillbridge/ir` must be updated to handle the version transition. The function currently only handles the identity case (same input/output version).

## Dependency Versioning

- **Workspace dependencies** use `workspace:*` protocol in package.json
- **External dependencies** match the range specified in the root package.json
- **Dev dependencies** are hoisted to root level where possible

## Changelog

Changes are tracked in `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/) format.

## Semantic Versioning Guarantees

During the 0.x.x phase:

- **Patch** (0.0.x): Bug fixes, no breaking changes
- **Minor** (0.x.0): New features, may include breaking changes
- **Major** (0.0.0): Reserved for 1.0.0 transition

Breaking changes include:

- Renaming or removing public exports
- Changing function signatures
- Changing the shape of public interfaces
- Removing or renaming CLI commands or flags
- Changing the IR type definitions

Non-breaking changes include:

- Adding new exports
- Adding new CLI commands or flags
- Adding new IR types
- Bug fixes that change behavior only for incorrect cases
