# Codex (OpenAI) Adapter Specification

**Package:** `@skillbridge/adapter-codex`
**Status:** Research (pre-implementation)
**Date:** 2026-07-29

## 1. Overview

The OpenAI Codex adapter converts between SkillBridge IR and the Codex Agent Skills
format. Codex skills are directories containing a `SKILL.md` file with YAML frontmatter
and an optional `agents/openai.yaml` companion for UI metadata and tool dependencies.

Codex implements the cross-agent **Agent Skills open standard** (`agentskills.io`).
A skill authored using only open-standard fields (`name`, `description`, `license`,
`compatibility`, `metadata`) works unchanged in Codex CLI, Claude Code, Gemini CLI,
Cursor, and 30+ other tools. Codex adds an `agents/openai.yaml` companion file for
platform-specific UI and policy metadata that other tools ignore.

**Sources:**

- `developers.openai.com/codex/skills` — official Codex skills documentation
- `agentskills.io/specification` — open standard specification
- `github.com/openai/codex` — Codex CLI open-source repository
- `github.com/openai/skills` — OpenAI skills catalogue

### Source Format

A Codex skill is a directory containing a `SKILL.md` file:

```
my-skill/
  SKILL.md              # required — YAML frontmatter + Markdown instructions
  agents/
    openai.yaml         # optional — Codex-specific UI/policy metadata
  scripts/              # optional — executable code (loaded on demand)
  references/           # optional — documentation (loaded on demand)
  assets/               # optional — templates, fonts, icons
```

`SKILL.md` has YAML frontmatter delimited by `---` followed by Markdown body:

```yaml
---
name: my-skill # required
description: What the skill does and when # required
license: MIT # optional open-standard field
compatibility: Requires Python 3.14+ # optional open-standard field
metadata: # optional open-standard field
  author: example-org
  version: '1.0'
allowed-tools: Read Bash(git:*) # optional — experimental
---
```

#### Required frontmatter

| Field         | Constraints                                                                                                                                                           | Source                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `name`        | Max 64 chars. Lowercase letters, numbers, hyphens only. Must match parent directory name. Must not start/end with hyphen, no consecutive hyphens. `^[a-z][a-z0-9-]*$` | `agentskills.io/specification`, `developers.openai.com/codex/skills` |
| `description` | Max 1024 chars. Non-empty. Describes what the skill does and when to use it. Primary routing signal for implicit invocation.                                          | `agentskills.io/specification`, `developers.openai.com/codex/skills` |

#### Optional open-standard fields

| Field           | Type   | Constraints                                                           | Source                         |
| --------------- | ------ | --------------------------------------------------------------------- | ------------------------------ |
| `license`       | string | License name or reference to bundled `LICENSE.txt`                    | `agentskills.io/specification` |
| `compatibility` | string | Max 500 chars. Environment requirements (binaries, network, packages) | `agentskills.io/specification` |
| `metadata`      | map    | Arbitrary key-value mapping. E.g. `author`, `version`                 | `agentskills.io/specification` |
| `allowed-tools` | string | Space-separated tool references. Experimental — support varies        | `agentskills.io/specification` |

#### `name` restrictions

- Must be 1–64 characters
- Only lowercase alphanumeric (`a-z`, `0-9`) and hyphens (`-`)
- Must not start or end with a hyphen
- Must not contain consecutive hyphens (`--`)
- **Must match the parent directory name** (Codex-specific enforcement)

#### `description` conventions

- The description is the primary routing signal for Codex's implicit invocation
- Should include both what the skill does and specific trigger phrases
- "When to use" information belongs in description, not body — the body is only
  loaded after the skill triggers
- Good: `"Runs ESLint in fix mode on staged JavaScript and TypeScript files when the user asks to fix lint errors"`
- Poor: `"Helps with code"`

#### Body content

The Markdown body after frontmatter contains the instruction set. Codex loads the
full body only after deciding to activate the skill (progressive disclosure).
Recommended structure:

1. Purpose — one sentence: when to use this skill
2. Inputs — what the agent must collect before running
3. Procedure — numbered steps referencing `scripts/` or `references/` files
4. Outputs — what the user sees on success
5. Failure modes — known errors and recovery hints

