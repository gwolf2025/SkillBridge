# Loop State

**Current State:** COMPLETE
**Active Task:** None
**Repair Cycle:** 0
**Last Verification:** 2026-07-29T15:10:00Z — pnpm verify all 9 gates pass (620 unit, 151 integration, 29 roundtrip, 71 conversion tests; format:check, lint, depcheck, typecheck, build)
**Last Command:** /sb-complete
**Last Plan:** CURRENT_TASK.md — implement adapter-driven installation planner with scope handling, conflict detection, integrity manifests, and dry-run output

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
