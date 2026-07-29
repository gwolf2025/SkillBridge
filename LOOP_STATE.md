# Loop State

**Current State:** COMPLETE
**Active Task:** shared-deterministic-compiler-infrastructure
**Repair Cycle:** 1 (5 findings fixed)
**Last Verification:** pnpm verify — all green (518 tests)
**Last Command:** /sb-complete — shared deterministic compiler infrastructure
**Last Plan:** CURRENT_TASK.md — shared deterministic compiler infrastructure

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
