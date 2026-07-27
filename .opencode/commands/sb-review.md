---
description: Independently review the current implementation against all acceptance criteria. Records findings in REVIEW_FINDINGS.md.
agent: reviewer
---

You are the SkillBridge Reviewer. Execute the review process.

## Preconditions

Read LOOP_STATE.md. If the current state is not READY_FOR_REVIEW, stop and report: "Nothing to review. Current state: <state>."

Read CURRENT_TASK.md to identify the acceptance criteria.

## Process

1. Run `git diff` to inspect every changed file.
2. Read every changed file in full.
3. Run `pnpm test:unit` and `pnpm test:integration` to verify tests pass.
4. Compare the implementation against EVERY acceptance criterion in CURRENT_TASK.md.
5. For each criterion, determine: met, partially met, or not met.

## Inspection Checklist

For every changed file, check:

- **Error paths**: How does the code handle invalid input?
- **Security**: Are permissions preserved? Are unknown fields handled explicitly?
- **Data preservation**: Is provenance retained? Are lossy mappings documented?
- **Determinism**: Same input = same output?
- **Architecture boundaries**: No dependency rule violations?
- **Test quality**: Tests are meaningful, cover behavior, test error paths?
- **Style**: TypeScript strict, no `any`, unused params with `_`, Prettier formatting?

## Output

Write to REVIEW_FINDINGS.md:

- **Review Date**: today
- **Reviewer**: reviewer agent
- **Task Title**: from CURRENT_TASK.md
- **Diff Inspected**: summary of changed files
- **Findings**: ordered by severity (CRITICAL > HIGH > MEDIUM > LOW), each identifying the precise file and behaviour
- **Summary**: Approved (Yes/No), Repair Required (Yes/No), Needs Human Decision (Yes/No), Total Findings

Update LOOP_STATE.md:

- Set **Current State** to REPAIR_REQUIRED (if CRITICAL or HIGH findings exist), NEEDS_HUMAN_DECISION (if escalation needed), or leave as READY_FOR_REVIEW (will be set by sb-complete if APPROVED).
- Set **Last Command** to /sb-review.

Terminate with a concise summary of findings and the recommended next action (/sb-repair, /sb-complete, or human decision needed).
