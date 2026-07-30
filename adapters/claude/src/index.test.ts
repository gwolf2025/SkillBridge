import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describeAdapterContract } from '@skillbridge/testing';
import { ClaudeCodeAdapter } from './index.js';
import type { ClaudeSkillResult } from './index.js';

const adapter = new ClaudeCodeAdapter();

describe('adapter-claude', () => {
  describe('manifest', () => {
    it('has correct name and vendor', () => {
      expect(adapter.manifest.name).toBe('adapter-claude');
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
    it('returns true for content with description frontmatter', () => {
      const content = '---\ndescription: test skill\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns true for content with name frontmatter', () => {
      const content = '---\nname: test-skill\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns true for content with both name and description', () => {
      const content = '---\nname: test-skill\ndescription: test\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns false for content without frontmatter', () => {
      const content = 'Just a plain text file.';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(adapter.detect('')).toBe(false);
    });

    it('returns false for content with only --- but no Claude fields', () => {
      const content = '---\nunknown: value\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for null input', () => {
      expect(adapter.detect(null as unknown as string)).toBe(false);
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

    it('parses full skill with all Claude Code fields', () => {
      const content = [
        '---',
        'name: full-skill',
        'description: A full skill. Use for testing.',
        'when_to_use: When testing the adapter',
        'allowed-tools: Read Write Edit Bash Grep',
        'disallowed-tools: AskUserQuestion',
        'model: claude-sonnet-4-20250514',
        'effort: high',
        'context: fork',
        'agent: claude-code',
        'background: false',
        'shell: bash',
        'arguments: [input, output]',
        'argument-hint: "<input-file> [output-dir]"',
        'paths:',
        '  - src/**/*.ts',
        'disabled: false',
        'disable-model-invocation: false',
        'user-invocable: true',
        'hooks:',
        '  preToolUse: scripts/validate.sh',
        '---',
        '',
        'Full body.',
      ].join('\n');
      const result = adapter.parse(content);
      expect(result.name).toBe('full-skill');
      expect(result.description).toBe('A full skill. Use for testing.');
      expect(result.allowedTools).toContain('Read');
      expect(result.allowedTools).toContain('Bash');
      expect(result.disallowedTools).toContain('AskUserQuestion');
      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.effort).toBe('high');
      expect(result.isForked).toBe(true);
      expect(result.isManualOnly).toBe(false);
      expect(result.isUserInvokable).toBe(true);
      expect(result.shell).toBe('bash');
      expect(result.arguments).toContain('input');
      expect(result.argumentsHint).toBe('<input-file> [output-dir]');
      expect(result.paths).toContain('src/**/*.ts');
      expect(result.hooks).toBeDefined();
      expect(result.frontmatter.when_to_use).toBeDefined();
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

    it('parses context: fork sets isForked to true', () => {
      const content = '---\nname: fork-skill\ndescription: test\ncontext: fork\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.isForked).toBe(true);
    });

    it('parses disable-model-invocation: true sets isManualOnly', () => {
      const content =
        '---\nname: manual-skill\ndescription: test\ndisable-model-invocation: true\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.isManualOnly).toBe(true);
    });

    it('parses user-invocable: false', () => {
      const content =
        '---\nname: hidden-skill\ndescription: test\nuser-invocable: false\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.isUserInvokable).toBe(false);
    });

    it('parses non-standard boolean values with diagnostic', () => {
      const content =
        '---\nname: nonbool-skill\ndescription: test\ndisabled: yes\ndisable-model-invocation: on\nuser-invocable: "no"\nbackground: 1\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.frontmatter.disabled).toBe(true);
      expect(result.frontmatter['disable-model-invocation']).toBe(true);
      expect(result.frontmatter['user-invocable']).toBe(false);
      expect(result.frontmatter.background).toBe(true);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes.filter((c) => c === 'CLAUDE-004').length).toBeGreaterThanOrEqual(3);
    });

    it('parses effort: max as valid', () => {
      const content = '---\nname: effort-skill\ndescription: test\neffort: max\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.effort).toBe('max');
    });

    it('produces warning for invalid effort level', () => {
      const content = '---\nname: bad-effort\ndescription: test\neffort: extreme\n---';
      const result = adapter.parse(content);
      expect(result.effort).toBe('extreme');
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CLAUDE-003');
    });

    it('returns error for malformed YAML', () => {
      const content = '---\nname: broken\ndescription: [unclosed list\n---';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      if (result.diagnostics) {
        expect(result.diagnostics.some((d) => d.code === 'CLAUDE-001')).toBe(true);
      }
    });

    it('parses empty frontmatter', () => {
      const content = '---\n---\n\nbody text';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe('body text');
      expect(result.name).toBe('unnamed');
    });

    it('preserves unknown fields in extensions', () => {
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
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.license).toBe('MIT');
      expect(result.extensions?.metadata).toEqual({ author: 'test', version: '1.0.0' });
    });

    it('handles body-only content with no frontmatter', () => {
      const content = 'Just body text with no frontmatter.';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body.trim()).toBe('Just body text with no frontmatter.');
      expect(result.name).toBe('unnamed');
    });

    it('uses first body paragraph as description when description is missing', () => {
      const content = '---\nname: no-desc\n---\n\nFirst paragraph.\n\nSecond paragraph.';
      const result = adapter.parse(content);
      expect(result.description).toBe('First paragraph.');
      expect(result.name).toBe('no-desc');
    });

    it('treats non-existent file path as body content', () => {
      const result = adapter.parse('/nonexistent/path/skill.md');
      expect(result.diagnostics).toBeUndefined();
      expect(result.body).toContain('nonexistent');
    });

    it('detects unknown tool names with diagnostic', () => {
      const content =
        '---\nname: unknown-tools\ndescription: test\nallowed-tools: Read UnknownTool\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.allowedTools).toContain('UnknownTool');
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CLAUDE-005');
    });
  });

  describe('normalize', () => {
    it('maps minimal skill to NormalizedSkill', () => {
      const parsed: ClaudeSkillResult = {
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

    it('derives capabilities from allowed-tools with Write', () => {
      const parsed: ClaudeSkillResult = {
        name: 'write-skill',
        description: 'Write test.',
        frontmatter: { name: 'write-skill', description: 'Write test.' },
        body: '',
        allowedTools: ['Read', 'Write', 'Edit'],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-write');
      expect(result.capabilities).not.toContain('command-exec');
    });

    it('derives command-exec from Bash tool', () => {
      const parsed: ClaudeSkillResult = {
        name: 'bash-skill',
        description: 'Bash test.',
        frontmatter: { name: 'bash-skill', description: 'Bash test.' },
        body: '',
        allowedTools: ['Bash'],
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('command-exec');
    });

    it('derives both capabilities when allowed-tools is absent', () => {
      const parsed: ClaudeSkillResult = {
        name: 'all-skill',
        description: 'All tools.',
        frontmatter: { name: 'all-skill', description: 'All tools.' },
        body: '',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-write');
      expect(result.capabilities).toContain('command-exec');
    });

    it('maps permissions to IR format', () => {
      const parsed: ClaudeSkillResult = {
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

    it('preserves extensions in normalized output', () => {
      const parsed: ClaudeSkillResult = {
        name: 'ext-skill',
        description: 'Ext test.',
        frontmatter: { name: 'ext-skill', description: 'Ext test.' },
        body: '',
        extensions: { custom_field: 'hello' },
      };
      const result = adapter.normalize('source', parsed);
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.custom_field).toBe('hello');
    });

    it('includes invocation from body', () => {
      const parsed: ClaudeSkillResult = {
        name: 'inv-skill',
        description: 'Inv test.',
        frontmatter: { name: 'inv-skill', description: 'Inv test.' },
        body: 'Do the thing.',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.invocation?.instructions).toBe('Do the thing.');
    });

    it('uses defaults for missing fields', () => {
      const parsed: ClaudeSkillResult = {
        name: 'unnamed',
        description: '',
        frontmatter: {},
        body: '',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('unnamed');
      expect(result.identity.version).toBe('0.0.0');
      expect(result.identity.description).toBeUndefined();
      expect(result.capabilities).toEqual(['file-write', 'command-exec']);
      expect(result.permissions).toEqual([]);
    });
  });

  describe('compile', () => {
    it('compiles minimal skill to valid SKILL.md markdown', () => {
      const parsed: ClaudeSkillResult = {
        name: 'compiled-skill',
        description: 'A compiled test skill.',
        frontmatter: { name: 'compiled-skill', description: 'A compiled test skill.' },
        body: 'Compiled body content.',
        allowedTools: [],
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('---');
      expect(output).toContain('description: A compiled test skill.');
      expect(output).toContain('Compiled body content.');
    });

    it('compiles full skill with tools and effort', () => {
      const parsed: ClaudeSkillResult = {
        name: 'full-compiled',
        description: 'Full compiled test.',
        frontmatter: {
          name: 'full-compiled',
          description: 'Full compiled test.',
          'allowed-tools': 'Read Write Edit Bash',
        },
        body: 'Full compiled body.',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
        effort: 'high',
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('allowed-tools: Read Write Edit Bash');
      expect(output).toContain('description: Full compiled test.');
    });

    it('compiles with context: fork', () => {
      const parsed: ClaudeSkillResult = {
        name: 'fork-compiled',
        description: 'Fork test.',
        frontmatter: { name: 'fork-compiled', description: 'Fork test.' },
        body: 'Body.',
        isForked: true,
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('context: fork');
    });

    it('preserves extensions in compiled output', () => {
      const parsed: ClaudeSkillResult = {
        name: 'ext-compiled',
        description: 'Ext test.',
        frontmatter: { name: 'ext-compiled', description: 'Ext test.' },
        body: 'Body.',
        extensions: { custom_field: 'hello' },
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('custom_field');
      expect(output).toContain('hello');
    });

    it('produces deterministic output', () => {
      const parsed: ClaudeSkillResult = {
        name: 'det-skill',
        description: 'Det test.',
        frontmatter: { name: 'det-skill', description: 'Det test.' },
        body: 'Same content.',
      };
      const a = adapter.compile(parsed);
      const b = adapter.compile(parsed);
      expect(a).toBe(b);
    });

    it('omits name field when name is "unnamed"', () => {
      const parsed: ClaudeSkillResult = {
        name: 'unnamed',
        description: 'A skill.',
        frontmatter: { description: 'A skill.' },
        body: 'Body.',
      };
      const output = adapter.compile(parsed);
      expect(output).not.toContain('name:');
    });
  });

  describe('installPlan', () => {
    it('returns steps for project and user scope', () => {
      const normalized: ClaudeSkillResult = {
        name: 'plan-skill',
        description: 'Plan test.',
        frontmatter: { name: 'plan-skill', description: 'Plan test.' },
        body: 'Body.',
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const plan = adapter.installPlan(ctx);
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);
      expect(plan.steps.some((s) => s.includes('project scope'))).toBe(true);
      expect(plan.steps.some((s) => s.includes('user scope'))).toBe(true);
    });
  });

  describe('verify', () => {
    it('returns true for matching description and body', () => {
      const normalized: ClaudeSkillResult = {
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
  });

  describe('install and uninstall', () => {
    let tmpDir: string;

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'sb-cl-install-'));
    });

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('install writes file to temp dir', () => {
      const normalized: ClaudeSkillResult = {
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

    it('uninstall removes file', () => {
      const normalized: ClaudeSkillResult = {
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
  });

  describe('diagnostic coverage', () => {
    it('produces CLAUDE-002 for unknown frontmatter fields', () => {
      const content = '---\nname: test\ndescription: test\nunknown_field: value\n---\n\nBody.';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CLAUDE-002');
    });

    it('produces CLAUDE-003 for invalid effort', () => {
      const content = '---\nname: bad-effort\ndescription: test\neffort: extreme\n---';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CLAUDE-003');
    });

    it('produces CLAUDE-004 for non-boolean values', () => {
      const content = '---\nname: bool-test\ndescription: test\ndisabled: yes\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CLAUDE-004');
    });

    it('produces CLAUDE-005 for unknown tool names', () => {
      const content =
        '---\nname: weird-tools\ndescription: test\nallowed-tools: SomeRandomTool\n---\n\nBody.';
      const result = adapter.parse(content);
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('CLAUDE-005');
    });
  });

  describe('adapter contract', () => {
    const contractSource =
      '---\nname: contract-skill\ndescription: Contract test skill. Use for contracts.\n---\n\nBody';
    const contractNormalized: ClaudeSkillResult = {
      name: 'contract-skill',
      description: 'Contract test skill. Use for contracts.',
      frontmatter: {
        name: 'contract-skill',
        description: 'Contract test skill. Use for contracts.',
      },
      body: 'Body',
      allowedTools: [],
    };

    describeAdapterContract(adapter, {
      source: contractSource,
      normalized: contractNormalized,
      detectRejectInput: '',
    });
  });
});
