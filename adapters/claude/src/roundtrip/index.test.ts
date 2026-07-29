import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../index.js';

const adapter = new ClaudeCodeAdapter();

describe('Claude adapter round-trip', () => {
  it('minimal skill round-trip: identity preserved', () => {
    const input = '---\ndescription: minimal-skill\n---\n\nJust a basic skill.\n';
    const parsed = adapter.parse(input);
    expect(parsed.diagnostics).toBeUndefined();
    expect(parsed.frontmatter.description).toBe('minimal-skill');
    expect(parsed.body.trim()).toBe('Just a basic skill.');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('description: minimal-skill');
    expect(compiled).toContain('Just a basic skill.');
  });

  it('skill with name round-trip: name preserved', () => {
    const input = '---\nname: named-skill\ndescription: A named skill.\n---\n\nNamed body.\n';
    const parsed = adapter.parse(input);
    expect(parsed.name).toBe('named-skill');
    expect(parsed.description).toBe('A named skill.');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('description: A named skill.');
    expect(compiled).toContain('Named body.');
  });

  it('skill with allowed-tools round-trip', () => {
    const input =
      '---\nname: tools-rt\ndescription: Tools test.\nallowed-tools: Read Write Edit Bash\n---\n\nTools body.\n';
    const parsed = adapter.parse(input);
    expect(parsed.allowedTools).toContain('Read');
    expect(parsed.allowedTools).toContain('Bash');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('allowed-tools:');
    expect(compiled).toContain('Tools body.');
  });

  it('skill with context: fork round-trip', () => {
    const input = '---\nname: fork-rt\ndescription: Fork test.\ncontext: fork\n---\n\nFork body.\n';
    const parsed = adapter.parse(input);
    expect(parsed.isForked).toBe(true);

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('context: fork');
  });

  it('unknown frontmatter fields survive round-trip', () => {
    const input =
      '---\nname: ext-rt\ndescription: Ext test.\ncustom_field: hello\nanother_field: 42\n---\n\nBody content here.\n';
    const parsed = adapter.parse(input);
    expect(parsed.extensions).toBeDefined();
    expect(parsed.extensions?.custom_field).toBe('hello');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('custom_field');
    expect(compiled).toContain('hello');
    expect(compiled).toContain('another_field');
    expect(compiled).toContain('42');
  });

  it('empty frontmatter round-trips', () => {
    const input = '---\n---\n\nbody text\n';
    const parsed = adapter.parse(input);
    expect(parsed.frontmatter).toEqual({});
    expect(parsed.body.trim()).toBe('body text');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('---');
    expect(compiled).toContain('body text');
  });

  it('compile then parse preserves identity fields', () => {
    const parsed = adapter.parse(
      '---\nname: roundtrip-compile\ndescription: Round trip.\n---\n\nBody content.\n',
    );
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.name).toBe('roundtrip-compile');
    expect(reparsed.description).toBe('Round trip.');
    expect(reparsed.body.trim()).toBe('Body content.');
  });

  it('compile then parse preserves tools', () => {
    const parsed = adapter.parse(
      '---\nname: tool-rt\ndescription: Tool RT.\nallowed-tools: Read Write Grep\n---\n\nBody.\n',
    );
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.allowedTools).toContain('Read');
    expect(reparsed.allowedTools).toContain('Grep');
  });

  it('compile then parse preserves extensions', () => {
    const parsed = adapter.parse(
      '---\nname: ext-rt2\ndescription: Ext RT.\ncustom: value\n---\n\nBody.\n',
    );
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.extensions?.custom).toBe('value');
  });
});
