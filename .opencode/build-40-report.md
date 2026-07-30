# Build 40 — Release Blocker Remediation

## Files Changed

| File | Change |
|------|--------|
| `packages/conversion/src/conversion/pipeline.test.ts` | Line 12: `vi.mock()` path changed from `'../../../compatibility/src/index.js'` to `'@skillbridge/compatibility'` |
| `SPECIFICATION.md` | Full rewrite: sections 3.1–3.13 updated to describe current implementation instead of claiming stubs |

## Fix 1: 49 Failing Conversion Tests

### Root Cause

`packages/conversion/src/conversion/pipeline.test.ts:12` used:
```typescript
vi.mock('../../../compatibility/src/index.js', () => ({...}));
```

Production code at line 17 imports:
```typescript
import { analyzeCompatibility, assessSecurityImpact } from '@skillbridge/compatibility';
```

Vitest resolves `vi.mock()` paths separately from import specifiers. The relative path `'../../../compatibility/src/index.js'` resolves to the **source file** in `packages/compatibility/src/index.js`, while the package specifier `'@skillbridge/compatibility'` resolves (via `node_modules/@skillbridge/compatibility/package.json` shim) to `packages/compatibility/dist/index.js`. These are **different files**, so Vitest treated them as unrelated modules. The mock was applied to the source file, but the import reads the dist file — hence `vi.mocked(analyzeCompatibility)` returned a non-mock object that lacked `.mockReset()`.

### Fix

Changed line 12 to:
```typescript
vi.mock('@skillbridge/compatibility', () => ({
  analyzeCompatibility: vi.fn(),
  assessSecurityImpact: vi.fn(),
}));
```

Now the mock targets the same module specifier as the production import. Vitest correctly correlates them, and `vi.mocked()` returns the actual mock object with `.mockReset()` available.

### Result

- Before: 55/104 passed (49 failed)
- After: **104/104 passed**

## Fix 2: SPECIFICATION.md Rewrite

### Sections Rewritten

| Section | Before | After |
|---------|--------|-------|
| 3.1 core | "Partially implemented" — marked `DiagnosticCollector` and `ValidationError` as may-need | "Implemented" — added all actual exports including `DiagnosticCollector`, `ValidationError`, `hasReservedWindowsFilename`, `stripBom`, `isCaseInsensitivePathEqual` |
| 3.2 schema | "Stub (JSDoc only)" | "Implemented" with full API table (9 exports) |
| 3.3 ir | "Partially implemented" — only 5 types listed, 7 items in "Required" list | "Implemented" — 32 exports documented with descriptions |
| 3.4 parser | "Stub (JSDoc only)" | "Implemented" — 7 exports with 12 error codes |
| 3.5 compatibility | "Stub (JSDoc only)" | "Implemented" — 8 exports with compatibility levels and error codes |
| 3.6 compiler | "Stub (JSDoc only)" | "Implemented" — 10 exports with error codes |
| 3.7 conversion | "Stub (JSDoc only)" | "Implemented" — 8 exports with pipeline overview and error codes |
| 3.8 runtime | "Stub (JSDoc only)" | "Placeholder (JSDoc only)" — honest about no implementation |
| 3.9 adapter-sdk | "Partially implemented" — 3 exports listed | "Implemented" — 7 exports documented with adapter requirements |
| 3.10 registry-local | "Stub (JSDoc only)" | "Implemented" — 2 exports documented |
| 3.11 testing | "Stub (JSDoc only)" | "Implemented" — 10 exports including example skills and 115 packaging tests |
| 3.12 apps/cli | "Stub (prints 'pre-alpha' only)" | "Implemented" — 13 commands with flag tables and error codes |
| 3.13 adapters | "All four are stubs" | "Implemented" — per-adapter capability table with line counts |

### Other Changes

- **Section 2.1**: Added `Normalize` step (was missing from pipeline table)
- **Section 4**: Updated to reflect actual `Adapter` interface (normalize is optional, compile uses adapter-specific types)
- **Section 5.2**: Added diagnostic code namespace table with per-package ranges
- **Section 6.3**: Added current test counts (891 unit, 156 integration, 29 roundtrip, 104 conversion)
- **Section 7.4**: Added dependency documentation for `fs`, `installer`, `skill-test`, `runtime`

### Contradictions Discovered

1. Spec claimed `supportedSourceFormats`/`supportedTargetFormats` — actual API uses `supports.sourceFormats`/`supports.targetFormats` (change happened during SDK refactoring)
2. Spec described pipeline without a `Normalize` step — actual pipeline has `sourceAdapter.normalize()` between parse and analyze
3. Spec listed 5 adapter capabilities — actual `AdapterCapability` type has 8 (`detect`, `parse`, `normalize`, `compile`, `install`, `uninstall`, `verify`, `invoke`)

## Verification Results

| Gate | Result |
|------|--------|
| `pnpm format:check` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm test:conversion` | ✅ 104/104 |
| `pnpm test:unit` | ✅ 891/891 |
| `pnpm test:integration` | ✅ 156/156 |
| `pnpm test:roundtrip` | ✅ 29/29 |
| `pnpm build` | ✅ 19/19 |
| **pnpm verify equivalent** | **ALL PASS** |

## Remaining Release Blockers

**None.** Both confirmed blockers have been remediated:
1. Conversion tests pass → verify gate is green ✅
2. SPECIFICATION.md accurately reflects implementation ✅
