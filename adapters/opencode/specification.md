# OpenCode Adapter Specification

**Package:** `@skillbridge/adapter-opencode`
**Status:** Specification (pre-implementation)
**Date:** 2026-07-28

## 1. Overview

The OpenCode adapter converts between SkillBridge IR and the OpenCode Agent Skills
format. OpenCode skills are markdown files with YAML frontmatter stored in
`.opencode/agents/` (agents) or `.opencode/commands/` (commands). This adapter
implements `detect()`, `parse()`, `normalize()`, and `compile()` from the
`Adapter` interface.

### Source Format

OpenCode distinguishes two skill types with different frontmatter schemas:

**Agent files** (`.opencode/agents/<name>.md`):

```yaml
---
description: short description
mode: primary | subagent             # optional, default: primary
instruction: path/to/instruction.md  # optional, alternative to inline body
model: gpt-4                         # optional
permission:                          # optional
  edit: allow | deny | ask | { <glob>: allow|deny|ask }
  bash: { <glob>: allow|deny|ask }
rule: path/to/rules.md               # optional
---
System prompt body here...
```

**Command files** (`.opencode/commands/<name>.md`):

```yaml
---
description: short description
agent: agent-name # reference to agent by name
model: gpt-4 # optional
instruction: path/to/instruction.md # optional
rule: path/to/rules.md # optional
---
System prompt body here...
```

### Target Format

Compilation produces the same format — markdown with YAML frontmatter.
The compiler must emit valid OpenCode agent/command files that can be placed
into `.opencode/agents/` or `.opencode/commands/`.

## 2. Parsed Intermediate Format

The adapter returns `OpenCodeSkillResult` from `parse()`:

```typescript
interface OpenCodeSkillResult {
  kind: 'agent' | 'command';
  frontmatter: {
    description?: string;
    mode?: 'primary' | 'subagent';
    instruction?: string;
    model?: string;
    permission?: OpenCodePermission;
    rule?: string;
    agent?: string; // command only
  };
  body: string; // the markdown body (system prompt)
  extensions?: Record<string, unknown>; // unknown frontmatter fields
  diagnostics?: Diagnostic[];
}

interface OpenCodePermission {
  edit?: boolean | string | Record<string, string>;
  bash?: Record<string, string>;
}
```

## 3. Field Mapping — Agent → IR

### Identity

| IR Field               | Source                    | Notes                                        |
| ---------------------- | ------------------------- | -------------------------------------------- |
| `identity.name`        | derived from filename     | Filename (kebab-case) → display name; see §7 |
| `identity.version`     | `'0.0.0'`                 | OpenCode has no version field; use default   |
| `identity.description` | `frontmatter.description` | Direct mapping                               |

### Invocation

| IR Field                  | Source        | Notes                                                  |
| ------------------------- | ------------- | ------------------------------------------------------ |
| `invocation.instructions` | `body`        | The entire body after frontmatter is the system prompt |
| `invocation.example`      | not available | OpenCode has no example field                          |

### Capabilities

Mapped from `permission` field:

| OpenCode Permission        | IR Capability  | Notes                    |
| -------------------------- | -------------- | ------------------------ |
| `permission.edit: allow`   | `file-write`   | If any edit allowed      |
| `permission.edit: deny`    | —              | No file-write capability |
| `permission.bash.*: allow` | `command-exec` | If any bash allowed      |
| Mode `subagent`            | `subagent`     | If mode=subagent         |

### Permissions

| IR Field      | Source                       | Notes                                               |
| ------------- | ---------------------------- | --------------------------------------------------- |
| `permissions` | translated from `permission` | OpenCode permission model → IR Permission[]; see §5 |

### Extensions

Any frontmatter field not in the known set (`description`, `mode`, `instruction`,
`model`, `permission`, `rule`, `agent`) is preserved in `extensions`.

## 4. Field Mapping — Command → IR

Commands share most fields with agents, except:

- `frontmatter.agent` maps to a `_openCodeCommandAgent` extension field
- Commands cannot have `mode` or `permission` (those are agent-only)
- Commands reference an agent by name for execution context

## 5. Permission Mapping

OpenCode permission model is glob-based and action-oriented:

```yaml
permission:
  edit: allow # or deny/ask or glob map
  bash:
    'pnpm *': allow
    'git *': deny
    '*': ask
```

Mapping to IR `Permission[]`:

| OpenCode Pattern            | IR Permission                                                                |
| --------------------------- | ---------------------------------------------------------------------------- |
| `edit: allow`               | `{ resource: 'fs', actions: ['write'] }`                                     |
| `edit: { 'src/*': allow }`  | `{ resource: 'fs:src/*', actions: ['write'] }`                               |
| `bash: { 'pnpm *': allow }` | `{ resource: 'bash:pnpm *', actions: ['execute'] }`                          |
| `bash: { 'git *': deny }`   | `{ resource: 'bash:git *', actions: ['execute'] }` — with diagnostic warning |

Lossy mappings produce diagnostics:

- `edit: ask` → soft warning: "interactive permission not representable in IR"
- `bash: { '*': ask }` → soft warning
- Mixed glob maps (allow + deny on same resource) → mapped with diagnostic

## 6. IR → OpenCode Compilation

### Agent compilation

```typescript
compile(normalized: OpenCodeSkillResult): string
```

Output structure:

1. YAML frontmatter with known fields: `description`, `mode` (if subagent),
   `instruction` (if set), `model` (if set), `permission` (if set), `rule` (if set)
