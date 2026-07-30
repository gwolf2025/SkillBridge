import { describe, it, expect } from 'vitest';
import { PortableAdapter } from '@skillbridge/adapter-portable';

const adapter = new PortableAdapter();

describe('Portable adapter round-trip', () => {
  it('minimal SKILL.md round-trip: identity preserved', () => {
    const input = `---
name: minimal-skill
version: 0.1.0
---

Just a basic skill.
`;
    const parsed = adapter.parse(input);
    expect(parsed.diagnostics).toBeUndefined();
    expect(parsed.frontmatter.name).toBe('minimal-skill');
    expect(parsed.frontmatter.version).toBe('0.1.0');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('name: minimal-skill');
    expect(compiled).toContain('version: 0.1.0');
  });

  it('full SKILL.md frontmatter round-trip: all fields preserved', () => {
    const input = `---
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
    const parsed = adapter.parse(input);
    expect(parsed.diagnostics).toBeUndefined();
    expect(parsed.frontmatter.name).toBe('test-skill');
    expect(parsed.frontmatter.version).toBe('1.0.0');
    expect(parsed.frontmatter.description).toBe('A test skill');
    expect(parsed.frontmatter.capabilities).toContain('file-read');
    expect(parsed.frontmatter.capabilities).toContain('command-exec');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('name: test-skill');
    expect(compiled).toContain('version: 1.0.0');
    expect(compiled).toContain('description: A test skill');
    expect(compiled).toContain('file-read');
    expect(compiled).toContain('command-exec');
    expect(compiled).toContain('resource: fs');
    expect(compiled).toContain('## Description');
    expect(compiled).toContain('This skill does something useful.');
    expect(compiled).toContain('## Usage');
    expect(compiled).toContain('Call it with the appropriate inputs.');
  });

  it('unknown frontmatter fields survive round-trip', () => {
    const input = `---
name: ext-rt
version: 1.0.0
custom_field: hello
another_field: 42
---

Body content here.
`;
    const parsed = adapter.parse(input);
    expect(parsed.extensions).toBeDefined();
    expect(parsed.extensions?.custom_field).toBe('hello');
    expect(parsed.extensions?.another_field).toBe(42);

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('custom_field');
    expect(compiled).toContain('hello');
    expect(compiled).toContain('another_field');
    expect(compiled).toContain('42');
  });

  it('capability list survives round-trip', () => {
    const input = `---
name: cap-skill
version: 1.0.0
capabilities:
  - file-read
  - file-write
  - command-exec
---

Skill with capabilities.
`;
    const parsed = adapter.parse(input);
    expect(parsed.frontmatter.capabilities).toHaveLength(3);

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('file-read');
    expect(compiled).toContain('file-write');
    expect(compiled).toContain('command-exec');
  });

  it('no frontmatter content parses and compiles', () => {
    const input = 'Just a plain markdown file.\n\n## Section\n\nContent';
    const parsed = adapter.parse(input);
    expect(parsed.frontmatter).toEqual({});

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('name: unnamed');
    expect(compiled).toContain('version: 0.0.0');
  });
});
