---
name: full-skill
description: A full-featured test skill. Use for comprehensive testing.
when_to_use: |
  - When running tests
  - When debugging the adapter
  - When validating round-trips
allowed-tools: Read Write Edit Bash Grep
disallowed-tools: AskUserQuestion
model: claude-sonnet-4-20250514
effort: high
context: fork
agent: claude-code
background: false
paths:
  - src/**/*.ts
  - tests/**/*.ts
shell: bash
arguments: [input, output]
argument-hint: '<input-file> [output-dir]'
hooks:
  preToolUse: scripts/validate.sh
disabled: false
disable-model-invocation: false
user-invocable: true
---

# Full Skill

## Instructions

Full skill instructions here.

## Examples

Example usage.