Body should be kept small (≤ 2 KB recommended). Deep context should be pushed
to `references/` files.

## 2. Supporting files

### `agents/openai.yaml` (Codex-specific)

The `agents/openai.yaml` companion file provides UI metadata, invocation policy,
and MCP tool dependencies. It is **optional** — skills work in Codex without it.

```yaml
interface:
  display_name: 'Optional user-facing name'
  short_description: 'Optional user-facing description'
  icon_small: './assets/small-logo.svg'
  icon_large: './assets/large-logo.png'
  brand_color: '#3B82F6'
  default_prompt: 'Optional surrounding prompt to use the skill with'

policy:
  allow_implicit_invocation: false # default: true

dependencies:
  tools:
    - type: 'mcp'
      value: 'openaiDocs'
      description: 'OpenAI Docs MCP server'
      transport: 'streamable_http'
      url: 'https://developers.openai.com/mcp'
```

**`interface` fields:**

| Field               | Required | Description                                     |
| ------------------- | -------- | ----------------------------------------------- |
| `display_name`      | No       | Human-readable name for UI                      |
| `short_description` | No       | Short description for skill chips/lists         |
| `icon_small`        | No       | Path relative to skill directory (small icon)   |
| `icon_large`        | No       | Path relative to skill directory (large icon)   |
| `brand_color`       | No       | Hex colour for UI branding                      |
| `default_prompt`    | No       | Default prompt surrounding the skill invocation |

**`policy` fields:**

| Field                       | Default | Description                                                      |
| --------------------------- | ------- | ---------------------------------------------------------------- |
| `allow_implicit_invocation` | `true`  | When `false`, skill is only invoked explicitly via `$skill-name` |

**`dependencies.tools` fields:**

| Field         | Description                                   |
| ------------- | --------------------------------------------- |
| `type`        | Dependency type (e.g. `"mcp"`)                |
| `value`       | MCP server identifier                         |
| `description` | Human-readable description                    |
| `transport`   | Transport protocol (e.g. `"streamable_http"`) |
| `url`         | Server URL                                    |

### `scripts/` directory

Executable scripts (Python, Bash, etc.) loaded on demand by Codex when SKILL.md
references them. Not pre-loaded into context — preserves token budget.

### `references/` directory

Markdown documentation files loaded into context as needed. Used for deep context
that would bloat `SKILL.md`.

### `assets/` directory

Static files (templates, icons, fonts) used in skill output.

## 3. Discovery and installation paths

### Skill scopes

Codex discovers skills from four scopes, checked in priority order:

| Scope      | Path                                                          | Use case                                             |
| ---------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| **REPO**   | `.agents/skills/` in current, parent, or Git root directories | Team workflows committed to the repository           |
| **USER**   | `$HOME/.agents/skills/` (defaults to `~/.agents/skills`)      | Personal skill collection                            |
| **ADMIN**  | `/etc/codex/skills/`                                          | Organisation-wide defaults                           |
| **SYSTEM** | Bundled with Codex by OpenAI                                  | Built-in skills (`skill-creator`, `skill-installer`) |

**Repo scope scanning:** Codex scans `.agents/skills/` in every directory from
the current working directory up to the repository root. Skills in parent
directories are available but lower priority.

**Symlinks:** Codex follows symlinked skill folders and resolves the symlink
target during scanning.

**Plugins:** For distribution beyond a single repo, skills can be packaged as
plugins. Plugins support connectors and multi-skill bundles.

### Installation methods

1. **Manual:** Copy skill directory into one of the discovery paths
2. **`$skill-installer`:** Built-in command that downloads curated skills from
   `github.com/openai/skills` or other GitHub repos:
   ```bash
   $skill-installer linear
   $skill-installer --repo my-org/my-skills --path skills/ci
   ```
3. **Plugin install:** For reusable distribution with connectors

### Disabling skills

Individual skills can be disabled in `~/.codex/config.toml`:

```toml
[[skills.config]]
path = "/home/user/.agents/skills/noisy-skill/SKILL.md"
enabled = false
```

### `$CODEX_HOME`

