---
description: Full test agent
mode: subagent
model: gpt-4
instruction: .opencode/instructions/build.md
rule: .opencode/rules/typescript.md
permission:
  edit: allow
  bash:
    'pnpm *': allow
    'git *': deny
    '*': ask
---

Full system prompt body here.
