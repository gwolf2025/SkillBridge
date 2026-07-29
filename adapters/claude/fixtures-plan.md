# Claude Code Adapter — Fixtures Plan

**Status:** Planned
**Date:** 2026-07-28

## Directory Structure

```
adapters/claude/fixtures/
  detect/
    valid-basic.md              # SKILL.md with description
    valid-minimal.md            # SKILL.md with only name
    invalid-empty.md            # Empty file → false
    invalid-no-frontmatter.md   # Body without frontmatter → false
    invalid-not-md.json         # .json file → false
  parse/
    valid-minimal.md            # Only name + description
    valid-full.md               # All Claude Code fields
    valid-allowed-tools.md      # allowed-tools variations
    valid-disallowed-tools.md   # disallowed-tools field
    valid-fork.md               # context: fork
    valid-manual-only.md        # disable-model-invocation: true
    valid-background-false.md   # background: false with context: fork
    valid-arguments.md          # arguments as YAML list
    valid-arguments-string.md   # arguments as space-separated string
    valid-paths.md              # paths with glob patterns
    valid-hooks.md              # hooks configuration
    valid-shell.md              # shell: powershell
    valid-effort.md             # effort levels
    valid-open-standard.md      # Agent Skills open standard fields
    valid-non-bool.md           # Boolean fields with yes/no/on/off
    invalid-malformed-yaml.md   # Broken YAML
    invalid-effort.md           # Invalid effort level
    edge-empty-fields.md        # Empty description, no name
    edge-only-body.md           # No frontmatter, just body
    edge-unknown-fields.md      # Completely unknown frontmatter keys
    edge-disabled.md            # disabled: true
    edge-empty-tools.md         # allowed-tools with empty/null value
  compile/
    source/
      valid-minimal.json        # Input for compile test
      valid-full.json
      valid-unknown-fields.json # Extensions preserved in compile
  roundtrip/
    valid-minimal.md
    valid-full.md
    valid-unknown-fields.md
    edge-empty-frontmatter.md
```

## Fixture Definitions

### detect/valid-basic.md

```markdown
---
description: A test skill for Claude Code. Use when testing or debugging the adapter.
---

Body content here.
```

**Expect:** `detect(content)` → `true`

### detect/valid-minimal.md

```markdown
---
name: test-skill
description: Minimal test skill
---
```

**Expect:** `detect(content)` → `true`

### detect/invalid-empty.md

```
```

**Expect:** `detect(content)` → `false`

### detect/invalid-no-frontmatter.md

```markdown
Just body text with no frontmatter.
```

**Expect:** `detect(content)` → `false`

### detect/invalid-not-md.json

```json
{ "not": "a skill file" }
```

**Expect:** `detect(path)` → `false` (not `.md`)

### parse/valid-minimal.md

```markdown
---
name: test-skill
description: A minimal test skill. Use when testing.
---

# Test Skill

This is the skill body.
```

**Expect:**
- `name`: `'test-skill'`
- `description`: `'A minimal test skill. Use when testing.'`
- `body`: markdown body content
- No diagnostics

### parse/valid-full.md

```markdown
---
name: full-skill
description: A full-featured test skill. Use for comprehensive testing.
when_to_use: |
  - When running tests
  - When debugging the adapter
  - When validating round-trips
allowed-tools: Read Write Edit Bash Grep
disallowed-tools: AskUserQuestion
model: claude-sonnet-4-20250514
effort: high
context: fork
agent: claude-code
background: false
paths:
  - src/**/*.ts
  - tests/**/*.ts
shell: bash
arguments: [input, output]
argument-hint: "<input-file> [output-dir]"
hooks:
  preToolUse: scripts/validate.sh
disabled: false
disable-model-invocation: false
user-invocable: true
---

# Full Skill

## Instructions
Full skill instructions here.

## Examples
Example usage.
```

**Expect:**
- All frontmatter fields parsed correctly
- `allowedTools`: `['Read', 'Write', 'Edit', 'Bash', 'Grep']`
- `disallowedTools`: `['AskUserQuestion']`
- `isForked`: `true`
- `isManualOnly`: `false`
- `isUserInvokable`: `true`
- `arguments`: `['input', 'output']`
- `paths`: `['src/**/*.ts', 'tests/**/*.ts']`
- `effort`: `'high'`
- `shell`: `'bash'`

### parse/valid-allowed-tools.md

```markdown
---
name: tools-skill
description: Test allowed-tools variations.
allowed-tools: Read, Write, Edit
---

Body.
```

**Expect:**
- `allowedTools`: `['Read', 'Write', 'Edit']`
- Comma-separated string parsed correctly

### parse/valid-allowed-tools.md (alternate)

```markdown
---
name: tools-skill2
description: Test YAML list tools.
allowed-tools:
  - Read
  - Bash
  - Grep
---
```

**Expect:**
- `allowedTools`: `['Read', 'Bash', 'Grep']`
- YAML list parsed correctly

