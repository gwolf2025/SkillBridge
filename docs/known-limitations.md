# Known Limitations — SkillBridge v0.1.0-alpha

## Feature Limitations

| Limitation                                                             | Impact                                                           | Planned Fix                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `invoke()` returns no-op in all 4 adapters                             | Cannot execute skills from the CLI                               | External runtime integration (post-alpha)  |
| Only `markdown` source/target format implemented                       | Cannot use JSON, YAML, or package sources                        | Post-alpha                                 |
| Claude/Codex adapters default to `command-exec` when no tools declared | Skills without explicit tool restrictions get broad capabilities | Before beta                                |
| Body sections parsed as YAML produce CONV-004 warnings                 | Non-YAML body content generates false-positive diagnostics       | Before beta                                |
| No per-command `--help` support                                        | Users must use `skillbridge --help` for all commands             | Before 1.0                                 |
| CLI exit code 2 defined but never produced                             | Internal error path not distinguished from user error            | Before 1.0                                 |
| `migrateIRPackage()` only handles identity version path                | No actual migration between IR versions                          | Before 1.0 (when second IR version exists) |
| No adapter version negotiation                                         | Adapters do not declare supported IR versions                    | Before 1.0                                 |

## Packaging Limitations

| Limitation                                                       | Impact                                                                | Status                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| Test files shipped in npm tarballs (mitigated by prepack script) | Slightly larger tarballs; `prepack` removes test files before packing | Acceptable for alpha                        |
| No per-package README.md files                                   | Packages listed in `files` no longer reference README.md              | Acceptable for alpha                        |
| `packages/runtime` has no implementation code                    | Published as empty package                                            | Add `private: true` before 1.0 or implement |

## CI Limitations

| Limitation                       | Impact                             | Status      |
| -------------------------------- | ---------------------------------- | ----------- |
| Ubuntu-only CI runner            | No Windows or macOS coverage in CI | Before beta |
| Single Node.js version (20)      | No testing against Node.js 22, 23  | Before beta |
| No caching or cancel-in-progress | Slower CI runs                     | Optional    |

## Platform Limitations

| Limitation                                   | Impact                                       | Workaround                                                        |
| -------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm install` fails on Windows exFAT drives | exFAT lacks symlink support required by pnpm | Use NTFS, or use the existing `node_modules/@skillbridge/*` shims |

## Security Limitations

| Limitation                                          | Impact                                            | Status                                                             |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| YAML `load()` uses default schema (not safe schema) | Potential prototype pollution from malicious YAML | Fix before 1.0 (no practical exploit path for user-authored files) |
| TOCTOU race in filesystem walker                    | Theoretical symlink bypass                        | Fix before 1.0 (requires concurrent filesystem access)             |
| Rollback on install failure is best-effort          | Partial rollback failures silently ignored        | Fix before beta                                                    |
| Cache paths are predictable                         | Shared-system isolation concern                   | Fix before beta                                                    |
