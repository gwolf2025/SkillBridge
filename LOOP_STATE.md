# Loop State

**Current State:** READY_FOR_BUILD
**Active Task:** conversion/normalize — implement source-document-to-IR normalization pipeline with provenance, deterministic merge, body-section mapping, conflict detection, and extension preservation
**Repair Cycle:** 0
**Last Verification:** pnpm verify
**Verification Result:** PASS — format:check, lint (0 warnings), depcheck (0 violations), typecheck, test:unit (138/138), test:integration (72/72), test:roundtrip (1/1), test:conversion (1/1), build (17 pkgs) all green
**Last Command:** /sb-complete

---

## Terminal States

| State                | Meaning                                      |
| -------------------- | -------------------------------------------- |
| UNPLANNED            | No task loaded. Run `/sb-plan <task>`.       |
| READY_FOR_BUILD      | Task planned. Run `/sb-build`.               |
| READY_FOR_REVIEW     | Build complete. Run `/sb-review`.            |
| REPAIR_REQUIRED      | Review found issues. Run `/sb-repair`.       |
| VERIFIED             | Verification passed. Ready to complete.      |
| VERIFICATION_FAILED  | Verification checks did not pass.            |
| COMPLETE             | Task finished. Run `/sb-next` or `/sb-plan`. |
| BLOCKED              | Cannot proceed. Needs human intervention.    |
| NEEDS_HUMAN_DECISION | Requires a human to make a decision.         |
| SCOPE_EXHAUSTED      | Task scope fully addressed. Ready to close.  |

---

_Managed by the loop-engineering workflow. Do not edit manually unless you understand the implications for the active agent session._
