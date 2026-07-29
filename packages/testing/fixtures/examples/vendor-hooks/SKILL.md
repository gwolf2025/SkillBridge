---
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

This skill demonstrates intentionally incompatible behavior by using
vendor-specific frontmatter fields (`hooks`, `extensions.vendor`) that
are not part of the core SkillBridge package specification.

When parsed, these fields will be preserved in extensions but may produce
diagnostics indicating unsupported or vendor-specific behavior.
