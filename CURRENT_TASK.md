# Task: Source-Document-to-IR Normalization Pipeline

## Objective

Implement a normalization pipeline in `@skillbridge/conversion` that converts parsed source documents (SKILL.md + skillbridge.yaml) into `NormalizedSkill` IR via interfaces, preserving provenance, merging metadata deterministically, retaining extensions, detecting conflicts, and rejecting silent overwrites.

## Acceptance Criteria

### 1. Architecture & Location

- Implement in `packages/conversion/src/normalize.ts` with a single `normalizePackageToIR()` entry point.
- Use interfaces from `@skillbridge/adapter-sdk` (`Adapter`, `AdapterManifest`) as abstractions — no concrete adapter imports.
- Export from `packages/conversion/src/index.ts`.
- `NormalizationInput` accepts `SkillMdResult`, `PackageManifest` (optional, from skillbridge.yaml), `SkillPackageResourceDirs`, and package path.
- `NormalizationResult` contains `NormalizedSkill`, `FieldProvenance[]`, and `Diagnostic[]`.

### 2. Field-Provenance Tracking

- Define `FieldProvenance` type with `field: string`, `source: 'frontmatter' | 'body-section' | 'skillbridge-yaml' | 'default'`, and optional `SourceLocation`.
- Every field in the output `NormalizedSkill` has a corresponding provenance entry.

### 3. Deterministic Merge from skillbridge.yaml

- Package identity fields (`name`, `version`, `description`) come from frontmatter first, skillbridge.yaml second.
- `author` and `license` come from skillbridge.yaml only.
- `scripts` and `dependencies` come from skillbridge.yaml only.
- When both frontmatter and skillbridge.yaml define `name` (or `version`, `description`), the frontmatter value wins and a `CONV-002` **warning** diagnostic is emitted.

### 4. Body-Section Mapping

- Known body section headings map to IR fields:
  - `## Description` → `invocation.instructions`
  - `## Usage` → `invocation.example`
  - `## Inputs` → `inputs` (parsed as YAML list from body text)
  - `## Outputs` → `outputs` (parsed as YAML list from body text)
  - `## Resources` → `resources` (parsed as YAML list)
  - `## Environment` → `environment` (parsed as YAML list)
  - `## Execution` → `execution` (parsed as YAML object)
- Unrecognized section headings produce `CONV-003` **info** diagnostics but are stored in `extensions`.
- Section-body YAML parsing errors produce `CONV-004` **warning** diagnostics (malformed body section).

### 5. Extensions Preservation

- Unrecognized frontmatter fields → `NormalizedSkill.extensions`.
- Unrecognized body sections (with parsed YAML) → `extensions.<heading>`.
- `skillbridge.yaml` unknown fields → `extensions.skillbridge` (with `CONV-005` **info** diagnostic).
- The original `extensions` from `SkillMdResult` are merged into the output extensions.

### 6. Conflict Detection

- `CONV-001` — field defined in two equal-precedence sources with different values (**error**).
- `CONV-002` — higher-precedence source overwrites lower-precedence (**warning**).
- `CONV-003` — unrecognized body section (**info**).
- `CONV-004` — malformed YAML in body section (**warning**).
- `CONV-005` — unrecognized skillbridge.yaml field (**info**).
- `CONV-006` — missing required IR field (**error**, name or version absent after merge).

### 7. Backward Compatibility

- Pure function, no side effects.
- All existing tests continue to pass.
- New types are additive; existing interfaces unchanged.

## Tests (`packages/conversion/src/normalize.test.ts`)

| Test                      | Scenario                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| valid package             | Full SKILL.md + skillbridge.yaml → complete NormalizedSkill            |
| incomplete package        | Minimal SKILL.md only → partial NormalizedSkill with CONV-006          |
| conflicting name          | SKILL.md and skillbridge.yaml define different name → CONV-002 warning |
| body-section mapping      | Description, Usage sections map to invocation                          |
| unrecognized body section | Custom heading goes to extensions with CONV-003 info                   |
| malformed body YAML       | Invalid YAML in Inputs section → CONV-004 warning                      |
| extensions preservation   | Unknown frontmatter fields appear in output extensions                 |
| provenance tracking       | Every normalized field has a provenance entry                          |
| no silent overwrite       | skillbridge.yaml name when frontmatter also has it → warning emitted   |
| missing required fields   | No name or version anywhere → CONV-006 error                           |

## Precedence Rules (high → low)

1. SKILL.md frontmatter
2. skillbridge.yaml (for `name`, `version`, `description` — lower precedence; `author`, `license`, `scripts`, `dependencies` — only source)
3. SKILL.md body sections
4. Defaults / inferred values

## Implementation Notes

- Update `packages/conversion/package.json` to add `devDependencies` on `typescript` (already present).
- Add dependencies: `@skillbridge/core`, `@skillbridge/ir`, `@skillbridge/parser`, `@skillbridge/adapter-sdk` via relative imports.
- No changes to parser, ir, or adapter-sdk packages.
- Use `yaml.load()` for parsing body-section YAML.

## Verification

```powershell
pnpm test:unit -- --project unit -t "normalize"
pnpm test:unit
pnpm lint
pnpm typecheck
pnpm build
```
