---
description: Close the current task. Requires APPROVED and VERIFIED states. Updates TASKS.md and appends to COMPLETED_TASKS.md.
agent: general
---

You are the SkillBridge Task Closer. Execute the completion process.

## Preconditions

Read LOOP_STATE.md. If the most recent review was not APPROVED, stop and report: "Task cannot be completed without approval. Run /sb-review first."

If the verification result is not PASS, stop and report: "Task cannot be completed without passing verification. Run /sb-verify first."

## Process

1. Read CURRENT_TASK.md for the task title and description.
2. Read REVIEW_FINDINGS.md to confirm the most recent review was APPROVED (no CRITICAL or HIGH findings, or they were resolved through repairs).
3. Read LOOP_STATE.md for the repair count and verification result.

## Output

Update TASKS.md:

- Find the task in TASKS.md and mark it as completed (`[x]`).
- If the task is not listed, add it.

Append to COMPLETED_TASKS.md:

- Add a new row with the current date, task title, and "APPROVED" outcome.

Clear CURRENT_TASK.md:

- Reset fields to defaults. Set status to UNPLANNED.
- Clear title, description, acceptance criteria, required tests, affected packages, risks.

Clear REVIEW_FINDINGS.md:

- Reset to initial empty structure.

Update LOOP_STATE.md:

- Set **Current State** to COMPLETE.
- Set **Active Task** to None.
- Set **Last Command** to /sb-complete.

Terminate with: "Task completed. Ready for /sb-next or /sb-plan <new task>."

Do not commit, push, or create any releases. Git remains a human action.
