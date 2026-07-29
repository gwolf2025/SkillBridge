# SkillBridge CLI Usage Guide

**Write an AI skill once. Run it anywhere.**

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Exit Codes](#2-exit-codes)
3. [Global Flags](#3-global-flags)
4. [`skillbridge convert`](#4-skillbridge-convert)
5. [`skillbridge compile`](#5-skillbridge-compile)
6. [`skillbridge parse`](#6-skillbridge-parse)
7. [`skillbridge validate`](#7-skillbridge-validate)
8. [`skillbridge inspect`](#8-skillbridge-inspect)
9. [`skillbridge adapters`](#9-skillbridge-adapters)
10. [`skillbridge list-adapters`](#10-skillbridge-list-adapters)
11. [`skillbridge capabilities`](#11-skillbridge-capabilities)
12. [`skillbridge doctor`](#12-skillbridge-doctor)
13. [`skillbridge install`](#13-skillbridge-install)
14. [`skillbridge uninstall`](#14-skillbridge-uninstall)
15. [`skillbridge list`](#15-skillbridge-list)
16. [`skillbridge verify`](#16-skillbridge-verify)
17. [`skillbridge repair`](#17-skillbridge-repair)
18. [Error Codes](#18-error-codes)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Getting Started

```powershell
# Show help
skillbridge --help

# Show version
skillbridge --version

# Run a conversion
skillbridge convert --from markdown --to markdown my-skill.md

# List available adapters
skillbridge adapters
```

## 2. Exit Codes

| Code | Meaning                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| `0`  | Success — command completed without errors                                               |
| `1`  | User error — bad arguments, missing file, conversion failure, policy block, or not found |
| `2`  | Fatal internal error — unexpected exception (should be reported as a bug)                |

Errors with exit code 1 produce structured output in `--json` mode:

```json
{
  "ok": false,
  "error": {
    "code": "CLI-003",
    "message": "...",
    "diagnostics": [...]
  }
}
```

## 3. Global Flags

| Flag              | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `--help`, `-h`    | Show usage text listing all commands and flags. Exits 0.      |
| `--version`, `-v` | Print the CLI version from `package.json`. Exits 0.           |
| `--json`          | Output results in JSON format instead of human-readable text. |

`--help` is also shown when no command or flag is given:

```powershell
skillbridge  # prints usage text, exits 0
```

---

## 4. `skillbridge convert`

Convert a skill file between vendor formats. Runs the full pipeline: detect → parse → normalize → analyze → compile → verify.

```powershell
skillbridge convert --from markdown --to markdown my-skill.md
```

### Flags

| Flag                      | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `--from <format>`         | Source format (default: `markdown`)                      |
| `--to <format>`           | Target format (default: `markdown`)                      |
| `--policy <mode>`         | Policy mode: `strict`, `safe` (default), or `permissive` |
| `--source-adapter <name>` | Explicit source adapter name                             |
| `--target-adapter <name>` | Explicit target adapter name                             |
| `--output-dir <path>`     | Write compiled output to directory                       |
| `--dry-run`               | Preview conversion result without writing files          |
| `--overwrite`             | Allow overwriting an existing output directory           |

### Human-readable output

```
Source format: markdown
Target format: markdown
Source adapter: adapter-portable
Target adapter: adapter-claude
Steps:
  - parse (adapter-portable)
  - normalize (adapter-portable)
  - compile (adapter-claude)
Compatibility: native
  native: 2, emulated: 0, missing: 0
Policy: safe

Output:
---
...
```

### JSON output (`--json`)

```powershell
skillbridge --json convert --from markdown --to markdown my-skill.md
```

Output includes: `output`, `diagnostics`, `compatibility`, `securityImpact`, `provenance`, `manifest`, `policyResult`, `fieldProvenances`.

### Policy modes

```powershell
# Strict — blocks any non-native capability
skillbridge convert --from markdown --to markdown --policy strict my-skill.md

# Safe (default) — blocks on security weakening, warns on missing/degraded
skillbridge convert --from markdown --to markdown --policy safe my-skill.md

# Permissive — allows all conversions with diagnostics
skillbridge convert --from markdown --to markdown --policy permissive my-skill.md
```

### Compatibility report interpretation

The compatibility section shows capability comparison results:

```
Compatibility: native
  native: 2, emulated: 0, missing: 0
```

- **native**: Capability is natively supported by the target adapter
- **emulated**: Capability is emulated (behaviour may differ)
- **missing**: Capability is not available in the target
- **degraded**: Capability exists but with reduced functionality
- **partial**: Capability is partially available
- **unknown**: Support level could not be determined

### Permission report interpretation

When security impact is present, it shows permission comparisons:

- **Preserved**: Permission exists in both source and compiled (same or superset actions)
- **Weakened**: Same resource, fewer actions in compiled than source
- **Expanded**: Same resource, more actions in compiled than source
- **New**: Permission present in compiled but absent in source
- **Removed**: Permission present in source but absent in compiled

### Explicit adapter selection

```powershell
skillbridge convert --from markdown --to markdown --source-adapter adapter-claude --target-adapter adapter-codex my-skill.md
```

### Output directory with atomic writes

```powershell
# Write output to directory
skillbridge convert --from markdown --to markdown --output-dir ./out my-skill.md

# Dry-run (preview without writing)
skillbridge convert --from markdown --to markdown --output-dir ./out --dry-run my-skill.md

# Overwrite existing output directory
skillbridge convert --from markdown --to markdown --output-dir ./out --overwrite my-skill.md
```

---

## 5. `skillbridge compile`

Compile a skill package directory (reads `SKILL.md` from a directory, runs the pipeline, and writes compiled output).

```powershell
skillbridge compile --to markdown --output-dir ./out ./my-skill-package/
```

Accepts the same flags as `convert` (`--output-dir`, `--dry-run`, `--overwrite`, `--policy`, `--target-adapter`, `--json`).

### Examples

```powershell
# Basic compile
skillbridge compile --to markdown ./my-skill-package/

# Compile with explicit target adapter and output directory
skillbridge compile --to markdown --output-dir ./out --target-adapter adapter-claude ./my-skill-package/
```

---

## 6. `skillbridge parse`

Parse a SKILL.md file and display its structure (frontmatter, sections, extensions).

```powershell
skillbridge parse my-skill.md
skillbridge --json parse my-skill.md
```

### Exit codes

- `0`: Parse succeeded (even with no frontmatter)
- `1`: File not found, malformed YAML, or parse error

### Example output

```
Frontmatter:
  name: my-skill
  description: A test skill
  version: 1.0.0
Sections:
  ## Description
     Body text for the description section.
```

---

## 7. `skillbridge validate`

Validate a skill package directory for correct structure (SKILL.md, optional skillbridge.yaml).

```powershell
skillbridge validate ./my-skill-package/
skillbridge --json validate ./my-skill-package/
```

### Exit codes

- `0`: Validation passed (warnings may be present)
- `1`: Validation failed (missing SKILL.md, malformed YAML, etc.)

---

## 8. `skillbridge inspect`

Show full metadata for a skill package directory including frontmatter, sections, manifest, resource directories, and license/notice status.

```powershell
skillbridge inspect ./my-skill-package/
skillbridge --json inspect ./my-skill-package/
```

---

## 9. `skillbridge adapters`

List all registered adapters with their name, version, vendor, source/target formats, and capabilities.

```powershell
# List all adapters
skillbridge adapters

# Filter by format
skillbridge adapters --format markdown

# Show detailed adapter information
skillbridge adapters --detail

# JSON output
skillbridge --json adapters
```

### Output (table)

```
Name                   Version      Vendor          Source      Target      Capabilities
-------------------------------------------------------------------------------------------
adapter-portable       0.0.0        skillbridge     markdown    markdown    detect, parse, ...
adapter-claude         0.0.0        skillbridge     markdown    markdown    detect, parse, ...
```

### Adapter registration

Adapters are registered by the CLI at startup from the installed workspace packages. Use `--format` to find adapters supporting a specific format.

---

## 10. `skillbridge list-adapters`

Alias for `skillbridge adapters`. Produces identical output.

```powershell
skillbridge list-adapters
skillbridge --json list-adapters
```

---

## 11. `skillbridge capabilities`

List the IR capability vocabulary grouped by category.

```powershell
# All capabilities
skillbridge capabilities

# Capabilities for a specific adapter
skillbridge capabilities --adapter adapter-portable

# JSON output (grouped by category)
skillbridge --json capabilities
```

### Example output

```
IR Capability Vocabulary:

  filesystem:
    - file-read            Read files from the local filesystem
    - file-write           Write files to the local filesystem
    - list-directory       List directory contents
  execution:
    - command-exec         Execute arbitrary shell commands
    - process-spawn        Spawn and manage child processes
```

---

## 12. `skillbridge doctor`

Run local environment diagnostics. Checks Node.js version, adapter registrations, platform info, and environment variables (with secret values redacted).

```powershell
skillbridge doctor
skillbridge --json doctor
```

### Features

- **Node.js version check**: Warns if below 20.x
- **Platform info**: OS, architecture, hostname
- **Adapter registrations**: Lists all registered adapters
- **Secret redaction**: Env vars matching `TOKEN`, `SECRET`, `API_KEY`, `PASSWORD`, `CREDENTIAL`, `AUTH`, `PRIVATE_KEY`, `ACCESS_KEY` have their values redacted as `****`
- **No network calls**: Only local inspection — never reads remote configuration

### Exit codes

Always exits `0` (doctor is informational, not a validation gate).

---

## 13. `skillbridge install`

Install a skill from a source file. Detects the source adapter, plans the installation, and executes with atomic safety.

```powershell
# Install with default (never) overwrite policy
skillbridge install my-skill.md

# Preview without modifying files
skillbridge install --dry-run my-skill.md

# Force overwrite if conflicts exist
skillbridge install --force my-skill.md
```

### Dry-run output

The `--dry-run` flag shows the installation plan including scope, destination paths, steps, conflicts, backup plan, integrity manifest, and warnings — without writing any files.

### Rollback

If the installation fails during atomic rename, previously backed-up files are restored from backup and the staging directory is cleaned up. The destination is never left in a partial state.

---

## 14. `skillbridge uninstall`

Uninstall a skill by name. Creates a backup before removing files.

```powershell
skillbridge uninstall my-skill
skillbridge --json uninstall my-skill
```

### Rollback

If removal fails partway through, backups are restored to recover the original state.

---

## 15. `skillbridge list`

List installed skills with their name, adapter, status, and path.

```powershell
skillbridge list
skillbridge --json list
```

### Example output

```
Name                   Adapter               Status    Path
--------------------------------------------------------------
my-skill               adapter-portable      present   .agents/skills/my-skill/SKILL.md
```

---

## 16. `skillbridge verify`

Verify integrity of installed skills. Compares stored SHA-256 checksums against recomputed values.

```powershell
# Verify all installed skills
skillbridge verify

# Verify a specific skill
skillbridge verify my-skill
```

### Exit codes

- `0`: Verification completed (output shows match/missing/mismatch counts)
- `1`: No installed skills found or specified skill not found

---

## 17. `skillbridge repair`

Repair corrupted or missing files for installed skills. Verifies integrity, then re-installs only the damaged files without touching intact files.

```powershell
# Repair all installed skills
skillbridge repair

# Repair a specific skill
skillbridge repair my-skill
```

---

## 18. Error Codes

| Code      | Meaning                                         | Resolution                                                       |
| --------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `CLI-001` | Unknown command                                 | Check spelling. Run `skillbridge --help` for available commands. |
| `CLI-002` | Missing source argument for `convert`           | Provide a source file path.                                      |
| `CLI-003` | Conversion/install/uninstall/list/repair failed | Check the accompanying diagnostics for details.                  |
| `CLI-004` | Cannot read source file                         | Verify the file exists and is readable.                          |
| `CLI-010` | Missing file argument for `parse`               | Provide a file path to parse.                                    |
| `CLI-011` | Cannot read parse file                          | Verify the file exists and is readable.                          |
| `CLI-012` | Parse failed                                    | Check diagnostics for malformed YAML or other errors.            |
| `CLI-013` | Missing directory argument for `validate`       | Provide a directory path.                                        |
| `CLI-014` | Directory not found or missing SKILL.md         | Verify the path exists and contains SKILL.md.                    |
| `CLI-015` | Missing directory argument for `inspect`        | Provide a directory path.                                        |
| `CLI-016` | Unknown adapter name in `capabilities`          | Run `skillbridge adapters` to see available adapters.            |
| `CLI-017` | Output directory already exists                 | Use `--overwrite` to allow overwriting.                          |
| `CLI-018` | Atomic output writer error                      | Filesystem error during staging or commit.                       |
| `CLI-019` | Missing directory argument for `compile`        | Provide a skill package directory.                               |
| `CLI-020` | Missing argument for `install`/`uninstall`      | Provide a source file (install) or skill name (uninstall).       |
| `CLI-021` | Skill not found for uninstall/verify/repair     | Use `skillbridge list` to find installed skill names.            |

## 19. Troubleshooting

### Command not found

```powershell
skillbridge unknown-command
# Error [CLI-001]: unknown command 'unknown-command'
```

### Missing source file

```powershell
skillbridge convert my-skill.md
# Error [CLI-002]: missing source argument for convert command
```

### Output directory exists

```powershell
skillbridge convert --from markdown --to markdown --output-dir ./out my-skill.md
# Error [CLI-017]: output directory already exists: ./out. Use --overwrite to overwrite.
```

### Policy blocks conversion

When `--policy strict` is used and capabilities are emulated:

```
Error [CLI-003]: conversion blocked by policy
Diagnostics:
  error    [CONV-010] conversion blocked by policy
```

Switch to `--policy safe` or `--policy permissive` to allow the conversion.

### No adapter found for format

```powershell
skillbridge convert --from json --to markdown my-file.json
# Error: no adapter found for source format 'json'
```

Use `skillbridge adapters` to see which formats are supported.

### `--json` error output

```powershell
skillbridge --json convert nonexistent.md
# {"ok":false,"error":{"code":"CLI-003","message":"...","diagnostics":[...]}}
```

### Install without --force with conflicts

If the output directory already contains files from a previous install:

```powershell
skillbridge install my-skill.md
# Error [CLI-003]: conflict at '...' — use --force to overwrite
```

Add `--force` to overwrite with backup.

### Dry-run does not write files

```powershell
skillbridge install --dry-run my-skill.md
# Prints installation plan, no files written
```

### PowerShell chaining

In PowerShell 5.1, use `; if ($?)` for sequential commands:

```powershell
skillbridge convert --from markdown --to markdown my-skill.md; if ($?) { skillbridge doctor }
```
