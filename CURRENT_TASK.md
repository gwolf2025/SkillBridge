# Task: Explicit Conversion Policies

**Slug:** `explicit-conversion-policies`
**Status:** Planning

---

## Objective

Replace the current three-valued policy mode (`strict | relaxed | permissive`) with semantically precise modes:

- **Strict** — Fail on any unsupported or lossy required behavior. No emulated, degraded, missing, or unknown capabilities allowed. Any security weakening blocks.
- **Safe** — Allow capabilities the target declares as safe emulations (`level: 'emulated'`). Warn on missing, degraded, or unknown capabilities, but allow conversion to proceed. **Fail on security weakening** — weakened or removed permissions always block.
- **Permissive** — Allow all conversions. Degraded output is accepted only with explicit diagnostics. Permissions must **never** be silently weakened — every permission delta produces a diagnostic.

---

## Acceptance Criteria

### AC1: Policy Mode Renamed

- `PolicyMode` is `'strict' | 'safe' | 'permissive'` (current `'relaxed'` removed)
- `'safe'` is the default when no policy is specified
- Old `'relaxed'` string is rejected with a diagnostic

### AC2: Strict Mode Semantics

- Missing capability → `block`
- Degraded capability → `block`
- Unknown capability → `block`
- Emulated capability → `block` (all emulation is lossy)
- Partial capability → `block`
- Missing resource → `block`
- Weakened permission → `block`
- Removed permission → `block`
- Any block returns `ok: false` with error diagnostics

### AC3: Safe Mode Semantics

- Emulated capability → `allow` (declared safe emulation is accepted)
- Native capability → `allow`
- Partial capability → `warn` (continue)
- Missing capability → `warn` (continue)
- Degraded capability → `warn` (continue)
- Unknown capability → `warn` (continue)
- Missing resource → `warn` (continue)
- **Weakened permission → `block`**
- **Removed permission → `block`**
- Returns `ok: true` when only capability warnings exist; `ok: false` when security blocks

### AC4: Permissive Mode Semantics

- All capability levels → `allow`
- Missing resources → `warn` (continue)
- Weakened permission → `warn` (continue)
- Removed permission → `warn` (continue)
- All decisions produce explicit diagnostics — no silent permission weakening
- Returns `ok: true` always

### AC5: Diagnostic Explicitness

- Every `permissive` mode decision includes a diagnostic with severity `info` or `warning`
- Weakened/removed permissions in `permissive` mode produce at minimum `info` diagnostics
- No classification goes undiagnosed

### AC6: Full Classification Coverage

Policy tests cover every combination of:

| Dimension        | Values                                                            |
| ---------------- | ----------------------------------------------------------------- |
| Policy mode      | `strict`, `safe`, `permissive`                                    |
| Capability level | `native`, `emulated`, `missing`, `degraded`, `partial`, `unknown` |
| Security outcome | `preserved`, `weakened`, `removed`, `added`                       |
| Resource         | present, missing                                                  |

### AC7: Backward-Compatible Interface

- The `ConversionOptions.policy` field changes type: `'strict' | 'safe' | 'permissive'`
- Code passing `'relaxed'` must receive a clear diagnostic at runtime
- All existing test assertions referencing `'relaxed'` are updated

---

## Design

### Updated `applyPolicy()` Logic

```
applyPolicy(report, securityImpact, policy):
  for each comparison:
    if native/emulated and policy==safe → allow
    if native and policy==strict → allow
    if emulated and policy==strict → block
    if missing/degraded/unknown/partial and policy==strict → block
    if missing/degraded/unknown/partial and policy==safe → warn
    always/never → allow for permissive

  for each missing resource:
    if strict → block, if safe/permissive → warn

  for each weakened/removed permission:
    if strict/safe → block
    if permissive → warn (never silent)
```

### Changes to `pipeline.ts`

1. `PolicyMode` type: `'strict' | 'safe' | 'permissive'`
2. `applyPolicy()` — rewrite with new semantics
3. Default: `options?.policy ?? 'safe'`
4. Runtime check: if caller passes `'relaxed'`, emit error diagnostic (CONV-012) and reject
5. All diagnostics in permissive mode guaranteed via policy decision loop

### Changes to `index.ts`

- No structural changes (types are re-exported dynamically)

### Changes to `pipeline.test.ts`

1. Rename `'relaxed'` → `'safe'` across all existing tests
2. Add comprehensive tests for every combination (see AC6 table):
   - `strict` x 6 capability levels x security outcomes
   - `safe` x 6 capability levels x security outcomes
   - `permissive` x 6 capability levels x security outcomes
   - Edge: unknown level, empty report, no security impact
3. Test default is `'safe'`
4. Test `'relaxed'` is rejected

---

## Risks

- **Backward compatibility**: `'relaxed'` is removed. Any caller using it will break. Mitigated by runtime diagnostic and clear error message. This package has no external consumers yet (pre-alpha).
- **Test surface explosion**: 3 modes × 6 levels × 4 security outcomes = 72 combinations. Mitigated by testing representative combinations rather than every permutation. The AC specifies coverage across all dimensions, not exhaustive cross-product.
