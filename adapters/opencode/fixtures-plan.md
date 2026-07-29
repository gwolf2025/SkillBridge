# OpenCode Adapter — Fixtures Plan

**Status:** Planned
**Date:** 2026-07-28

## Directory Structure

```
adapters/opencode/fixtures/
  detect/
    valid-agent-01.md       # Content starting with ---
    valid-agent-02.md       # File path to valid .md
    invalid-not-md.txt       # .txt file → false
    invalid-no-frontmatter.md  # Body without frontmatter → false
    invalid-empty.md         # Empty file → false
  parse/
    valid-agent-01.md       # Minimal agent (description only)
    valid-agent-02.md       # Full agent (all fields)
    valid-agent-03.md       # Agent with permission globs
    valid-agent-04.md       # Agent with mode: subagent
    valid-command-01.md     # Minimal command
    valid-command-02.md     # Command with agent ref
    valid-command-03.md     # Command with instruction ref
    invalid-malformed-yaml.md  # Unclosed list in YAML
    invalid-bad-mode.md     # mode: invalid_value
    edge-empty-frontmatter.md  # ---\n---\nbody
    edge-no-body.md         # ---\ndescription: x\n---\n  (blank body)
    edge-unknown-fields.md  # ---\ndescription: x\ncustom: val\n---
    edge-ask-permission.md  # permission.edit: ask
    edge-array-rule.md      # rule: [a.md, b.md]
    edge-only-body.md       # No frontmatter, just body
  compile/
    source/
      valid-agent-01.json     # Input data for compile test
      valid-agent-02.json
      valid-command-01.json
  roundtrip/
    valid-agent-01.md       # Parse → compile → re-parse
    valid-agent-02.md
    valid-command-01.md
    edge-unknown-fields.md
    edge-empty-frontmatter.md
```

## Fixture Definitions

### detect/valid-agent-01.md

```markdown
---
description: A test agent
---

Body content
```

**Expect:** `detect(content)` → `true`

### detect/valid-agent-02.md

Same content but used as file path test. Placed in fixtures directory,
`detect(path)` uses `statSync` → `true`.

### detect/invalid-not-md.txt

```text
No frontmatter here.
```

**Expect:** `detect(content)` → `false`

### parse/valid-agent-01.md

```markdown
---
description: Minimal test agent
---

This is the system prompt body.
```

**Expect:**

- `kind`: `'agent'`
- `frontmatter.description`: `'Minimal test agent'`
- `body`: `'This is the system prompt body.'`
- No diagnostics

### parse/valid-agent-02.md

```markdown
---
description: Full test agent
mode: subagent
model: gpt-4
instruction: .opencode/instructions/build.md
rule: .opencode/rules/typescript.md
permission:
  edit: allow
  bash:
    'pnpm *': allow
    'git *': deny
    '*': ask
---

Full system prompt body here.
```

**Expect:**

- `kind`: `'agent'`
- `frontmatter.mode`: `'subagent'`
- `frontmatter.model`: `'gpt-4'`
- `frontmatter.permission.edit`: `true`
- `frontmatter.permission.bash`: object with 3 entries
- Diagnostics: warning for `'*': ask` (OPENCODE-003)

### parse/valid-command-01.md

```markdown
---
description: A test command
agent: builder
---

Run this command when you need to build.
```

**Expect:**

- `kind`: `'command'`
- `frontmatter.agent`: `'builder'`
- No `mode` or `permission` in frontmatter

### parse/valid-command-02.md

```markdown
---
description: Command with instruction
agent: planner
instruction: .opencode/instructions/plan.md
rule: .opencode/rules/planning.md
---

Plan the next task.
```

**Expect:**

- `kind`: `'command'`
- `frontmatter.instruction`: `'.opencode/instructions/plan.md'`
- Diagnostic: info about instruction reference not resolved (OPENCODE-005)

### parse/invalid-malformed-yaml.md

```markdown
---
description: Broken
mode: [unclosed list
---

body
```

**Expect:**

- `diagnostics` with severity `error`, code `OPENCODE-001`
- `frontmatter` is partial or empty

### parse/invalid-bad-mode.md

```markdown
---
description: Bad mode
mode: invalid_value
---

body
```

**Expect:**

- Diagnostic with severity `warning`, code `OPENCODE-002`

### parse/edge-empty-frontmatter.md

```markdown
---
---

body text
```

**Expect:**

- `frontmatter`: `{}`
- `body`: `'body text'`
- No diagnostics

### parse/edge-unknown-fields.md

```markdown
---
description: With extras
custom_field: hello
another_field: 42
---

body
```

**Expect:**

- `extensions.custom_field`: `'hello'`
- `extensions.another_field`: `42`

### parse/edge-ask-permission.md

```markdown
---
description: Ask permission
permission:
  edit: ask
---

body
```

**Expect:**

- `frontmatter.permission.edit`: `'ask'`
- Diagnostic: warning code `OPENCODE-003`

### parse/edge-array-rule.md

```markdown
---
description: Array rule
rule:
  - rules/a.md
  - rules/b.md
---

body
```

**Expect:**

- `frontmatter.rule`: `['rules/a.md', 'rules/b.md']`
- No error (OpenCode accepts array rule)

### parse/edge-only-body.md

```
Just body text with no frontmatter.
```

**Expect:**

- `frontmatter`: `{}`
- `body`: `'Just body text with no frontmatter.'`

### compile/source/valid-agent-01.json

```json
{
  "kind": "agent",
  "frontmatter": {
    "description": "Compiled test agent"
  },
  "body": "Compiled body text."
}
```

**Expect:**

- Output starts with `---`
- Contains `description: Compiled test agent`
- Contains `Compiled body text.`
- Ends with `---` delimited frontmatter and body

### compile/source/valid-agent-02.json

```json
{
  "kind": "agent",
  "frontmatter": {
    "description": "Compiled full agent",
    "mode": "subagent",
    "model": "gpt-4",
    "permission": {
      "edit": true,
      "bash": {
        "pnpm *": "allow",
        "git *": "deny"
      }
    }
  },
  "body": "Full compiled body."
}
```

**Expect:**

- YAML frontmatter has `mode: subagent`
- `permission` rendered as nested YAML
- `model` preserved

## Test Coverage Matrix

| Test Area      | # Fixtures | Coverage                                  |
| -------------- | ---------- | ----------------------------------------- |
| detect valid   | 2          | Content string + file path                |
| detect invalid | 3          | No frontmatter, wrong ext, empty          |
| parse agent    | 4          | Minimal, full, subagent, permission globs |
| parse command  | 3          | Minimal, with agent, with instruction     |
| parse invalid  | 2          | Malformed YAML, bad mode                  |
| parse edges    | 6          | Empty FM, no body, unknown fields, etc.   |
| compile        | 2          | Minimal agent, full agent                 |
| roundtrip      | 5          | All valid fixtures round-tripped          |

Total: ~27 fixture files

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
