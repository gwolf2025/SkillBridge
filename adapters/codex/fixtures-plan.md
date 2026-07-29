# Codex (OpenAI) Adapter — Fixtures Plan

**Status:** Planned
**Date:** 2026-07-29

## Directory Structure

```
adapters/codex/fixtures/
  detect/
    valid-minimal.md              # SKILL.md with name + description
    valid-open-standard.md        # SKILL.md with all open-standard fields
    invalid-no-frontmatter.md     # Body without frontmatter → false
    invalid-not-md.json           # .json file → false
  parse/
    valid-minimal.md              # Only name + description
    valid-full.md                 # name + description + all optional open-standard fields
    valid-with-openai-yaml/       # SKILL.md + agents/openai.yaml companion
      SKILL.md
      agents/
        openai.yaml
    edge-unknown-fields.md        # Unknown frontmatter fields (should be preserved)
    edge-empty-description.md     # Missing description edge case
    invalid-malformed-yaml.md     # Broken YAML frontmatter
  compile/
    source/
      valid-minimal.json          # Input for compile test
      valid-full.json             # Full open-standard fields
  roundtrip/
    valid-minimal.md              # Parse → compile → re-parse identity
    valid-full.md                 # All fields survive roundtrip
    valid-unknown-fields.md       # Unknown fields survive roundtrip
    edge-empty-frontmatter.md     # Empty frontmatter roundtrip
```

**Total: 17 fixtures** (4 detect, 6 parse, 2 compile, 3 roundtrip)

---

## Testable Assumptions

Each assumption references a specific source or documented behaviour from
`specification.md`.

| #   | Assumption                                                                                                                              | Source                                                       | Fixture category                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| A1  | `detect()` returns `true` for content with `---` frontmatter containing both `name` and `description`                                   | Open standard: both fields required                          | detect/valid-minimal.md             |
| A2  | `detect()` returns `true` for content with all open-standard optional fields present                                                    | Open standard: optional fields do not affect detect          | detect/valid-open-standard.md       |
| A3  | `detect()` returns `false` for content without valid frontmatter                                                                        | Open standard: `name` + `description` required               | detect/invalid-no-frontmatter.md    |
| A4  | `detect()` returns `false` for non-`.md` files                                                                                          | Adapter convention (file extension filter)                   | detect/invalid-not-md.json          |
| A5  | `parse()` returns `name`, `description`, `body`, and preserves `license`, `compatibility`, `metadata`, `allowed-tools` in extensions    | Open standard: optional fields preserved                     | parse/valid-full.md                 |
| A6  | Unknown frontmatter fields are preserved in extensions without diagnostic                                                               | Open standard: "Unknown fields MUST be preserved by tooling" | parse/edge-unknown-fields.md        |
| A7  | `parse()` with absent `description` still succeeds (open standard says required, but hard error vs fallback is implementation-specific) | Open standard: `description` required                        | parse/edge-empty-description.md     |
| A8  | `parse()` produces an error diagnostic for malformed YAML                                                                               | Universal parser behaviour                                   | parse/invalid-malformed-yaml.md     |
| A9  | `parse()` reads `agents/openai.yaml` when present and preserves `interface`, `policy`, `dependencies` in extensions                     | Codex docs: `agents/openai.yaml` companion file              | parse/valid-with-openai-yaml/       |
| A10 | `compile()` produces deterministic output — same input always produces identical output                                                 | Adapter contract requirement                                 | compile/source/valid-minimal.json   |
| A11 | `compile()` emits `name` and `description` first, then optional open-standard fields, then extensions                                   | Deterministic field order convention                         | compile/source/valid-full.json      |
| A12 | Roundtrip: `parse(compile(parse(input)))` preserves `name`, `description`, and `body` identity                                          | Adapter contract requirement                                 | roundtrip/valid-minimal.md          |
| A13 | Roundtrip: unknown fields survive parse → compile → re-parse                                                                            | Open standard: unknown fields MUST be preserved              | roundtrip/valid-unknown-fields.md   |
| A14 | Roundtrip: empty frontmatter (no `name` or `description`) still round-trips without crash                                               | Edge case robustness                                         | roundtrip/edge-empty-frontmatter.md |
| A15 | `name` constraint (lowercase kebab-case, max 64 chars) is validated during parse                                                        | Open standard: naming rules                                  | parse/valid-minimal.md              |

---

## Fixture Details

### Detect

#### `detect/valid-minimal.md`

