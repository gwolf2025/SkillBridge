import { describe, it, expect } from 'vitest';
import { OpenCodeAdapter } from '@skillbridge/adapter-opencode';

const adapter = new OpenCodeAdapter();

describe('OpenCode adapter round-trip', () => {
  it('minimal agent round-trip: identity preserved', () => {
    const input = `---
description: minimal-agent
---

Just a basic agent.
`;
    const parsed = adapter.parse(input);
    expect(parsed.diagnostics).toBeUndefined();
    expect(parsed.frontmatter.description).toBe('minimal-agent');
    expect(parsed.body.trim()).toBe('Just a basic agent.');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('description: minimal-agent');
    expect(compiled).toContain('Just a basic agent.');
  });

  it('full agent frontmatter round-trip: all fields preserved', () => {
    const input = `---
description: full-agent
mode: subagent
model: gpt-4
permission:
  edit: true
  bash:
    'pnpm *': allow
    'git *': deny
---

Full round-trip body.
`;
    const parsed = adapter.parse(input);
    expect(parsed.diagnostics).toBeUndefined();
    expect(parsed.frontmatter.description).toBe('full-agent');
    expect(parsed.frontmatter.mode).toBe('subagent');
    expect(parsed.frontmatter.model).toBe('gpt-4');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('description: full-agent');
    expect(compiled).toContain('mode: subagent');
    expect(compiled).toContain('model: gpt-4');
    expect(compiled).toContain('Full round-trip body.');
  });

  it('command round-trip: agent reference preserved', () => {
    const input = `---
description: test-command
agent: builder
---

Run this command.
`;
    const parsed = adapter.parse(input);
    expect(parsed.kind).toBe('command');
    expect(parsed.frontmatter.agent).toBe('builder');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('agent: builder');
    expect(compiled).toContain('description: test-command');
    expect(compiled).toContain('Run this command.');
  });

  it('unknown frontmatter fields survive round-trip', () => {
    const input = `---
description: ext-rt
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

  it('empty frontmatter round-trips', () => {
    const input = `---
---

body text
`;
    const parsed = adapter.parse(input);
    expect(parsed.frontmatter).toEqual({});
    expect(parsed.body.trim()).toBe('body text');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('---');
    expect(compiled).toContain('body text');
  });

  it('compile then parse preserves identity fields', () => {
    const parsed = adapter.parse(`---
description: roundtrip-compile
---

Body content.
`);
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.frontmatter.description).toBe('roundtrip-compile');
    expect(reparsed.body.trim()).toBe('Body content.');
  });
});
