# Claude Code Adapter Specification

**Package:** `@skillbridge/adapter-claude`
**Status:** Specification (pre-implementation)
**Date:** 2026-07-28

## 1. Overview

The Claude Code adapter converts between SkillBridge IR and Claude Code Agent Skills.
Claude Code skills are directories containing `SKILL.md` files with YAML frontmatter,
stored in `.claude/skills/` (project) or `~/.claude/skills/` (user). This adapter
implements `detect()`, `parse()`, `normalize()`, and `compile()` from the `Adapter`
interface.

The Claude Code skill format is a superset of the cross-agent Agent Skills open
standard (`agentskills.io`). Claude Code extends the standard with invocation
control, tool permissions, subagent execution, and hooks.

### Source Format

A Claude Code skill is a directory containing at minimum a `SKILL.md` file:

```
my-skill/
  SKILL.md          # required — frontmatter + instructions
  reference.md      # optional — detailed reference (loaded on demand)
  examples.md       # optional — usage examples (loaded on demand)
  scripts/          # optional — executable helpers (not read into context)
```

`SKILL.md` has YAML frontmatter delimited by `---` followed by markdown body:

```yaml
---
name: my-skill                              # optional, defaults to directory name
description: What the skill does and when   # recommended
when_to_use: Additional trigger phrases     # optional
disabled: false                             # optional, skip loading if true
allowed-tools: Read Write Edit Bash Grep    # optional, pre-approved tools
disallowed-tools: AskUserQuestion           # optional, removed tools
model: claude-sonnet-4-20250514             # optional, model override
effort: medium                              # optional, reasoning depth
context: fork                               # optional, run as subagent
agent: claude-code                          # optional, subagent type
background: true                            # optional, fork behaviour
hooks:                                      # optional, lifecycle hooks
  preToolUse: scripts/validate.sh
paths: src/api/**/*.ts                      # optional, path-scoped activation
shell: bash                                 # optional, inline shell
arguments: [issue, branch]                  # optional, positional args
argument-hint: "<issue> [branch]"           # optional, autocomplete hint
disable-model-invocation: false             # optional, manual-invoke only
user-invocable: true                        # optional, hide from / menu
---

# My Skill

## Instructions
Step-by-step guidance for Claude to follow.

## Examples
Concrete examples of skill usage.
```

Flat-file skills (single `.md` without a directory) are also supported:

```
.claude/skills/my-skill.md
~/.claude/skills/my-skill.md
```

These behave identically to directory-based skills but cannot include
supporting files.

### Target Format

Compilation produces the same format — markdown with YAML frontmatter.
The compiler emits valid `SKILL.md` content that can be placed into
`.claude/skills/<name>/SKILL.md` or packaged as a flat file.

## 2. Discovery Paths

Claude Code discovers skills in the following locations (order: project overrides user):

| Scope   | Path                                     | Type             |
| ------- | ---------------------------------------- | ---------------- |
| Project | `.claude/skills/<name>/SKILL.md`         | Directory skill  |
| Project | `.claude/skills/<name>.md`               | Flat-file skill  |
| Project | `.claude/commands/<name>.md`             | Flat-file command|
| User    | `~/.claude/skills/<name>/SKILL.md`       | Directory skill  |
| User    | `~/.claude/skills/<name>.md`             | Flat-file skill  |
| User    | `~/.claude/commands/<name>.md`           | Flat-file command|

Commands (`/command-name`) and skills (`/skill-name`) share the same `SKILL.md`
format. The distinction is purely filesystem location — `.claude/commands/`
vs `.claude/skills/`.

## 3. Frontmatter Field Reference

All fields are based on the official Claude Code documentation
(code.claude.com/docs/en/skills) and the Agent Skills open standard
(agentskills.io, platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).

### Claude Code Fields

| Field                    | Type                | Required | Default      | Description                                                |
| ------------------------ | ------------------- | -------- | ------------ | ---------------------------------------------------------- |
| `name`                   | string              | No       | directory name | Display name in listings. Does NOT change slash-command. |
| `description`            | string              | Recommended | first body paragraph | What the skill does and when to use it. Truncated at 1,536 chars. |
| `when_to_use`            | string              | No       | —            | Extended trigger phrases appended to description.         |
| `disabled`               | bool                | No       | false        | If true, skill is skipped during loading.                 |
| `allowed-tools`          | string or string[]  | No       | all tools    | Tools pre-approved without asking. Space/comma/YAML list. |
| `disallowed-tools`       | string or string[]  | No       | —            | Tools removed while skill active.                         |
| `model`                  | string              | No       | session      | Model override while skill active.                        |
| `effort`                 | string              | No       | session      | Reasoning depth: low, medium, high, xhigh, max.            |
| `context`                | string              | No       | —            | `fork` runs skill in isolated subagent.                   |
| `agent`                  | string              | No       | claude-code   | Subagent type when `context: fork`.                       |
| `background`             | bool                | No       | true         | Only with `context: fork`. true=background, false=await.  |
| `hooks`                  | object              | No       | —            | Lifecycle hooks (preToolUse, postToolUse, etc.).          |
| `paths`                  | string or string[]  | No       | —            | Glob patterns limiting auto-activation.                   |
| `shell`                  | string              | No       | bash         | Inline shell: bash or powershell.                         |
| `arguments`              | string or string[]  | No       | —            | Named positional args for `$name` substitution.           |
| `argument-hint`          | string              | No       | —            | Autocomplete hint text.                                   |
| `disable-model-invocation` | bool              | No       | false        | true = Claude cannot auto-load; manual `/name` only.      |
| `user-invocable`         | bool                | No       | true         | false = hide from `/` menu; Claude can still auto-load.   |