2. Extension fields preserved
3. `---` delimiter
4. Body (system prompt)

Permission compilation (IR → OpenCode):

- IR `permissions` with `resource: 'fs'` → `permission.edit: allow`
- IR `permissions` with `resource: 'bash:*'` → `permission.bash.*: allow`
- Unknown resource patterns → extension field `_openCodePermissions`

### Command compilation

Same as agent but:

- Include `agent` field referencing the target agent name
- Omit `mode` and `permission` fields
- Include `_openCodeCommandAgent` from extensions if present

## 7. Naming and Discovery

### Discovery

`detect(source)` returns `true` if:

- Content starts with `---` (YAML frontmatter)
- Frontmatter parses as valid YAML
- Contains at least one of: `description`, `mode`, `agent`, `rule`

### Naming

- Agent/command names derived from filename (kebab-case, no extension)
- Display name: kebab-case → title case (`my-agent` → `My Agent`)
- `identity.name` in IR uses the filename-derived name

### Filename Constraints

- Must match `/^[a-z][a-z0-9]*(-[a-z0-9]+)*\.md$/`
- Only lowercase letters, digits, and hyphens
- Must end in `.md`

## 8. Diagnostics

| Code         | Severity | Description                               |
| ------------ | -------- | ----------------------------------------- |
| OPENCODE-001 | error    | Malformed YAML frontmatter                |
| OPENCODE-002 | error    | Invalid mode value (not primary/subagent) |
| OPENCODE-003 | warning  | Interactive permission not representable  |
| OPENCODE-004 | warning  | Lossy permission mapping                  |
| OPENCODE-005 | info     | Unknown frontmatter field preserved       |
| OPENCODE-006 | error    | Missing required field (description)      |
| OPENCODE-007 | error    | Source path not found                     |

## 9. Unknowns and Testable Assumptions

### Unknowns (require further investigation)

1. **OpenCode SDK types** — `@opencode-ai/plugin` v1.18.7 types were inspected
   via the installed local package. The exact set of frontmatter fields may differ
   in newer versions. Re-verify against latest `@opencode-ai/sdk` before
   implementation.

2. **Config integration** — OpenCode's `opencode.json` `permission` field may
   act as a default/fallback for permissions. The adapter should document that
   it parses skill-level permissions only; config-level permissions are out of
   scope for `parse()`.

3. **Subagent/permission interaction** — When `mode: subagent`, subagents inherit
   the parent's permissions. The adapter should document that IR permissions
   represent declared permissions, not inherited ones.

4. **Multiple rule files** — OpenCode allows `rule` to be an array. The adapter
   should handle both string and array forms.

5. **Instruction file references** — The `instruction` field references an
   external markdown file. The adapter's `parse()` should flag this with a
   diagnostic but does not need to resolve it.

### Testable Assumptions

| #   | Assumption                                            | Test Method                               |
| --- | ----------------------------------------------------- | ----------------------------------------- |
| 1   | Frontmatter is YAML delimited by `---`                | Parse fixture with valid YAML             |
| 2   | Frontmatter fields are case-sensitive                 | Parse with `Description` vs `description` |
| 3   | `mode` is `primary` or `subagent`                     | Parse with invalid mode → OPENCODE-002    |
| 4   | `permission.edit` accepts boolean or object           | Parse all three forms                     |
| 5   | `permission.bash` is a glob map                       | Parse with mixed allow/deny               |
| 6   | Unknown fields go to extensions                       | Parse with custom field → extension       |
| 7   | Missing body is empty string not undefined            | Parse agent with no body                  |
| 8   | Round-trip preserves all known fields                 | Parse → compile → verify                  |
| 9   | Round-trip preserves unknown fields                   | Parse → compile → verify extensions       |
| 10  | Filename without .md fails detect                     | Detect with `foo.txt` → false             |
| 11  | Empty frontmatter (just `---`) parses as empty object | Parse `---\n---\nbody`                    |
| 12  | Body after closing `---` may be blank                 | Parse with trailing whitespace            |

## 10. Agent Manifest

```typescript
const MANIFEST: AdapterManifest = {
  name: 'adapter-opencode',
  version: '0.0.0',
  vendor: 'skillbridge',
  adapterVersion: '0.0.0',
  supports: {
    sourceFormats: ['markdown'], // OpenCode skills are markdown
    targetFormats: ['markdown'], // compile() produces markdown
  },
  capabilities: ['detect', 'parse', 'normalize', 'compile'],
  description: 'OpenCode Agent Skills adapter for SkillBridge',
};
```

## 11. File Structure

```
adapters/opencode/
  src/
    index.ts           — Adapter implementation (default export)
    index.test.ts      — Unit tests
    integration/
      filesystem.test.ts  — Integration tests with temp dir I/O
    roundtrip/
      index.test.ts       — Round-trip parse→compile→parse tests
  fixtures/             — See fixtures-plan.md
    valid-agent-01.md     — Minimal valid agent
    valid-agent-02.md     — Agent with full frontmatter
    valid-agent-03.md     — Agent with permission globs
    valid-command-01.md   — Minimal valid command
    valid-command-02.md   — Command with agent reference
    invalid-01.md         — Malformed YAML
    invalid-02.md         — Invalid mode value
    edge-01.md            — Empty frontmatter
    edge-02.md            — Only body, no frontmatter
    edge-03.md            — Instruction file reference
    edge-04.md            — Array rule field
    edge-05.md            — Ask permission mode
    edge-06.md            — Unknown fields in frontmatter
```
