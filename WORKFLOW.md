# Development Workflow

SkillBridge uses a bounded loop-engineering workflow managed through OpenCode commands.

## Prerequisites

- Node.js 20+ and pnpm installed.
- `pnpm install` to install dependencies.
- OpenCode CLI configured (agents and commands auto-discovered from `.opencode/`).

## The Loop

```
PLAN → BUILD → REVIEW → (REPAIR → REVIEW)* → VERIFY → COMPLETE → STOP
```

Build and repair each run `pnpm verify` internally before finishing. The standalone `/sb-verify` is used only at the end before completion to confirm all gates still pass.

## States

| State                | Meaning                                       |
| -------------------- | --------------------------------------------- |
| UNPLANNED            | No task loaded.                               |
| READY_FOR_BUILD      | Task planned. Ready for implementation.       |
| READY_FOR_REVIEW     | Build complete. Ready for independent review. |
| REPAIR_REQUIRED      | Review found issues.                          |
| VERIFIED             | Verification passed. Ready to complete.       |
| VERIFICATION_FAILED  | Verification checks did not pass.             |
| COMPLETE             | Task finished.                                |
| BLOCKED              | Cannot proceed. Human intervention required.  |
| NEEDS_HUMAN_DECISION | Human decision needed before continuing.      |
| VERIFICATION_FAILED  | Verification checks did not pass.             |
| SCOPE_EXHAUSTED      | Task scope fully addressed.                   |

## Commands

### `/sb-plan <task description>`

Convert a feature request into one bounded task with acceptance criteria, required tests, affected packages, and risk analysis.

**Input:** Free-text task description.
**Output:** `CURRENT_TASK.md` populated. State becomes `READY_FOR_BUILD` or `NEEDS_HUMAN_DECISION`.

### `/sb-build`

Implement the current task from `CURRENT_TASK.md`. Adds tests, runs focused checks during implementation, and runs `pnpm verify` before stopping.

**Precondition:** `CURRENT_TASK.md` status is `READY_FOR_BUILD`.
**Output:** State becomes `READY_FOR_REVIEW`, `VERIFICATION_FAILED`, or `BLOCKED`.

### `/sb-review`

Independently inspect every change against every acceptance criterion. Records findings in `REVIEW_FINDINGS.md` ordered by severity.

**Precondition:** `LOOP_STATE.md` state is `READY_FOR_REVIEW`.
**Output:** State becomes `REPAIR_REQUIRED`, `NEEDS_HUMAN_DECISION`, or stays `READY_FOR_REVIEW` (closed by `/sb-complete`).

### `/sb-repair`

Fix confirmed review findings. Adds regression tests and runs verification.

**Precondition:** State is `REPAIR_REQUIRED` or `VERIFICATION_FAILED`. Repair cycle < 3.
**Output:** State becomes `READY_FOR_REVIEW`, `VERIFICATION_FAILED`, or `BLOCKED`.

### `/sb-verify`

Run the full verification suite (`pnpm format:check` → `lint` → `typecheck` → `test:unit` → `test:integration` → `test:roundtrip` → `test:conversion` → `build`) and record exact results. Does not modify implementation.

**Output:** State becomes `VERIFIED` or `VERIFICATION_FAILED`.

### `/sb-status`

Summarize current task, acceptance criteria, changed files, verification, review findings, and the next permitted action. Read-only.

### `/sb-complete`

Close the current task. Requires an approved review and passing verification. Updates `TASKS.md` and appends to `COMPLETED_TASKS.md`.

**Precondition:** Most recent review is APPROVED, most recent verification is PASS.
**Output:** State becomes `COMPLETE`. State files reset for next task.

### `/sb-next`

Select the next unblocked item from `TASKS.md` and prepare `CURRENT_TASK.md`. Does not implement it.

**Precondition:** State is `COMPLETE` or `UNPLANNED`.
**Output:** State becomes `READY_FOR_BUILD`.

## Example Session

```
/sb-plan Implement the initial SkillBridge IR types
  → Planner writes CURRENT_TASK.md
  → State: READY_FOR_BUILD

/sb-build
  → Builder implements IR types, adds tests, runs pnpm verify
  → State: READY_FOR_REVIEW

/sb-review
  → Reviewer inspects diff, checks acceptance criteria, writes findings
  → State: REPAIR_REQUIRED (if issues found)

/sb-repair
  → Debugger fixes findings, adds regression tests, runs verify
  → State: READY_FOR_REVIEW

/sb-review
  → Re-review confirms all criteria met
  → State: READY_FOR_REVIEW (approved)

/sb-verify
  → Runs full verification suite
  → State: VERIFIED

/sb-complete
  → Updates TASKS.md, COMPLETED_TASKS.md, resets state files
  → State: COMPLETE
```

## Rules

- Only one task may be active at a time.
- Every task must have explicit acceptance criteria.
- A builder cannot grant final approval to its own work.
- A reviewer cannot edit the implementation it is reviewing.
- A debugger may only repair confirmed findings.
- No test may be weakened merely to make it pass.
- No failing test may be deleted unless the task explicitly makes it obsolete.
- No compatibility requirement may be silently removed.
- No security or permission requirement may be weakened without an explicit human decision.
- The repair loop stops after three unsuccessful repair cycles. After that, the task is BLOCKED.
- The system must never move to a new task without explicit invocation of `/sb-next`.
- Git commits and pushes remain human actions.
- Agents must not invoke themselves recursively.
- Commands must not create an uncontrolled endless loop.

## State Files

| File                 | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `CURRENT_TASK.md`    | Active task definition with acceptance criteria |
| `LOOP_STATE.md`      | Loop state, repair count, last verification     |
| `REVIEW_FINDINGS.md` | Review findings ordered by severity             |
| `COMPLETED_TASKS.md` | Log of completed tasks                          |

## Verification Order

```
pnpm format:check → pnpm lint → pnpm typecheck → pnpm test:unit → pnpm test:integration → pnpm test:roundtrip → pnpm test:conversion → pnpm build
```