`$CODEX_HOME` defaults to `$HOME/.codex`. The `$skill-installer` installs curated
skills to `$CODEX_HOME/skills/`. Some community sources document `~/.codex/skills/`
as the personal skill path, while official docs specify `~/.agents/skills/`.

## 4. Invocation modes

### Explicit invocation

- **TUI:** Type `$skill-name` in the Codex CLI terminal UI
- **`codex exec`:** Pass skill name via command line: `codex exec $skill-name "task description"`
- **Chat selector:** Use the `/skills` selector to browse and select available skills

### Implicit invocation (default: enabled)

Codex matches the user's prompt against every skill's `description` field and
automatically activates the best-matching skill. Only `name` and `description`
are used for routing — the body is loaded only after the skill is activated.

### Policy-controlled invocation

When `agents/openai.yaml` sets `policy.allow_implicit_invocation: false`, the
skill is only activated via explicit `$skill-name` invocation. This is useful
for skills that should not trigger automatically.

### Progressive disclosure

1. **Metadata** (~100 tokens): `name` and `description` loaded at startup for all skills
2. **Instructions** (≤ 2 KB recommended): Full `SKILL.md` body loaded when skill activates
3. **Resources** (on demand): `scripts/`, `references/`, `assets/` loaded only when referenced

## 5. Tool and permission model

### `allowed-tools` (experimental, open standard)

The Agent Skills open standard defines an optional `allowed-tools` field as a
space-separated string of pre-approved tool references. This field is
**experimental** and support varies between agent implementations. Codex's
documentation does not specify a dedicated tool permission model.

**Example:** `allowed-tools: Bash(git:*) Bash(jq:*) Read`

**Known:**

- The format supports tool names with optional parenthesised scope constraints
- Codex may or may not enforce `allowed-tools` — this is not documented
- The field originates from the open standard, not from a Codex-specific model

### MCP tool dependencies (`agents/openai.yaml`)

Codex supports declaring MCP server dependencies in `agents/openai.yaml`:

```yaml
dependencies:
  tools:
    - type: 'mcp'
      value: 'openaiDocs'
      transport: 'streamable_http'
      url: 'https://developers.openai.com/mcp'
```

These are tool requirements, not permission boundaries. The MCP servers provide
capabilities that the skill can use, but there is no documented grant/deny model.

### Absence of permission system

- Codex has **no equivalent** of Claude Code's `allowed-tools`/`disallowed-tools`
  permission model
- Codex has **no equivalent** of OpenCode's resource-glob permission model
  (`edit: { "src/**/*.ts": allow }`)
- The experimental `allowed-tools` field is the closest concept, but its runtime
  behaviour in Codex is not documented

### IR permission mapping implications

When implementing the adapter, tools listed in `allowed-tools` or MCP dependencies
in `agents/openai.yaml` will need to be mapped to IR `Permission[]` and
`Capability[]`. Without a documented permission model, the mapping will be
inherently lossy. The adapter must:

- Map known tool references to IR capabilities where possible
- Preserve unrecognised tool references in extensions
- Produce diagnostics for all lossy or experimental mappings

## 6. Codex-specific extensions

### `agents/openai.yaml` (detailed)

The companion YAML file carries all Codex-specific logic. It is the extension
mechanism in place of Claude's extended frontmatter.

**Fields that have no IR equivalent and must be preserved in extensions:**

| Field path                         | Reason                                       |
| ---------------------------------- | -------------------------------------------- |
| `interface.display_name`           | UI presentation only                         |
| `interface.short_description`      | UI presentation only                         |
| `interface.default_prompt`         | Codex-specific invocation behaviour          |
| `policy.allow_implicit_invocation` | Codex-specific invocation policy             |
| `dependencies.tools`               | MCP dependency references — no IR equivalent |

### Built-in CLI skills

Codex ships two built-in skills managed as CLI functionality:

1. **`$skill-creator`** — Interactive wizard that scaffolds `SKILL.md` + `agents/openai.yaml`
2. **`$skill-installer`** — Downloads curated skills from `github.com/openai/skills`

Both are accessible as skills but behave as CLI commands with scripts.

### Skill categories (OpenAI skills catalogue)

