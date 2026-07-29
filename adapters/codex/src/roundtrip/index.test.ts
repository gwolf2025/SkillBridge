import { describe, it, expect } from 'vitest';
import { CodexAdapter } from '../index.js';

const adapter = new CodexAdapter();

describe('Codex adapter round-trip', () => {
  it('minimal skill round-trip: identity preserved', () => {
    const input =
      '---\nname: minimal-skill\ndescription: A minimal skill.\n---\n\nJust a basic skill.\n';
    const parsed = adapter.parse(input);
    expect(parsed.name).toBe('minimal-skill');
    expect(parsed.description).toBe('A minimal skill.');
    expect(parsed.body.trim()).toBe('Just a basic skill.');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('name: minimal-skill');
    expect(compiled).toContain('description: A minimal skill.');
    expect(compiled).toContain('Just a basic skill.');
  });

  it('full skill with open-standard fields round-trips correctly', () => {
    const input =
      '---\nname: full-rt\ndescription: Full roundtrip test.\nlicense: MIT\ncompatibility: Requires nothing\nmetadata:\n  author: test\n---\n\nFull body.\n';
    const parsed = adapter.parse(input);
    expect(parsed.name).toBe('full-rt');
    expect(parsed.description).toBe('Full roundtrip test.');
    expect(parsed.extensions?.license).toBe('MIT');
    expect(parsed.extensions?.compatibility).toBe('Requires nothing');

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('license: MIT');
    expect(compiled).toContain('compatibility: Requires nothing');
  });

  it('unknown frontmatter fields survive round-trip', () => {
    const input =
      '---\nname: ext-rt\ndescription: Ext test.\ncustom_field: hello\nanother_field: 42\n---\n\nBody content here.\n';
    const parsed = adapter.parse(input);
    expect(parsed.extensions?.custom_field).toBe('hello');
    expect(parsed.extensions?.another_field).toBe(42);

    const compiled = adapter.compile(parsed);
    expect(compiled).toContain('custom_field: hello');
    expect(compiled).toContain('another_field: 42');
  });

  it('empty frontmatter round-trips without crash', () => {
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

  it('compile then parse preserves extensions', () => {
    const parsed = adapter.parse(
      '---\nname: ext-rt2\ndescription: Ext RT.\ncustom: value\n---\n\nBody.\n',
    );
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.extensions?.custom).toBe('value');
  });

  it('compile then parse preserves allowed-tools', () => {
    const parsed = adapter.parse(
      '---\nname: tool-rt\ndescription: Tool RT.\nallowed-tools: Read Bash\n---\n\nBody.\n',
    );
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.allowedTools).toContain('Read');
    expect(reparsed.allowedTools).toContain('Bash');
  });

  it('open-standard fields round-trip through compile and re-parse', () => {
    const parsed = adapter.parse(
      '---\nname: os-rt\ndescription: Open standard RT.\nlicense: Apache-2.0\ncompatibility: Requires node\nmetadata:\n  version: "2.0"\n---\n\nBody.\n',
    );
    const compiled = adapter.compile(parsed);
    const reparsed = adapter.parse(compiled);
    expect(reparsed.extensions?.license).toBe('Apache-2.0');
    expect(reparsed.extensions?.compatibility).toBe('Requires node');
    expect((reparsed.extensions?.metadata as Record<string, unknown>)?.version).toBe('2.0');
  });
});
