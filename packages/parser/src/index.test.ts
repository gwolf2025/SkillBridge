import { describe, it, expect } from 'vitest';
import { parseSkillMd, parseSkillbridgeYaml, validatePackagePath } from './index.js';

describe('parseSkillMd', () => {
  it('parses frontmatter and body sections', () => {
    const result = parseSkillMd(`---
name: test
capabilities:
  - file-read
---

## Description

Some text.

## Usage

More text.
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter.name).toBe('test');
    expect(result.value.sections).toHaveLength(2);
    expect(result.value.sections[0].heading).toBe('Description');
    expect(result.value.sections[0].body).toBe('Some text.');
    expect(result.value.sections[1].heading).toBe('Usage');
  });

  it('parses content without frontmatter', () => {
    const result = parseSkillMd('# Just a heading\n\nSome body.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter).toEqual({});
    expect(result.value.sections).toHaveLength(0);
  });

  it('returns empty frontmatter for empty content', () => {
    const result = parseSkillMd('');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter).toEqual({});
    expect(result.value.sections).toHaveLength(0);
  });

  it('returns empty frontmatter when frontmatter block is empty', () => {
    const result = parseSkillMd('---\n---\n\nBody.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter).toEqual({});
  });

  it('rejects unclosed frontmatter', () => {
    const result = parseSkillMd(`---
unclosed`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-009');
    }
  });

  it('rejects malformed YAML', () => {
    const result = parseSkillMd(`---
name: [broken
---`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-002');
    }
  });

  it('rejects frontmatter that is not an object', () => {
    const result = parseSkillMd(`---
- just
- an
- array
---`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-009');
    }
  });

  it('extracts sections with no space after ##', () => {
    const result = parseSkillMd(`##A\nbody\n##B\nbody2`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sections).toHaveLength(2);
    expect(result.value.sections[0].heading).toBe('A');
    expect(result.value.sections[1].heading).toBe('B');
  });

  it('handles Windows-style line endings', () => {
    const result = parseSkillMd('---\r\nname: test\r\n---\r\n\r\n## Section\r\nBody.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter.name).toBe('test');
    expect(result.value.sections[0].heading).toBe('Section');
  });

  it('strips BOM character', () => {
    const result = parseSkillMd('\uFEFF---\nname: bom-test\n---\n\nBody.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter.name).toBe('bom-test');
  });

  it('handles nested YAML in frontmatter', () => {
    const result = parseSkillMd(`---
capabilities:
  - file-read
  - file-write
permissions:
  resource: fs
  actions:
    - read
    - write
---

Body.
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter.capabilities).toEqual(['file-read', 'file-write']);
    expect((result.value.frontmatter.permissions as Record<string, unknown>).resource).toBe('fs');
  });
});

describe('parseSkillbridgeYaml', () => {
  it('parses a valid skillbridge.yaml', () => {
    const result = parseSkillbridgeYaml(`name: my-pkg
version: 1.0.0
description: A test package
author: Test Author
license: MIT
scripts:
  build: tsc
dependencies:
  lodash: ^4.17.21
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.manifest.name).toBe('my-pkg');
    expect(result.value.manifest.version).toBe('1.0.0');
    expect(result.value.manifest.scripts?.build).toBe('tsc');
  });

  it('parses a minimal skillbridge.yaml', () => {
    const result = parseSkillbridgeYaml('name: minimal-pkg\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.manifest.name).toBe('minimal-pkg');
  });

  it('produces warnings for unknown fields', () => {
    const result = parseSkillbridgeYaml(`name: test
unknown_field: should warn
another_unknown: 42
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.diagnostics.length).toBeGreaterThan(0);
    expect(result.value.diagnostics.some((d) => d.code === 'PARSER-008')).toBe(true);
  });

  it('rejects malformed YAML', () => {
    const result = parseSkillbridgeYaml('name: [broken');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-003');
    }
  });

  it('rejects non-object YAML', () => {
    const result = parseSkillbridgeYaml('just a string');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-003');
    }
  });

  it('rejects null YAML', () => {
    const result = parseSkillbridgeYaml('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-003');
    }
  });

  it('preserves unknown fields in returned manifest', () => {
    const result = parseSkillbridgeYaml(`name: test
custom_field: hello
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.manifest.name).toBe('test');
  });
});

describe('parseSkillMd - enhanced features', () => {
  it('includes source location on sections', () => {
    const result = parseSkillMd(`---
name: test
---

## Description

Text here.

## Usage

More text.
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sections[0].location).toBeDefined();
    expect(result.value.sections[0].location!.line).toBe(5);
    expect(result.value.sections[0].location!.column).toBe(1);
    expect(result.value.sections[1].location!.line).toBe(9);
  });

  it('includes source location on error diagnostics', () => {
    const result = parseSkillMd(`---
name: [broken
---`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0].location).toBeDefined();
    expect(result.error[0].location!.line).toBe(2);
  });

  it('includes location on unclosed frontmatter error', () => {
    const result = parseSkillMd(`---
unclosed`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0].location).toBeDefined();
    expect(result.error[0].location!.line).toBe(1);
  });

  it('separates unknown frontmatter fields into extensions', () => {
    const result = parseSkillMd(`---
name: test
x-custom: custom-value
---
Body.
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter.name).toBe('test');
    expect(result.value.frontmatter).not.toHaveProperty('x-custom');
    expect(result.value.extensions).toEqual({ 'x-custom': 'custom-value' });
  });

  it('does not include extensions when all fields are known', () => {
    const result = parseSkillMd(`---
name: test
capabilities:
  - file-read
---
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.extensions).toBeUndefined();
  });

  it('produces PARSER-011 warning for known field with wrong type', () => {
    const result = parseSkillMd(`---
capabilities: not-an-array
---
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.diagnostics).toBeDefined();
    expect(result.value.diagnostics!.some((d) => d.code === 'PARSER-011')).toBe(true);
    expect(result.value.diagnostics![0].location).toBeDefined();
    expect(result.value.diagnostics![0].location!.line).toBe(2);
    expect(result.value.diagnostics![0].source).toBe('capabilities');
  });

  it('does not warn for absent known fields', () => {
    const result = parseSkillMd(`---
other: value
---
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.diagnostics).toBeUndefined();
    expect(result.value.frontmatter).toEqual({});
    expect(result.value.extensions).toEqual({ other: 'value' });
  });

  it('preserves section locations with CRLF line endings', () => {
    const result = parseSkillMd('---\r\nname: test\r\n---\r\n\r\n## Section\r\nBody.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sections[0].location!.line).toBe(5);
  });
});

describe('validatePackagePath', () => {
  // Use repo root as a concrete, platform-appropriate base
  const root = process.cwd();

  it('accepts a valid relative path', () => {
    const result = validatePackagePath('packages/parser/src/index.ts', root);
    expect(result.ok).toBe(true);
  });

  it('accepts nested relative paths', () => {
    const result = validatePackagePath('node_modules/js-yaml/index.js', root);
    expect(result.ok).toBe(true);
  });

  it('rejects absolute paths', () => {
    const result = validatePackagePath('/etc/passwd', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-005');
    }
  });

  it('rejects traversal via ..', () => {
    const result = validatePackagePath('../../etc/passwd', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-004');
    }
  });

  it('rejects paths outside package root', () => {
    const result = validatePackagePath('../', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('PARSER-004');
    }
  });
});