```markdown
---
name: valid-minimal
description: A minimal test skill. Use for testing detection.
---

Body content.
```

#### `detect/valid-open-standard.md`

```markdown
---
name: valid-open-standard
description: An open standard test skill. Use for testing detection.
license: MIT
compatibility: Requires nothing
metadata:
  author: test
allowed-tools: Read
---

Body content.
```

#### `detect/invalid-no-frontmatter.md`

```
Just a body without any frontmatter.
```

#### `detect/invalid-not-md.json`

```json
{ "not": "a markdown file" }
```

### Parse

#### `parse/valid-minimal.md`

```markdown
---
name: minimal-skill
description: A minimal test skill. Use for testing parsing.
---

Body content.
```

#### `parse/valid-full.md`

```markdown
---
name: full-skill
description: A full test skill with all open-standard fields. Use for comprehensive testing.
license: Apache-2.0
compatibility: Requires git, docker
metadata:
  author: skillbridge
  version: '1.0.0'
allowed-tools: Read Bash
---

# Full Skill

Instructions for the full test skill.

## Steps

1. Do step one
2. Do step two
```

#### `parse/valid-with-openai-yaml/`

**`SKILL.md`:**

```markdown
---
name: companion-skill
description: A skill with an agents/openai.yaml companion. Use for testing companion file parsing.
license: MIT
---

Body with companion.
```

**`agents/openai.yaml`:**

```yaml
interface:
  display_name: 'Companion Skill'
  short_description: 'Tests companion YAML parsing'
  brand_color: '#10A37F'
  default_prompt: 'Use companion skill'

policy:
  allow_implicit_invocation: false
```

#### `parse/edge-unknown-fields.md`

```markdown
---
name: unknown-fields-skill
description: A skill with unknown frontmatter fields. Use for testing extension preservation.
custom_field: hello
another_field: 42
---

Body.
```

#### `parse/edge-empty-description.md`

```markdown
---
name: empty-desc-skill
description: ''
---

Body with empty description.
```

#### `parse/invalid-malformed-yaml.md`

```markdown
---
name: broken-skill
description: This has [unclosed YAML list
---

Body.
```

### Compile

#### `compile/source/valid-minimal.json`

```json
{
  "name": "minimal-skill",
  "description": "A compiled minimal skill.",
  "frontmatter": {
    "name": "minimal-skill",
    "description": "A compiled minimal skill."
  },
  "body": "Compiled body."
}
```

#### `compile/source/valid-full.json`

```json
{
  "name": "full-skill",
  "description": "A compiled full skill.",
  "frontmatter": {
    "name": "full-skill",
    "description": "A compiled full skill.",
    "license": "MIT",
    "compatibility": "Requires nothing"
  },
  "body": "Compiled full body.",
  "extensions": {
    "license": "MIT",
    "compatibility": "Requires nothing"
  }
}
```

### Roundtrip

#### `roundtrip/valid-minimal.md`

```markdown
---
name: rt-minimal
description: A roundtrip minimal skill. Use for testing identity.
---

Roundtrip body.
```

#### `roundtrip/valid-full.md`

```markdown
---
name: rt-full
description: A roundtrip full skill. Use for testing field preservation.
license: MIT
compatibility: Requires curl
metadata:
  author: skillbridge
  version: '1.0.0'
---

Roundtrip full body.
```

#### `roundtrip/valid-unknown-fields.md`

```markdown
---
name: rt-unknown
description: A roundtrip skill with unknown fields. Use for testing extension survival.
custom: value
number: 42
---

Roundtrip extensions body.
```

#### `roundtrip/edge-empty-frontmatter.md`

```markdown
---
---

body text
```

---

## Unresolved Questions (captured for build phase)

1. Should `detect()` validate that `name` matches the parent directory name?
   This requires carrying path context into what is currently a string-based
   `detect(input: string)` signature. Options: accept only at parse time,
   or require the path at detect time.

2. Should `parse()` automatically discover and read `agents/openai.yaml` from
   the same directory as `SKILL.md`? The current adapter pattern operates on a
   single string. The companion file approach may require a new `parseDirectory()`
   pattern or path-aware parsing.

3. Should the adapter produce a diagnostic for the experimental `allowed-tools`
   field? The open standard preserves it silently, but the adapter architecture
   recommends diagnostics for lossy/experimental mappings.

4. Should the adapter handle the `$CODEX_HOME` environment variable for default
   install paths, or use a hardcoded default like `~/.agents/skills/`?