The `github.com/openai/skills` repository organises skills into tiers:

- `.system/` — Pre-installed system skills
- `.curated/` — Curated community skills
- `.experimental/` — Experimental skills (installed on demand)

## 7. Comparison: Claude Code vs OpenCode vs Codex

| Aspect                    | Claude Code (adapter-claude)                       | OpenCode (adapter-opencode)                                 | Codex (adapter-codex)                                                |
| ------------------------- | -------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| **Required frontmatter**  | `name` (optional), `description` (recommended)     | `description` (required for agents), `agent` (for commands) | `name`, `description` (both required)                                |
| **`name` constraint**     | None documented                                    | Derived from filename                                       | Must match parent directory name                                     |
| **Unknown fields**        | Preserved in extensions with CLAUDE-002 diagnostic | Preserved in extensions with OPENCODE-004 diagnostic        | Must be preserved per open standard                                  |
| **Permission system**     | `allowed-tools` / `disallowed-tools` (tool list)   | `permission.edit` / `permission.bash` (resource globs)      | Experimental `allowed-tools` only; MCP deps via `agents/openai.yaml` |
| **Skill types**           | Single (skill)                                     | Two: agent + command                                        | Single (skill)                                                       |
| **Companion files**       | None (all in frontmatter)                          | None (all in frontmatter)                                   | `agents/openai.yaml`                                                 |
| **Discovery (repo)**      | `.claude/skills/<name>/SKILL.md`                   | `.opencode/agents/<name>.md`                                | `.agents/skills/<name>/SKILL.md`                                     |
| **Discovery (user)**      | `~/.claude/skills/<name>/SKILL.md`                 | `~/.config/opencode/agents/<name>.md`                       | `~/.agents/skills/<name>/SKILL.md`                                   |
| **Invocation (explicit)** | `/skill-name` (slash command)                      | Agent/command name in prompt                                | `$skill-name` (dollar prefix)                                        |
| **Invocation (implicit)** | Description matching                               | Description matching                                        | Description matching                                                 |
| **Model override**        | `model` in frontmatter                             | `model` in frontmatter                                      | Not in frontmatter; implied by Codex                                 |
| **Hooks / lifecycle**     | `hooks.preToolUse`                                 | None                                                        | None                                                                 |
| **Subagent execution**    | `context: fork`                                    | `mode: subagent`                                            | None documented                                                      |
| **Scripts directory**     | `scripts/` (optional)                              | Not applicable                                              | `scripts/` (optional)                                                |
| **References directory**  | Implicit via markdown links                        | Not applicable                                              | `references/` (optional)                                             |
| **Disable mechanism**     | `disabled: true`                                   | Not applicable                                              | `~/.codex/config.toml`                                               |
| **Built-in management**   | None                                               | None                                                        | `$skill-creator`, `$skill-installer`                                 |

### Open-standard fields shared by all three

`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`

## 8. Limitations and unknowns

### Documented limitations

1. **`allowed-tools` is experimental** — The field is marked experimental in the
   open standard. Its runtime behaviour in Codex is not formally defined. The
   adapter must produce a diagnostic when encountering it.

2. **`name` must match parent directory** — Codex enforces that the skill
   directory name matches the `name` field in frontmatter. This affects
   `detect()` (must validate the relationship) and `install()` (must create
   correctly-named directories).

3. **Only `name` + `description` used for routing** — No other frontmatter
   fields influence Codex's decision to activate a skill. Fields like
   `when_to_use` (Claude-specific) have no effect in Codex.

4. **No tool-level permission system** — Unlike Claude Code and OpenCode, Codex
   does not document a permission grant/deny mechanism for individual tools.
   Any permission mapping to IR will be lossy.

5. **`agents/openai.yaml` is a secondary file** — Unlike Claude Code where all
   metadata lives in `SKILL.md` frontmatter, Codex splits metadata across
   `SKILL.md` and `agents/openai.yaml`. The adapter must handle two files:
   parsing both and merging into a single `ClaudeSkillResult`-like structure.

6. **Duplicate skill names across scopes** — Codex does not merge skills with
   the same name; both appear in skill selectors. Behaviour when both have
   different content is undefined.