### Agent Skills Open Standard Fields (Cross-Agent)

| Field           | Type                | Required | Description                                           |
| --------------- | ------------------- | -------- | ----------------------------------------------------- |
| `name`          | string              | Yes      | Max 64 chars, lowercase + hyphens, matches dir name.  |
| `description`   | string              | Yes      | Max 1,024 chars.                                      |
| `license`       | string              | No       | SPDX identifier or reference to bundled license file. |
| `compatibility` | string              | No       | Max 500 chars. Environment requirements.              |
| `metadata`      | object              | No       | Arbitrary key-value metadata.                         |
| `allowed-tools` | string (space-separated) | No   | Experimental. Pre-approved tool names.                |

The Claude Code adapter should handle both variants: the strict open-standard
schema (name+description required) and the more permissive Claude Code schema.

### Type Parsing

- **Boolean fields** (`disabled`, `disable-model-invocation`, `user-invocable`,
  `background`): Accept `true`, `false`, `yes`, `no`, `on`, `off`, `1`, `0`
  in any letter case (Claude Code v2.1.218+). Before that, only `true`/`false`.
- **Tool lists** (`allowed-tools`, `disallowed-tools`): Accept space-separated
  string, comma-separated string, or YAML list of strings.
- **Paths** (`paths`): Accept comma-separated string or YAML list of globs.
- **Arguments** (`arguments`): Accept space-separated string or YAML list of strings.

## 4. Parsed Intermediate Format

The adapter returns `ClaudeSkillResult` from `parse()`:

```typescript
interface ClaudeSkillResult {
  name: string;           // from name field or directory name
  description: string;    // from description or first body paragraph
  frontmatter: Record<string, unknown>; // all parsed frontmatter fields
  body: string;           // the markdown body (skill instructions)
  extensions: Record<string, unknown>;  // unknown/unmapped frontmatter fields
  diagnostics: Diagnostic[];
  // resolved from frontmatter:
  allowedTools?: string[];
  disallowedTools?: string[];
  isForked?: boolean;     // context === 'fork'
  isManualOnly?: boolean; // disable-model-invocation === true
  isUserInvokable?: boolean; // default true
  paths?: string[];       // path-scoped activation globs
  arguments?: string[];   // named positional arguments
  argumentsHint?: string; // autocomplete hint
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  shell?: 'bash' | 'powershell';
  hooks?: Record<string, string>;
}
```

## 5. Normalization to IR

### Identity Mapping

| OpenCode Field    | IR Field              | Notes                                       |
| ----------------- | --------------------- | ------------------------------------------- |
| `name`            | `identity.name`       | From frontmatter or directory name hint.    |
| —                 | `identity.version`    | Defaults to `'0.0.0'`.                      |
| `description`     | `identity.description`| First 1,024 chars.                          |
| body              | `invocation.instructions` | Full markdown body.                      |

### Capability Derivation

| Condition                                  | Capability       |
| ------------------------------------------ | ---------------- |
| `allowed-tools` includes `Write`/`Edit`    | `file-write`     |
| `allowed-tools` includes `Bash`            | `command-exec`   |
| no `allowed-tools` (all tools available)   | `file-write`, `command-exec` |
| `context: fork`                            | — (no IR equivalent) |

### Permission Mapping

Claude Code uses tool-based permissions via `allowed-tools`/`disallowed-tools`,
not resource-glob-based permissions like OpenCode. The mapping to IR `Permission[]`:

| allowed-tools entry | IR Permission                |
| ------------------- | ---------------------------- |
| `Read`              | `{ resource: 'fs', actions: ['read'] }` |
| `Write` / `Edit`    | `{ resource: 'fs', actions: ['write'] }` |
| `Bash`              | `{ resource: 'bash:*', actions: ['execute'] }` |
| `Grep`              | `{ resource: 'fs', actions: ['search'] }` |
| `Search`            | `{ resource: 'fs', actions: ['search'] }` |
| `Git`               | ─ (not mapped)               |
| `AskUserQuestion`   | ─ (not mapped)               |

### Source Metadata

| Field                   | Value                        |
| ----------------------- | ---------------------------- |
| `source.format`         | `'markdown'`                 |
| `source.path`           | source path if from file     |

## 6. Compilation

Compilation produces a `SKILL.md` file with YAML frontmatter and markdown body:

- Known fields are emitted in a deterministic order
- Unknown fields are preserved in `extensions` and emitted as-is
- The body is emitted as the markdown content after the closing `---`
- Output is deterministic (no dates, random values, or filesystem state)

