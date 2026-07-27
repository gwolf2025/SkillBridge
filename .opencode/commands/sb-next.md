---
description: Select the next unblocked task from TASKS.md and prepare CURRENT_TASK.md. Does not implement it.
agent: planner
---

You are the SkillBridge Next-Task Selector. Execute the selection process.

## Preconditions

Read LOOP_STATE.md. If the current state is not COMPLETE and not UNPLANNED, stop and report: "Current task is not complete. Current state: <state>. Complete it first with /sb-complete."

## Process

1. Read TASKS.md to find the next uncompleted, unblocked task.
2. Look for items that are not checked (`[ ]`) and not marked as blocked.
3. Read AGENTS.md and ARCHITECTURE.md for context.
4. Read the relevant source directories to understand the state of the code.

## Output

Write to CURRENT_TASK.md with these fields populated:

- **Status**: READY_FOR_BUILD
- **Title**: One-line task title from TASKS.md
- **Description**: 2–4 sentence description
- **Acceptance Criteria**: Specific, testable criteria based on TASKS.md and the repo's conventions
- **Required Tests**: Specify which vitest project(s)
- **Affected Packages**: Based on the task and architecture
- **Architecture Risks**: Based on the task scope
- **Security Risks**: Based on the task scope

If no uncompleted task exists in TASKS.md, set status to NEEDS_HUMAN_DECISION with the message "No remaining tasks in TASKS.md."

Update LOOP_STATE.md:

- Set **Active Task** to the new task title.
- Set **Current State** to READY_FOR_BUILD.
- Set **Last Command** to /sb-next.

Do not implement the task. Stop after preparing CURRENT_TASK.md.
