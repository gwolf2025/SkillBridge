import { describe, it, expect } from 'vitest';
import { PortableAdapter } from './index.js';
import type { SkillMdResult } from '../../../packages/parser/src/index.js';
import { describeAdapterContract } from '../../../packages/testing/src/index.js';

const adapter = new PortableAdapter();

describe('adapter-portable', () => {
  describe('manifest', () => {
    it('has correct name and vendor', () => {
      expect(adapter.manifest.name).toBe('adapter-portable');
      expect(adapter.manifest.vendor).toBe('skillbridge');
    });

    it('declares markdown source and target formats', () => {
      expect(adapter.manifest.supports.sourceFormats).toContain('markdown');
      expect(adapter.manifest.supports.targetFormats).toContain('markdown');
    });

    it('declares detect, parse, normalize, compile capabilities', () => {
      expect(adapter.manifest.capabilities).toContain('detect');
      expect(adapter.manifest.capabilities).toContain('parse');
      expect(adapter.manifest.capabilities).toContain('normalize');
      expect(adapter.manifest.capabilities).toContain('compile');
    });

    it('has adapterVersion set', () => {
      expect(adapter.manifest.adapterVersion).toBeDefined();
    });
  });

  describe('detect', () => {
    it('returns true for content with frontmatter', () => {
      const content = `---\nname: test\nversion: 1.0.0\n---\n\nBody`;
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns false for content without frontmatter', () => {
      const content = 'Just a plain text file.';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(adapter.detect('')).toBe(false);
    });

    it('returns false for non-string input (null cast)', () => {
      expect(adapter.detect(null as unknown as string)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses content with minimal frontmatter', () => {
      const content = `---\nname: test\nversion: 1.0.0\n---\n\nBody text`;
      const result = adapter.parse(content);
      expect(result.frontmatter.name).toBe('test');
      expect(result.frontmatter.version).toBe('1.0.0');
      expect(result.sections).toHaveLength(0);
    });

    it('parses content with full frontmatter and body sections', () => {
      const content = `---
name: full-skill
version: 2.0.0
description: A full skill
capabilities:
  - file-read
  - command-exec
permissions:
  - resource: fs
    actions:
      - read
inputs:
  - name: input1
    type: string
    description: The first input
outputs:
  - name: output1
    type: string
---

## Description

This is a full skill.

## Usage

Call it like this.

## Arguments

- \`arg1\` (string): First argument
`;
      const result = adapter.parse(content);
      expect(result.frontmatter.name).toBe('full-skill');
      expect(result.frontmatter.version).toBe('2.0.0');
      expect(result.frontmatter.description).toBe('A full skill');
      expect(Array.isArray(result.frontmatter.capabilities)).toBe(true);
      expect(result.frontmatter.capabilities).toContain('file-read');
      expect(result.frontmatter.capabilities).toContain('command-exec');
      expect(Array.isArray(result.frontmatter.permissions)).toBe(true);
      expect(result.frontmatter.inputs).toHaveLength(1);
      expect(result.frontmatter.outputs).toHaveLength(1);
      expect(result.sections).toHaveLength(3);
    });

    it('parses content with unknown frontmatter fields into extensions', () => {
      const content = `---
name: ext-skill
version: 1.0.0
custom_field: hello
another_field: 42
---

Body
`;
      const result = adapter.parse(content);
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.custom_field).toBe('hello');
      expect(result.extensions?.another_field).toBe(42);
    });

    it('malformed YAML returns error diagnostics', () => {
      const content = `---
name: broken
version: [unclosed list
---

Body
`;
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      if (result.diagnostics) {
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0].severity).toBe('error');
      }
    });

    it('content without frontmatter parses with empty frontmatter', () => {
      const content = 'Just body text\n\n## Section\n\nContent';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.sections.length).toBeGreaterThan(0);
    });
  });

  describe('normalize', () => {
    it('maps basic frontmatter to NormalizedSkill identity', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'my-skill', version: '1.0.0', description: 'A skill' },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('my-skill');
      expect(result.identity.version).toBe('1.0.0');
      expect(result.identity.description).toBe('A skill');
      expect(result.irVersion).toBe('0.1.0');
    });

    it('maps capabilities from frontmatter', () => {
      const parsed: SkillMdResult = {
        frontmatter: {
          name: 'cap-skill',
          version: '1.0.0',
          capabilities: ['file-read', 'command-exec'],
        },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-read');
      expect(result.capabilities).toContain('command-exec');
    });

    it('maps permissions from frontmatter', () => {
      const parsed: SkillMdResult = {
        frontmatter: {
          name: 'perm-skill',
          version: '1.0.0',
          permissions: [{ resource: 'fs', actions: ['read', 'write'] }],
        },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].resource).toBe('fs');
      expect(result.permissions[0].actions).toContain('read');
    });

    it('maps inputs and outputs from frontmatter', () => {
      const parsed: SkillMdResult = {
        frontmatter: {
          name: 'io-skill',
          version: '1.0.0',
          inputs: [{ name: 'x', type: 'number', description: 'X value', required: true }],
          outputs: [{ name: 'y', type: 'number' }],
        },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.inputs).toHaveLength(1);
      expect(result.inputs?.[0].name).toBe('x');
      expect(result.inputs?.[0].required).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs?.[0].name).toBe('y');
    });

    it('extracts invocation from Description and Usage sections', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'inv-skill', version: '1.0.0' },
        sections: [
          { heading: 'Description', body: 'Does something.' },
          { heading: 'Usage', body: 'Call it with args.' },
        ],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.invocation?.instructions).toContain('Does something.');
      expect(result.invocation?.instructions).toContain('Call it with args.');
    });

    it('preserves extensions in normalized output', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'ext-skill', version: '1.0.0' },
        sections: [],
        extensions: { custom_field: 'hello', another_field: 42 },
      };
      const result = adapter.normalize('source', parsed);
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.custom_field).toBe('hello');
      expect(result.extensions?.another_field).toBe(42);
    });

    it('uses defaults for missing fields', () => {
      const parsed: SkillMdResult = {
        frontmatter: {},
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('unnamed');
      expect(result.identity.version).toBe('0.0.0');
      expect(result.capabilities).toEqual([]);
      expect(result.permissions).toEqual([]);
    });

    it('sets source format to markdown', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 's', version: '1.0.0' },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.source.format).toBe('markdown');
    });

    it('preserves unknown capabilities in _unknownCapabilities extensions', () => {
      const parsed: SkillMdResult = {
        frontmatter: {
          name: 'unk-cap',
          version: '1.0.0',
          capabilities: ['file-read', 'claude:vendor-cap', 'opencode:custom'],
        },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-read');
      expect(result.capabilities).not.toContain('claude:vendor-cap');
      expect(result.extensions?._unknownCapabilities).toBeDefined();
      const unknownCaps = result.extensions?._unknownCapabilities as string[];
      expect(unknownCaps).toContain('claude:vendor-cap');
      expect(unknownCaps).toContain('opencode:custom');
    });

    it('empty unknown capabilities are not added when all caps are known', () => {
      const parsed: SkillMdResult = {
        frontmatter: {
          name: 'known-cap',
          version: '1.0.0',
          capabilities: ['file-read', 'command-exec'],
        },
        sections: [],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.extensions?._unknownCapabilities).toBeUndefined();
    });
  });

  describe('compile', () => {
    it('compiles minimal SkillMdResult to valid SKILL.md', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'test', version: '1.0.0' },
        sections: [],
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('---');
      expect(output).toContain('name: test');
      expect(output).toContain('version: 1.0.0');
    });

    it('compiles full SkillMdResult preserving capabilities and permissions', () => {
      const parsed: SkillMdResult = {
        frontmatter: {
          name: 'full',
          version: '2.0.0',
          capabilities: ['file-read', 'command-exec'],
          permissions: [{ resource: 'fs', actions: ['read'] }],
        },
        sections: [],
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('file-read');
      expect(output).toContain('command-exec');
      expect(output).toContain('resource: fs');
    });

    it('compiles body sections from parsed sections', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'body-skill', version: '1.0.0' },
        sections: [
          { heading: 'Description', body: 'Does something useful.' },
          { heading: 'Usage', body: 'Call it.' },
        ],
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('## Description');
      expect(output).toContain('Does something useful.');
      expect(output).toContain('## Usage');
      expect(output).toContain('Call it.');
    });

    it('preserves extensions in compiled output', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'ext-skill', version: '1.0.0' },
        sections: [],
        extensions: { custom_field: 'hello' },
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('custom_field');
      expect(output).toContain('hello');
    });

    it('produces deterministic output', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'det-skill', version: '1.0.0', capabilities: ['file-read'] },
        sections: [{ heading: 'Description', body: 'Same content.' }],
      };
      const a = adapter.compile(parsed);
      const b = adapter.compile(parsed);
      expect(a).toBe(b);
    });

    it('writes back unknown capabilities from _unknownCapabilities extensions', () => {
      const parsed: SkillMdResult = {
        frontmatter: { name: 'unk-skill', version: '1.0.0' },
        sections: [],
        extensions: { _unknownCapabilities: ['claude:vendor-cap'] },
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('claude:vendor-cap');
    });
  });

  describe('round-trip', () => {
    it('compile(normalize(parse(content))) preserves identity fields', () => {
      const original = `---
name: roundtrip-skill
version: 3.0.0
description: Round trip test
capabilities:
  - file-read
permissions:
  - resource: fs
    actions:
      - read
---

## Description

A round-trip skill.

## Usage

Use it wisely.
`;
      const parsed = adapter.parse(original);
      expect(parsed.diagnostics).toBeUndefined();

      const compiled = adapter.compile(parsed);

      expect(compiled).toContain('name: roundtrip-skill');
      expect(compiled).toContain('version: 3.0.0');
      expect(compiled).toContain('Round trip test');
      expect(compiled).toContain('file-read');
      expect(compiled).toContain('resource: fs');
      expect(compiled).toContain('## Description');
      expect(compiled).toContain('A round-trip skill.');
      expect(compiled).toContain('## Usage');
      expect(compiled).toContain('Use it wisely.');
    });

    it('unknown fields survive round-trip', () => {
      const original = `---
name: ext-rt
version: 1.0.0
custom_field: survives
---

Body
`;
      const parsed = adapter.parse(original);
      expect(parsed.extensions?.custom_field).toBe('survives');

      const compiled = adapter.compile(parsed);
      expect(compiled).toContain('custom_field');
      expect(compiled).toContain('survives');
    });

    it('minimal content round-trips', () => {
      const original = `---
name: minimal
version: 1.0.0
---

Just a basic skill.
`;
      const parsed = adapter.parse(original);
      const compiled = adapter.compile(parsed);
      expect(compiled).toContain('name: minimal');
      expect(compiled).toContain('version: 1.0.0');
    });

    it('empty string detect returns false', () => {
      expect(adapter.detect('')).toBe(false);
    });

    it('null source detect returns false', () => {
      expect(adapter.detect(null as unknown as string)).toBe(false);
    });
  });
});

describe('adapter contract', () => {
  const contractSource = `---
name: contract-test-skill
version: 1.0.0
description: Contract test skill
capabilities:
  - file-read
permissions:
  - resource: fs
    actions:
      - read
---

## Description

A skill for contract testing.

## Usage

Use it wisely.
`;

  const contractNormalized: SkillMdResult = {
    frontmatter: {
      name: 'contract-test-skill',
      version: '1.0.0',
      description: 'Contract test skill',
    },
    sections: [
      { heading: 'Description', body: 'A skill for contract testing.' },
      { heading: 'Usage', body: 'Use it wisely.' },
    ],
  };

  describeAdapterContract(adapter, {
    source: contractSource,
    normalized: contractNormalized,
    detectRejectInput: '',
  });
});