## 7. Diagnostic Codes

| Code          | Severity | Condition                                         |
| ------------- | -------- | ------------------------------------------------- |
| CLAUDE-001    | error    | Malformed YAML in frontmatter                     |
| CLAUDE-002    | warning  | Unknown frontmatter field (preserved in extensions)|
| CLAUDE-003    | warning  | Unsupported field value (e.g., invalid effort level) |
| CLAUDE-004    | info     | Boolean field parsed from non-boolean value       |
| CLAUDE-005    | info     | Tool name not in known tool set (preserved as-is) |

## 8. Install/Uninstall Planning

### Project Scope

- Directory skill: copy `SKILL.md` (and any supporting files) to `.claude/skills/<name>/`
- Flat-file skill: copy compiled markdown to `.claude/skills/<name>.md`

### User Scope

- Directory skill: copy to `~/.claude/skills/<name>/`
- Flat-file skill: copy to `~/.claude/skills/<name>.md`

### Uninstall

- Remove the skill directory or file from the project/user scope.

## 9. Unsupported or Ambiguous Behavior

| Feature              | IR Support | Handling                                |
| -------------------- | ---------- | --------------------------------------- |
| `hooks`              | None       | Preserved in extensions; diagnostic.    |
| `context: fork`      | None       | Preserved in extensions; diagnostic.    |
| `background`         | None       | Preserved in extensions; diagnostic.    |
| `model`              | None       | Preserved in extensions; diagnostic.    |
| `effort`             | None       | Preserved in extensions; diagnostic.    |
| `shell`              | None       | Preserved in extensions; diagnostic.    |
| `paths`              | None       | Preserved in extensions; diagnostic.    |
| `arguments`/`argument-hint`| None  | Preserved in extensions; diagnostic.    |
| `disable-model-invocation`| None   | Preserved in extensions; diagnostic.    |
| `user-invocable`     | None       | Preserved in extensions; diagnostic.    |
| `disabled`           | None       | Preserved in extensions; diagnostic.    |
| `allowed-tools`      | Partial    | Mapped to capabilities + permissions; unmapped tools preserved. |
| `disallowed-tools`   | None       | Preserved in extensions; diagnostic.    |
| Supporting files (scripts, references) | None | Not compiled; install step copies the directory tree. |
| Directory-vs-flat-file structure | None | Install writes to directory if compiled from one. |

## 10. Cross-Agent Compatibility

The Agent Skills open standard (`agentskills.io`) defines a minimal subset
that works across all compatible agents (Claude Code, Codex CLI, Cursor,
GitHub Copilot):

| Field             | Claude Code | Codex CLI | Cursor | GitHub Copilot |
| ----------------- | ----------- | --------- | ------ | -------------- |
| `name`            | Yes         | Yes       | Yes    | Yes            |
| `description`     | Yes         | Yes       | Yes    | Yes            |
| `when_to_use`     | Yes         | Yes       | Partial| Yes            |
| `allowed-tools`   | Yes         | No        | No     | No             |
| `context: fork`   | Yes         | No        | No     | No             |
| `hooks`           | Yes         | No        | No     | No             |

The adapter should not strip agent-specific fields but must document in
diagnostics which fields have limited cross-agent support.

## 11. Testable Assumptions

1. Skills can be flat files (`.claude/skills/<name>.md`) or directories
   (`.claude/skills/<name>/SKILL.md`). The adapter treats the content
   identically — the structure matters for install, not parse.
2. Frontmatter is standard YAML between `---` delimiters.
3. Boolean fields accept `true`/`false`/`yes`/`no`/`on`/`off`/`1`/`0`.
4. Tool lists accept space-separated, comma-separated, or YAML array.
5. The `description` field is recommended but not strictly required — without
   it, Claude uses the first body paragraph.
6. The `name` field defaults to the directory name; in a flat file, the
   filename (minus `.md`) is the default command name.
7. Combined `description` + `when_to_use` is truncated at 1,536 chars.
8. `allowed-tools` with the value `-` (YAML null) or empty string means
   no tools are pre-approved.
9. Unknown frontmatter fields are tolerated and can be preserved through
   a round-trip.
10. The `disabled: true` field makes the skill invisible to Claude — the
    adapter should not filter disabled skills but should produce a diagnostic.
11. Hooks field values that are relative paths are assumed to be relative
    to the skill directory.
12. The body markdown has no structural restrictions — it can be any valid
    markdown content.
13. `model` field accepts any model identifier string including `inherit`.
14. Supported `effort` values: `low`, `medium`, `high`, `xhigh`, `max`.
    Unrecognized values are preserved with a diagnostic.

## 12. Documentation Sources

This specification is based on the following sources (accessed 2026-07-28):

- **Official Claude Code Skills docs**: code.claude.com/docs/en/skills
- **Anthropic Agent Skills platform docs**: platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- **Agent Skills open standard**: agentskills.io/specification
- **Claude Code frontmatter field reference**: code.claude.com/docs/en/skills#frontmatter-reference
- **Claude Code Commands reference**: code.claude.com/docs/en/commands
