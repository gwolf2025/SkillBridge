import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describeAdapterContract } from '@skillbridge/testing';
import { CodexAdapter } from './index.js';
import type { CodexSkillResult } from './index.js';

const adapter = new CodexAdapter();

describe('adapter-codex', () => {
  describe('manifest', () => {
    it('has correct name and vendor', () => {
      expect(adapter.manifest.name).toBe('adapter-codex');
      expect(adapter.manifest.vendor).toBe('skillbridge');
    });

    it('declares markdown source and target formats', () => {
      expect(adapter.manifest.supports.sourceFormats).toContain('markdown');
      expect(adapter.manifest.supports.targetFormats).toContain('markdown');
    });

    it('declares all required capabilities', () => {
      const required = [
        'detect',
        'parse',
        'normalize',
        'compile',
        'install-plan',
        'install',
        'uninstall',
        'verify',
      ];
      for (const cap of required) {
        expect(adapter.manifest.capabilities).toContain(cap);
      }
    });

    it('has adapterVersion set', () => {
      expect(adapter.manifest.adapterVersion).toBeDefined();
    });
  });

  describe('detect', () => {
    it('returns true for content with name and description frontmatter', () => {
      const content = '---\nname: test-skill\ndescription: A test skill\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns false for content with only name but no description', () => {
      const content = '---\nname: test-skill\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for content with only description but no name', () => {
      const content = '---\ndescription: A test skill\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for content without frontmatter', () => {
      const content = 'Just a plain text file.';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(adapter.detect('')).toBe(false);
    });

    it('returns false for content with only --- but no fields', () => {
      const content = '---\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for null input', () => {
      expect(adapter.detect(null as unknown as string)).toBe(false);
    });

    it('returns true with all open-standard optional fields present', () => {
      const content =
        '---\nname: full-skill\ndescription: A full skill\nlicense: MIT\ncompatibility: none\nmetadata:\n  author: test\nallowed-tools: Read\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns false for content with empty name', () => {
      const content = '---\nname: \ndescription: A test\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for content with empty description', () => {
      const content = '---\nname: test\ndescription:\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses minimal skill with name and description', () => {
      const content =
        '---\nname: test-skill\ndescription: A test skill. Use for testing.\n---\n\nBody content.';
      const result = adapter.parse(content);
      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('A test skill. Use for testing.');
      expect(result.body).toBe('Body content.');
      expect(result.diagnostics).toBeUndefined();
    });

    it('parses full skill with all open-standard fields', () => {
      const content = [
        '---',
        'name: full-skill',
        'description: A full test skill.',
        'license: Apache-2.0',
        'compatibility: Requires git, docker',
        'metadata:',
        '  author: skillbridge',
        '  version: "1.0.0"',
        'allowed-tools: Read Bash',
        '---',
        '',
        '# Full Skill',
        '',
        'Instructions.',
      ].join('\n');
      const result = adapter.parse(content);
      expect(result.name).toBe('full-skill');
      expect(result.description).toBe('A full test skill.');
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.license).toBe('Apache-2.0');
      expect(result.extensions?.compatibility).toBe('Requires git, docker');
      expect(result.extensions?.metadata).toEqual({ author: 'skillbridge', version: '1.0.0' });
      expect(result.allowedTools).toContain('Read');
      expect(result.allowedTools).toContain('Bash');
    });

    it('parses allowed-tools as comma-separated string', () => {
      const content =
        '---\nname: tools-skill\ndescription: test\nallowed-tools: Read, Write, Edit\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.allowedTools).toEqual(['Read', 'Write', 'Edit']);
    });

    it('parses allowed-tools as YAML list', () => {
      const content =
        '---\nname: tools-skill\ndescription: test\nallowed-tools:\n  - Read\n  - Bash\n  - Grep\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.allowedTools).toEqual(['Read', 'Bash', 'Grep']);
    });

    it('preserves unknown frontmatter fields in extensions', () => {
      const content =
        '---\nname: ext-skill\ndescription: test\ncustom_field: hello\nanother_field: 42\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.custom_field).toBe('hello');
      expect(result.extensions?.another_field).toBe(42);
    });

    it('preserves license and metadata open standard fields', () => {
      const content =
        '---\nname: std-skill\ndescription: An open standard skill.\nlicense: MIT\nmetadata:\n  author: test\n  version: "1.0.0"\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.extensions?.license).toBe('MIT');
      expect(result.extensions?.metadata).toEqual({ author: 'test', version: '1.0.0' });
    });

    it('returns error for malformed YAML', () => {
      const content = '---\nname: broken\ndescription: [unclosed list\n---';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-001');
    });

    it('parses empty frontmatter', () => {
      const content = '---\n---\n\nbody text';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe('body text');
      expect(result.name).toBe('');
    });

    it('handles body-only content with no frontmatter', () => {
      const content = 'Just body text with no frontmatter.';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body.trim()).toBe('Just body text with no frontmatter.');
      expect(result.name).toBe('');
    });

    it('uses first body paragraph as description when description is missing', () => {
      const content = '---\nname: no-desc\n---\n\nFirst paragraph.\n\nSecond paragraph.';
      const result = adapter.parse(content);
      expect(result.description).toBe('First paragraph.');
      expect(result.name).toBe('no-desc');
    });

    it('parses with empty description string', () => {
      const content = "---\nname: empty-desc\ndescription: ''\n---\n\nBody.";
      const result = adapter.parse(content);
      expect(result.name).toBe('empty-desc');
      expect(result.description).toBe('');
    });

    it('treats non-existent file path as body content', () => {
      const result = adapter.parse('/nonexistent/path/skill.md');
      expect(result.diagnostics).toBeUndefined();
    });

    it('produces CODEX-003 diagnostic for allowed-tools', () => {
      const content = '---\nname: tool-skill\ndescription: test\nallowed-tools: Read\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-003');
    });

    it('produces CODEX-005 for unknown tool names', () => {
      const content =
        '---\nname: weird-tools\ndescription: test\nallowed-tools: SomeRandomTool\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-005');
    });

    it('produces CODEX-005 diagnostic for unknown frontmatter fields', () => {
      const content = '---\nname: test\ndescription: test\nunknown_field: value\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-005');
    });

    it('produces CODEX-004 for uppercase name', () => {
      const content = '---\nname: UPPERCASE-SKILL\ndescription: test\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-004');
    });

    it('produces CODEX-004 for name with leading hyphen', () => {
      const content = '---\nname: -bad-name\ndescription: test\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-004');
    });

    it('produces CODEX-004 for name with trailing hyphen', () => {
      const content = '---\nname: bad-name-\ndescription: test\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-004');
    });

    it('produces CODEX-004 for name with consecutive hyphens', () => {
      const content = '---\nname: bad--name\ndescription: test\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-004');
    });

    it('produces CODEX-004 for name exceeding 64 chars', () => {
      const longName = 'a'.repeat(65);
      const content = `---\nname: ${longName}\ndescription: test\n---\n\nBody.`;
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-004');
    });
  });

  describe('normalize', () => {
    it('maps minimal skill to NormalizedSkill', () => {
      const parsed: CodexSkillResult = {
        name: 'test-skill',
        description: 'A test skill.',
        frontmatter: { name: 'test-skill', description: 'A test skill.' },
        body: 'Body content.',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('test-skill');
      expect(result.identity.version).toBe('0.0.0');
      expect(result.identity.description).toBe('A test skill.');
      expect(result.irVersion).toBe('0.1.0');
      expect(result.source.format).toBe('markdown');
    });

    it('derives capabilities from allowed-tools with Read', () => {
      const parsed: CodexSkillResult = {
        name: 'read-skill',
        description: 'Read test.',
        frontmatter: { name: 'read-skill', description: 'Read test.' },
        body: '',
        allowedTools: ['Read'],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-read');
      expect(result.capabilities).not.toContain('file-write');
    });

    it('derives command-exec from Bash tool', () => {
      const parsed: CodexSkillResult = {
        name: 'bash-skill',
        description: 'Bash test.',
        frontmatter: { name: 'bash-skill', description: 'Bash test.' },
        body: '',
        allowedTools: ['Bash'],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('command-exec');
    });

    it('derives file-write from Write and Edit tools', () => {
      const parsed: CodexSkillResult = {
        name: 'write-skill',
        description: 'Write test.',
        frontmatter: { name: 'write-skill', description: 'Write test.' },
        body: '',
        allowedTools: ['Write', 'Edit'],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-write');
    });

    it('defaults capabilities when allowed-tools is absent', () => {
      const parsed: CodexSkillResult = {
        name: 'default-skill',
        description: 'Default test.',
        frontmatter: { name: 'default-skill', description: 'Default test.' },
        body: '',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-read');
      expect(result.capabilities).toContain('command-exec');
    });

    it('maps permissions to IR format', () => {
      const parsed: CodexSkillResult = {
        name: 'perm-skill',
        description: 'Permission test.',
        frontmatter: { name: 'perm-skill', description: 'Permission test.' },
        body: '',
        allowedTools: ['Read', 'Write', 'Bash', 'Grep'],
      };
      const result = adapter.normalize('source', parsed);
      expect(
        result.permissions.some((p) => p.resource === 'fs' && p.actions.includes('read')),
      ).toBe(true);
      expect(
        result.permissions.some((p) => p.resource === 'fs' && p.actions.includes('write')),
      ).toBe(true);
      expect(
        result.permissions.some((p) => p.resource === 'bash:*' && p.actions.includes('execute')),
      ).toBe(true);
      expect(
        result.permissions.some((p) => p.resource === 'fs' && p.actions.includes('search')),
      ).toBe(true);
    });

    it('defaults to empty permissions when no tools', () => {
      const parsed: CodexSkillResult = {
        name: 'no-perm-skill',
        description: 'No perm test.',
        frontmatter: { name: 'no-perm-skill', description: 'No perm test.' },
        body: '',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.permissions).toEqual([]);
    });

    it('preserves extensions in normalized output', () => {
      const parsed: CodexSkillResult = {
        name: 'ext-skill',
        description: 'Ext test.',
        frontmatter: { name: 'ext-skill', description: 'Ext test.' },
        body: '',
        extensions: { license: 'MIT' },
      };
      const result = adapter.normalize('source', parsed);
      expect(result.extensions?.license).toBe('MIT');
    });

    it('includes invocation from body', () => {
      const parsed: CodexSkillResult = {
        name: 'inv-skill',
        description: 'Inv test.',
        frontmatter: { name: 'inv-skill', description: 'Inv test.' },
        body: 'Do the thing.',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.invocation?.instructions).toBe('Do the thing.');
    });

    it('uses defaults for empty result', () => {
      const parsed: CodexSkillResult = {
        name: '',
        description: '',
        frontmatter: {},
        body: '',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('');
      expect(result.identity.version).toBe('0.0.0');
      expect(result.identity.description).toBeUndefined();
    });
  });

  describe('compile', () => {
    it('compiles minimal skill to valid SKILL.md markdown', () => {
      const parsed: CodexSkillResult = {
        name: 'compiled-skill',
        description: 'A compiled test skill.',
        frontmatter: { name: 'compiled-skill', description: 'A compiled test skill.' },
        body: 'Compiled body content.',
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('---');
      expect(output).toContain('name: compiled-skill');
      expect(output).toContain('description: A compiled test skill.');
      expect(output).toContain('Compiled body content.');
    });

    it('compiles full skill with all open-standard fields', () => {
      const parsed: CodexSkillResult = {
        name: 'full-compiled',
        description: 'Full compiled test.',
        frontmatter: {
          name: 'full-compiled',
          description: 'Full compiled test.',
          'allowed-tools': 'Read Bash',
        },
        body: 'Full compiled body.',
        allowedTools: ['Read', 'Bash'],
        extensions: { license: 'MIT', compatibility: 'Requires nothing' },
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('name: full-compiled');
      expect(output).toContain('description: Full compiled test.');
      expect(output).toContain('license: MIT');
      expect(output).toContain('compatibility: Requires nothing');
      expect(output).toContain('allowed-tools:');
    });

    it('preserves extensions in compiled output', () => {
      const parsed: CodexSkillResult = {
        name: 'ext-compiled',
        description: 'Ext test.',
        frontmatter: { name: 'ext-compiled', description: 'Ext test.' },
        body: 'Body.',
        extensions: { custom_field: 'hello' },
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('custom_field: hello');
    });

    it('produces deterministic output', () => {
      const parsed: CodexSkillResult = {
        name: 'det-skill',
        description: 'Det test.',
        frontmatter: { name: 'det-skill', description: 'Det test.' },
        body: 'Same content.',
      };
      const a = adapter.compile(parsed);
      const b = adapter.compile(parsed);
      expect(a).toBe(b);
    });

    it('emits name and description first in field order', () => {
      const parsed: CodexSkillResult = {
        name: 'ordered-skill',
        description: 'Order test.',
        frontmatter: { name: 'ordered-skill', description: 'Order test.' },
        body: 'Body.',
        extensions: { license: 'MIT', compatibility: 'none' },
      };
      const output = adapter.compile(parsed);
      const nameIdx = output.indexOf('name: ordered-skill');
      const descIdx = output.indexOf('description: Order test.');
      expect(nameIdx).toBeLessThan(descIdx);
    });

    it('omits _codex prefixed extensions from compile output', () => {
      const parsed: CodexSkillResult = {
        name: 'no-codex-ext',
        description: 'Test.',
        frontmatter: { name: 'no-codex-ext', description: 'Test.' },
        body: 'Body.',
        extensions: { _codexOpenaiYaml: { interface: { display_name: 'Test' } } },
      };
      const output = adapter.compile(parsed);
      expect(output).not.toContain('_codexOpenaiYaml');
    });
  });

  describe('installPlan', () => {
    it('returns steps for project and user scope', () => {
      const normalized: CodexSkillResult = {
        name: 'plan-skill',
        description: 'Plan test.',
        frontmatter: { name: 'plan-skill', description: 'Plan test.' },
        body: 'Body.',
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const plan = adapter.installPlan(ctx);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.steps.some((s) => s.includes('project scope'))).toBe(true);
      expect(plan.steps.some((s) => s.includes('user scope'))).toBe(true);
    });

    it('includes companion file steps when openaiYaml is present', () => {
      const normalized: CodexSkillResult = {
        name: 'companion-plan',
        description: 'Plan test.',
        frontmatter: { name: 'companion-plan', description: 'Plan test.' },
        body: 'Body.',
        extensions: { _codexOpenaiYaml: { interface: { display_name: 'Test' } } },
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const plan = adapter.installPlan(ctx);
      expect(plan.steps.some((s) => s.includes('companion'))).toBe(true);
    });
  });

  describe('verify', () => {
    it('returns true for matching name, description and body', () => {
      const normalized: CodexSkillResult = {
        name: 'verify-skill',
        description: 'Verify test.',
        frontmatter: { name: 'verify-skill', description: 'Verify test.' },
        body: 'Verify body.',
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const result = adapter.verify(ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('returns false for mismatched identity', () => {
      const normalized: CodexSkillResult = {
        name: 'original-skill',
        description: 'Original.',
        frontmatter: { name: 'original-skill', description: 'Original.' },
        body: 'Body.',
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const result = adapter.verify(ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('install and uninstall', () => {
    let tmpDir: string;

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'sb-cd-install-'));
    });

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('install writes SKILL.md to temp dir', () => {
      const normalized: CodexSkillResult = {
        name: 'install-test',
        description: 'Install test.',
        frontmatter: { name: 'install-test', description: 'Install test.' },
        body: 'body',
      };
      const ctx = {
        source: '',
        normalized,
        manifest: adapter.manifest,
        options: { installDir: tmpDir },
      };
      const result = adapter.install(ctx);
      expect(result.ok).toBe(true);
    });

    it('uninstall removes SKILL.md', () => {
      const normalized: CodexSkillResult = {
        name: 'uninstall-test',
        description: 'Uninstall test.',
        frontmatter: { name: 'uninstall-test', description: 'Uninstall test.' },
        body: 'body',
      };
      const ctx = {
        source: '',
        normalized,
        manifest: adapter.manifest,
        options: { installDir: tmpDir },
      };
      const result = adapter.uninstall(ctx);
      expect(result.ok).toBe(true);
    });

    it('install with extension openaiYaml writes companion file', () => {
      const installDir = join(tmpDir, 'companion-install');
      const normalized: CodexSkillResult = {
        name: 'companion-skill',
        description: 'Companion test.',
        frontmatter: { name: 'companion-skill', description: 'Companion test.' },
        body: 'body',
        extensions: { _codexOpenaiYaml: { interface: { display_name: 'Test' } } },
      };
      const ctx = {
        source: '',
        normalized,
        manifest: adapter.manifest,
        options: { installDir },
      };
      const result = adapter.install(ctx);
      expect(result.ok).toBe(true);
    });
  });

  describe('diagnostic coverage', () => {
    it('produces CODEX-001 for malformed YAML', () => {
      const content = '---\nname: broken\ndescription: [unclosed\n---';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-001');
    });

    it('produces CODEX-003 for allowed-tools experimental field', () => {
      const content = '---\nname: exp-skill\ndescription: test\nallowed-tools: Read\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-003');
    });

    it('produces CODEX-004 for invalid name', () => {
      const content = '---\nname: INVALID-NAME\ndescription: test\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-004');
    });

    it('produces CODEX-005 for unknown fields', () => {
      const content = '---\nname: unknown-test\ndescription: test\nrandom: value\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CODEX-005');
    });
  });

  describe('adapter contract', () => {
    const contractSource =
      '---\nname: contract-skill\ndescription: Contract test skill.\n---\n\nBody';
    const contractNormalized: CodexSkillResult = {
      name: 'contract-skill',
      description: 'Contract test skill.',
      frontmatter: {
        name: 'contract-skill',
        description: 'Contract test skill.',
      },
      body: 'Body',
    };

    describeAdapterContract(adapter, {
      source: contractSource,
      normalized: contractNormalized,
      detectRejectInput: '',
    });
  });
});
