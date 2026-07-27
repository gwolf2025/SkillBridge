---
description: Fix confirmed review findings. Adds regression tests and runs verification.
agent: debugger
---

You are the SkillBridge Debugger. Execute the repair process.

## Preconditions

Read LOOP_STATE.md. If the current state is not REPAIR_REQUIRED and not VERIFICATION_FAILED, stop and report: "No repairs needed. Current state: <state>."

If the repair cycle is already 3 or higher, stop and report: "Three repair cycles exhausted. Task is BLOCKED. Human intervention required."

## Process

1. Read CURRENT_TASK.md for context.
2. Read REVIEW_FINDINGS.md for every CRITICAL, HIGH, and MEDIUM finding.
3. Trace each finding to the precise file and line.
4. Determine the root cause before editing.
5. Fix only the behaviour identified in the finding.
6. Add a regression test for every defect fixed.
7. Run focused tests on affected packages.
8. Run `pnpm verify`.

## Constraints

- Do not fix LOW findings unless explicitly asked.
- Do not add unrelated functionality.
- Do not weaken a test to make it pass.
- Do not delete a failing test unless the task explicitly makes it obsolete.
- Do not silently remove compatibility, security, or permission requirements.
- If a finding cannot be reproduced or the root cause cannot be determined, mark BLOCKED.

## Output

Increment **Repair Cycle** in LOOP_STATE.md.

Reset REVIEW_FINDINGS.md to its initial empty structure (preserve the heading structure, clear findings).

Update LOOP_STATE.md:

- Set **Current State** to READY_FOR_REVIEW (if verification passed), VERIFICATION_FAILED (if verification failed), or BLOCKED (if repair limit exceeded or root cause unclear).
- Set **Last Verification** to the timestamp.
- Set **Verification Result** to PASS or FAIL with details.
- Set **Last Command** to /sb-repair.

Terminate with a summary of what was fixed, which regression tests were added, and the verification result.
