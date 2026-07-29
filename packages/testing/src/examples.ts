// Example SkillBridge skills for demonstration and testing purposes only.
// Not intended for production use.

export const HELLO_WORLD_SKILL = `---
name: hello-world
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. A minimal skill that responds with a greeting.
capabilities:
  - file-read
permissions:
  - resource: fs
    actions:
      - read
---

# Hello World

Respond with a friendly greeting.
`;

export const FILE_ORGANIZER_SKILL = `---
name: file-organizer
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Organizes files into folders by type.
capabilities:
  - file-read
  - file-write
  - list-directory
permissions:
  - resource: fs
    actions:
      - read
      - write
      - list
---

# File Organizer

Organize files in a directory by their extension.
`;

export const SECRET_ROTATOR_SKILL = `---
name: secret-rotator
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Rotates secrets stored in environment variables.
capabilities:
  - secrets
  - env-read
permissions:
  - resource: secret:*
    actions:
      - read
      - write
  - resource: env:*
    actions:
      - read
---

# Secret Rotator

Rotate secrets by generating new values.
`;

export const CODE_ANALYZER_SKILL = `---
name: code-analyzer
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Analyzes source code for complexity and style issues.
capabilities:
  - file-read
  - command-exec
  - search-files
permissions:
  - resource: fs
    actions:
      - read
      - search
  - resource: bash:*
    actions:
      - execute
---

# Code Analyzer

Run static analysis on source code files.
`;

export const VENDOR_HOOKS_SKILL = `---
name: vendor-hooks
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Uses vendor-specific hook extensions that are unsupported by the standard pipeline.
capabilities:
  - hooks
  - subagent
hooks:
  preToolUse: scripts/validate.sh
  postToolUse: scripts/report.sh
extensions:
  vendor:
    customField: This is a vendor-specific extension that produces diagnostics
---

# Vendor Hooks

This skill demonstrates intentionally incompatible behavior.
`;