### parse/valid-non-bool.md

```markdown
---
name: nonbool-skill
description: Test boolean parsing.
disabled: yes
disable-model-invocation: on
user-invocable: "no"
background: 1
---

Body.
```

**Expect:**
- `disabled`: `true` (from `yes`)
- `disable-model-invocation`: `true` (from `on`)
- `user-invocable`: `false` (from `"no"`)
- `background`: `true` (from `1`)
- Diagnostic CLAUDE-004 for each non-standard boolean value

### parse/valid-open-standard.md

```markdown
---
name: open-standard-skill
description: An Agent Skills open standard skill.
license: MIT
compatibility: Designed for Claude Code
metadata:
  author: test-author
  version: "1.0.0"
allowed-tools: Read Grep
---

Body.
```

**Expect:**
- `name` and `description` from standard fields
- `extensions.license`: `'MIT'`
- `extensions.compatibility`: `'Designed for Claude Code'`
- `extensions.metadata`: `{ author: 'test-author', version: '1.0.0' }`

### parse/valid-effort.md

```markdown
---
name: effort-skill
description: Test effort levels.
effort: max
---
```

**Expect:**
- `effort`: `'max'`

### parse/invalid-effort.md

```markdown
---
name: bad-effort
description: Invalid effort.
effort: extreme
---
```

**Expect:**
- `effort`: `'extreme'` (preserved)
- Diagnostic CLAUDE-003: invalid effort level

### parse/invalid-malformed-yaml.md

```markdown
---
name: broken
description: [unclosed list
---
```

**Expect:**
- Diagnostic CLAUDE-001 (malformed YAML)
- Partial or empty frontmatter

### parse/edge-only-body.md

```markdown
Just body text with no frontmatter.
```

**Expect:**
- `frontmatter`: `{}`
- `body`: `'Just body text with no frontmatter.'`
- `name`: `'unnamed'`
- `description`: `'Just body text with no frontmatter.'` (first body paragraph)

### parse/edge-unknown-fields.md

```markdown
---
name: unknown-fields
description: Test unknown fields.
custom_field: value
another_field: 42
---

Body.
```

**Expect:**
- `extensions.custom_field`: `'value'`
- `extensions.another_field`: `42`
- Diagnostic CLAUDE-002 for each unknown field

### parse/edge-disabled.md

```markdown
---
name: disabled-skill
description: This skill is disabled.
disabled: true
---

Body.
```

**Expect:**
- `disabled`: `true`
- Diagnostic: info about skill being disabled

### compile/source/valid-minimal.json

```json
{
  "name": "compiled-skill",
  "description": "A compiled test skill.",
  "frontmatter": {
    "name": "compiled-skill",
    "description": "A compiled test skill."
  },
  "body": "Compiled body content.",
  "allowedTools": []
}
```

**Expect:**
- Output starts with `---`
- Contains `name: compiled-skill`
- Contains `description: A compiled test skill.`
- Contains `Compiled body content.`

### compile/source/valid-full.json

```json
{
  "name": "full-compiled",
  "description": "Full compiled test.",
  "frontmatter": {
    "name": "full-compiled",
    "description": "Full compiled test.",
    "allowed-tools": "Read Write Edit Bash",
    "effort": "high",
    "context": "fork"
  },
  "body": "Full compiled body.",
  "allowedTools": ["Read", "Write", "Edit", "Bash"],
  "effort": "high"
}
```

**Expect:**
- Known fields in deterministic order in YAML frontmatter
- `allowed-tools` rendered as space-separated string

## Test Coverage Matrix

| Test Area          | # Fixtures | Coverage                                        |
| ------------------ | ---------- | ----------------------------------------------- |
| detect valid       | 2          | Content string, name+description                |
| detect invalid     | 3          | No frontmatter, empty, wrong ext                |
| parse basic        | 2          | Minimal, full (all fields)                      |
| parse fields       | 7          | Tools, fork, manual, args, paths, hooks, shell  |
| parse variants     | 3          | Open standard, non-bool, effort variants        |
| parse invalid      | 2          | Malformed YAML, invalid effort                  |
| parse edges        | 4          | No frontmatter, unknown fields, disabled, empty |
| compile            | 2          | Minimal, full                                   |
| roundtrip          | 4          | All valid fixtures round-tripped                |

Total: ~29 fixture files

## Fixture Naming Convention

`<category>-<variant>-<description>.md`

- `valid-` prefix: expected to parse without errors
- `invalid-` prefix: expected to produce error diagnostics
- `edge-` prefix: boundary cases, may produce warnings or info

## Implementation Order

1. Create fixture files for `detect/` and `parse/` (validate manually)
2. Implement `detect()` and `parse()` with fixture-driven tests
3. Create fixture files for `compile/`
4. Implement `compile()`
5. Create roundtrip fixtures
6. Write roundtrip tests
7. Add integration tests with temp directories
8. Implement install/uninstall planning
9. Add adapter contract test fixture
