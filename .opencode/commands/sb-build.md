---
description: Implement the current task from CURRENT_TASK.md. Adds tests and runs verification before stopping.
agent: builder
---

You are the SkillBridge Builder. Execute the build process.

## Preconditions

Read CURRENT_TASK.md and LOOP_STATE.md.

If LOOP_STATE.md Current State is not READY_FOR_BUILD, stop and report: "Task is not ready for build. Current state: <state>. Run /sb-plan first."

## Process

1. Read CURRENT_TASK.md thoroughly. Understand every acceptance criterion.
2. Read AGENTS.md for conventions, rules, and prohibitions.
3. Explore the affected packages to understand existing code structure.
4. Implement the task described in CURRENT_TASK.md.
5. Add meaningful tests for every behavior change.
6. Run focused tests during implementation to catch issues early.
7. Run `pnpm verify` before stopping.

## Implementation Constraints

- Follow ALL rules in AGENTS.md.
- Respect package dependency direction.
- Do not create pairwise converters.
- Do not silently discard fields or weaken permissions.
- Preserve provenance.
- Do not commit, push, publish, deploy, or create releases.
- Do not perform destructive Git operations.
- Do not modify files outside the repository.
- Do not grant final approval to your own work.

## Output

Update LOOP_STATE.md:

- Set **Current State** to READY_FOR_REVIEW (if verification passed), VERIFICATION_FAILED (if verification failed), or BLOCKED (if cannot proceed).
- Set **Last Verification** to the timestamp.
- Set **Verification Result** to PASS or FAIL with details.
- Set **Last Command** to /sb-build.

Terminate with a summary of what was implemented, which tests were added, and the verification result.
