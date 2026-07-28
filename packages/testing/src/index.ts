// Fixture: minimal valid SKILL.md (no frontmatter, no body)
export const minimalSkillMd = `# My Skill

A simple skill description.
`;

// Fixture: full SKILL.md with frontmatter and body sections
export const fullSkillMd = `---
name: test-skill
version: 1.0.0
description: A test skill
capabilities:
  - file-read
  - command-exec
permissions:
  - resource: fs
    actions:
      - read
source:
  format: markdown
invocation:
  instructions: Do the thing
---

## Description

This skill does something useful.

## Usage

Call it with the appropriate inputs.

## Arguments

- \`input1\` (string): The first input
- \`--verbose\` (flag): Enable verbose output
`;

// Fixture: SKILL.md with minimal frontmatter
export const minimalFrontmatterSkillMd = `---
name: minimal-skill
version: 0.1.0
---

Just a basic skill.
`;

// Fixture: SKILL.md with malformed YAML frontmatter
export const badYamlSkillMd = `---
name: broken
version: [unclosed list
---

Body content here.
`;

// Fixture: SKILL.md with non-object frontmatter (array)
export const arrayFrontmatterSkillMd = `---
- item1
- item2
---

Body content here.
`;

// Fixture: valid skillbridge.yaml
export const validSkillbridgeYaml = `name: my-package
version: 1.0.0
description: A sample skill package
author: SkillBridge Team
license: MIT
scripts:
  build: tsc
  test: vitest run
dependencies:
  lodash: ^4.17.21
`;

// Fixture: skillbridge.yaml with unknown fields (must produce warnings)
export const unknownFieldsSkillbridgeYaml = `name: test-pkg
version: 0.1.0
unknown_field: should warn
another_unknown: 42
`;

// Fixture: malformed YAML
export const badYamlSkillbridgeYaml = `name: broken
version: [unclosed list
`;

// Fixture: minimal valid skillbridge.yaml
export const minimalSkillbridgeYaml = `name: minimal-pkg
`;

export const validPackageManifest = {
  name: 'my-package',
  version: '1.0.0',
  description: 'A sample skill package',
  author: 'SkillBridge Team',
  license: 'MIT',
  scripts: { build: 'tsc', test: 'vitest run' },
  dependencies: { lodash: '^4.17.21' },
};

export const emptySkillMd = '';
