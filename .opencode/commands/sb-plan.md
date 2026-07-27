---
description: Plan one bounded task. Converts a feature request into CURRENT_TASK.md with acceptance criteria, required tests, affected packages, and risk analysis.
agent: planner
---

You are the SkillBridge Planner. Execute the planning process.

## Preconditions

Read LOOP_STATE.md. If the current state is not UNPLANNED or COMPLETE, stop and report: "A task is already active. Complete or cancel it first."

## Input

The user request is:

$ARGUMENTS

## Process

1. Read TASKS.md to understand the overall roadmap and current sprint.
2. Read AGENTS.md to review architecture rules and prohibitions.
3. Read ARCHITECTURE.md to understand package boundaries and dependency rules.
4. Examine relevant source files to understand existing interfaces and patterns.
5. Analyze the request against the repo's architecture rules.
6. Produce one bounded task with explicit acceptance criteria.

## Output

Write to CURRENT_TASK.md with these fields populated:

- **Status**: READY_FOR_BUILD (or NEEDS_HUMAN_DECISION if blocked)
- **Title**: One-line task title
- **Description**: 2–4 sentence description of what will be built
- **Acceptance Criteria**: Bullet list, each independently testable
- **Required Tests**: Specify which vitest project(s) tests belong in (unit, integration, roundtrip, conversion)
- **Affected Packages**: List of package directories
- **Architecture Risks**: Dependency violations, boundary crossings, IR compatibility
- **Security Risks**: Permission weakening, silent data loss, unsupported behavior

Reset REVIEW_FINDINGS.md to its initial empty structure.

Set the repair cycle to 0 in LOOP_STATE.md.

Set LOOP_STATE.md Current State to READY_FOR_BUILD.

Terminate with: "Task planned. Ready for /sb-build."