7. **`version` is not a portable top-level field** — The open standard does not
   define `version` at the top level. Codex's `agents/openai.yaml` also has no
   version field. Versioning is done via `metadata.version` or external
   mechanisms (Git tags, registry releases).

### Unknowns requiring investigation

1. **Strictness of unknown frontmatter fields** — The open standard says "Unknown
   fields MUST be preserved by tooling." It is unknown whether Codex silently
   ignores unknown fields, produces warnings, or rejects them. This affects
   whether the adapter should produce a diagnostic for unknown fields (like
   Claude's CLAUDE-002) or preserve them silently.

2. **`agents/openai.yaml` error handling** — It is unknown how Codex behaves
   when `agents/openai.yaml` has invalid YAML, missing required sub-fields, or
   references non-existent icon/script paths. Does it silently ignore the file,
   produce an error, or fall back to default behaviour?

3. **Skill prioritisation across scopes** — When the same skill name exists in
   REPO, USER, ADMIN, and SYSTEM scopes, the precedence order is not documented.
   Does REPO win? SYSTEM? Does Codex show all four independently?

4. **`$CODEX_HOME` vs `~/.agents/skills`** — Official documentation references
   `~/.agents/skills/` for user skills, but `$skill-installer` installs to
   `$CODEX_HOME/skills/` (defaulting to `~/.codex/skills/`). The relationship
   between these paths is unclear. Are both scanned? Is one a symlink target?

5. **Behaviour of `allowed-tools` with parenthesised scopes** — The format
   `Bash(git:*)` suggests scoped tool access, but no documentation confirms
   how Codex interprets or enforces the scope expression.

## 9. Testable assumptions

1. Codex `detect()` returns `true` for content with `---` frontmatter containing
   both `name` and `description` fields (open standard requirement).

2. Codex `detect()` returns `true` for `.agents/skills/<name>/SKILL.md` file
   paths where the `name` in frontmatter matches the parent directory name.

3. Codex `detect()` returns `false` for content without `name` or `description`
   frontmatter, empty content, or non-`.md` files.

4. Codex `parse()` returns `name`, `description`, `body`, and preserves
   `license`, `compatibility`, `metadata`, and `allowed-tools` in extensions.

5. Unknown frontmatter fields are preserved in extensions without diagnostic
   (open standard requirement — unlike Claude Code which explicitly diagnoses
   unknown fields).

6. `agents/openai.yaml` is optional — `parse()` succeeds for skills without it.

7. When `agents/openai.yaml` is present, `parse()` reads
   `interface.display_name`, `policy.allow_implicit_invocation`, and
   `dependencies.tools` and preserves them in extensions.

8. `compile()` produces deterministic output with `name` and `description` first,
   followed by open-standard optional fields, followed by Codex extensions.

9. `install()` creates a directory at the target path named after the skill's
   `name`, containing `SKILL.md` and optionally `agents/openai.yaml`.

10. Cross-scope duplicate names are not merged — both skills remain available
    independently.

11. The `name` constraint (lowercase, kebab-case, max 64 chars, no leading/
    trailing/consecutive hyphens) is enforced during detection and parse.

12. `version` is not a required top-level field — skills without `version` are
    valid.

## 10. Sources

| Source                     | URL                                                             | Notes                                                                    |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Official Codex skills docs | `https://developers.openai.com/codex/skills`                    | Primary source for format, discovery, invocation, `agents/openai.yaml`   |
| Agent Skills specification | `https://agentskills.io/specification`                          | Open standard — frontmatter schema, naming rules, progressive disclosure |
| Codex CLI repository       | `https://github.com/openai/codex`                               | Reference implementation — `codex-rs/skills/`, built-in skills           |
| OpenAI skills catalogue    | `https://github.com/openai/skills`                              | Curated skill examples, `agents/openai.yaml` examples                    |
| Codex Knowledge Base       | `https://codex.danielvaughan.com/`                              | Community documentation — cross-agent comparison, installation           |
| Agensi guides              | `https://www.agensi.io/learn/codex-cli-skills-install-skill-md` | Community documentation — installation walkthrough                       |
