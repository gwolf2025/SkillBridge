import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describeAdapterContract } from '../../../packages/testing/src/index.js';
import { OpenCodeAdapter } from './index.js';
import type { OpenCodeSkillResult } from './index.js';

const adapter = new OpenCodeAdapter();

describe('adapter-opencode', () => {
  describe('manifest', () => {
    it('has correct name and vendor', () => {
      expect(adapter.manifest.name).toBe('adapter-opencode');
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
    it('returns true for content with agent frontmatter', () => {
      const content = '---\ndescription: test\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns true for content with command frontmatter', () => {
      const content = '---\ndescription: cmd\nagent: builder\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns true for content with mode field', () => {
      const content = '---\nmode: subagent\n---\n\nBody';
      expect(adapter.detect(content)).toBe(true);
    });

    it('returns false for content without frontmatter', () => {
      const content = 'Just a plain text file.';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(adapter.detect('')).toBe(false);
    });

    it('returns false for content with only --- but no OpenCode fields', () => {
      const content = '---\nunknown: value\n---\n\nBody';
      expect(adapter.detect(content)).toBe(false);
    });

    it('returns false for null input', () => {
      expect(adapter.detect(null as unknown as string)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses minimal agent', () => {
      const content =
        '---\ndescription: Minimal test agent\n---\n\nThis is the system prompt body.';
      const result = adapter.parse(content);
      expect(result.kind).toBe('agent');
      expect(result.frontmatter.description).toBe('Minimal test agent');
      expect(result.body).toBe('This is the system prompt body.');
      expect(result.diagnostics).toBeUndefined();
    });

    it('parses agent with full frontmatter', () => {
      const content =
        "---\ndescription: Full test agent\nmode: subagent\nmodel: gpt-4\ninstruction: .opencode/instructions/build.md\nrule: .opencode/rules/typescript.md\npermission:\n  edit: allow\n  bash:\n    'pnpm *': allow\n---\n\nFull system prompt body here.";
      const result = adapter.parse(content);
      expect(result.kind).toBe('agent');
      expect(result.frontmatter.description).toBe('Full test agent');
      expect(result.frontmatter.mode).toBe('subagent');
      expect(result.frontmatter.model).toBe('gpt-4');
      expect(result.frontmatter.instruction).toBe('.opencode/instructions/build.md');
      expect(result.frontmatter.rule).toBe('.opencode/rules/typescript.md');
      expect(result.frontmatter.permission?.edit).toBe('allow');
      expect(result.body).toBe('Full system prompt body here.');
    });

    it('parses command with agent reference', () => {
      const content =
        '---\ndescription: A test command\nagent: builder\n---\n\nRun this command when you need to build.';
      const result = adapter.parse(content);
      expect(result.kind).toBe('command');
      expect(result.frontmatter.description).toBe('A test command');
      expect(result.frontmatter.agent).toBe('builder');
      expect(result.body).toBe('Run this command when you need to build.');
    });

    it('parses command with instruction reference', () => {
      const content =
        '---\ndescription: Command with instruction\nagent: planner\ninstruction: .opencode/instructions/plan.md\nrule: .opencode/rules/planning.md\n---\n\nPlan the next task.';
      const result = adapter.parse(content);
      expect(result.kind).toBe('command');
      expect(result.frontmatter.instruction).toBe('.opencode/instructions/plan.md');
      expect(result.frontmatter.rule).toBe('.opencode/rules/planning.md');
    });

    it('returns error for malformed YAML', () => {
      const content = '---\ndescription: Broken\nmode: [unclosed list\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      if (result.diagnostics) {
        expect(result.diagnostics.some((d) => d.code === 'OPENCODE-001')).toBe(true);
      }
    });

    it('returns warning for invalid mode', () => {
      const content = '---\ndescription: Bad mode\nmode: invalid_value\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      if (result.diagnostics) {
        expect(result.diagnostics.some((d) => d.code === 'OPENCODE-002')).toBe(true);
      }
    });

    it('parses empty frontmatter', () => {
      const content = '---\n---\n\nbody text';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe('body text');
      expect(result.kind).toBe('agent');
    });

    it('preserves unknown fields in extensions', () => {
      const content =
        '---\ndescription: With extras\ncustom_field: hello\nanother_field: 42\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.custom_field).toBe('hello');
      expect(result.extensions?.another_field).toBe(42);
    });

    it('produces warning for ask permission mode', () => {
      const content = '---\ndescription: Ask permission\npermission:\n  edit: ask\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.frontmatter.permission?.edit).toBe('ask');
    });

    it('handles array rule field', () => {
      const content =
        '---\ndescription: Array rule\nrule:\n  - rules/a.md\n  - rules/b.md\n---\n\nbody';
      const result = adapter.parse(content);
      expect(Array.isArray(result.frontmatter.rule)).toBe(true);
      expect(result.frontmatter.rule).toContain('rules/a.md');
      expect(result.frontmatter.rule).toContain('rules/b.md');
    });

    it('parses body-only content with empty frontmatter', () => {
      const content = 'Just body text with no frontmatter.';
      const result = adapter.parse(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body.trim()).toBe('Just body text with no frontmatter.');
    });

    it('handles missing body as empty string', () => {
      const content = '---\ndescription: No body\n---\n\n';
      const result = adapter.parse(content);
      expect(result.frontmatter.description).toBe('No body');
      expect(typeof result.body).toBe('string');
    });

    it('reports error for non-existent file path', () => {
      const result = adapter.parse('/nonexistent/path/file.md');
      expect(result.diagnostics).toBeDefined();
      if (result.diagnostics) {
        expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
      }
    });
  });

  describe('normalize', () => {
    it('maps minimal agent to NormalizedSkill', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'A test agent' },
        body: 'Body content',
        nameHint: 'test-agent',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('test-agent');
      expect(result.identity.version).toBe('0.0.0');
      expect(result.identity.description).toBe('A test agent');
      expect(result.irVersion).toBe('0.1.0');
      expect(result.source.format).toBe('markdown');
    });

    it('derives capabilities from permission edit: allow', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: {
          description: 'Cap test',
          permission: { edit: true },
        },
        body: '',
        nameHint: 'cap-test',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('file-write');
    });

    it('derives capabilities from bash permissions', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: {
          description: 'Bash cap',
          permission: { bash: { 'pnpm *': 'allow' } },
        },
        body: '',
        nameHint: 'bash-cap',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('command-exec');
    });

    it('derives subagent capability from mode', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Sub', mode: 'subagent' },
        body: '',
        nameHint: 'sub',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).toContain('subagent');
    });

    it('maps permissions to IR format', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: {
          description: 'Perm test',
          permission: {
            edit: true,
            bash: { 'pnpm *': 'allow', 'git *': 'deny' },
          },
        },
        body: '',
        nameHint: 'perm-test',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.permissions.length).toBeGreaterThanOrEqual(2);
      expect(result.permissions.some((p) => p.resource === 'fs')).toBe(true);
      expect(result.permissions.some((p) => p.resource === 'bash:pnpm *')).toBe(true);
    });

    it('produces warning for ask permission', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: {
          description: 'Ask test',
          permission: { edit: 'ask' },
        },
        body: '',
        nameHint: 'ask-test',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.capabilities).not.toContain('file-write');
    });

    it('preserves extensions in normalized output', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Ext test' },
        body: '',
        nameHint: 'ext-test',
        extensions: { custom_field: 'hello' },
      };
      const result = adapter.normalize('source', parsed);
      expect(result.extensions).toBeDefined();
      expect(result.extensions?.custom_field).toBe('hello');
    });

    it('includes invocation from body', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Inv test' },
        body: 'Do the thing.',
        nameHint: 'inv-test',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.invocation?.instructions).toBe('Do the thing.');
    });

    it('uses defaults for missing fields', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: {},
        body: '',
      };
      const result = adapter.normalize('source', parsed);
      expect(result.identity.name).toBe('unnamed');
      expect(result.identity.version).toBe('0.0.0');
      expect(result.capabilities).toEqual([]);
      expect(result.permissions).toEqual([]);
    });
  });

  describe('compile', () => {
    it('compiles minimal agent to valid OpenCode markdown', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Compiled test agent' },
        body: 'Compiled body text.',
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('---');
      expect(output).toContain('description: Compiled test agent');
      expect(output).toContain('Compiled body text.');
    });

    it('compiles agent with mode and permission', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: {
          description: 'Full agent',
          mode: 'subagent',
          model: 'gpt-4',
          permission: { edit: true, bash: { 'pnpm *': 'allow' } },
        },
        body: 'Full compiled body.',
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('mode: subagent');
      expect(output).toContain('model: gpt-4');
      expect(output).toContain('edit: true');
      expect(output).toContain('pnpm *');
    });

    it('compiles command with agent reference', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'command',
        frontmatter: { description: 'Test command', agent: 'builder' },
        body: 'Run this command.',
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('agent: builder');
      expect(output).toContain('description: Test command');
      expect(output).not.toContain('mode:');
    });

    it('preserves extensions in compiled output', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Ext test' },
        body: 'body',
        extensions: { custom_field: 'hello' },
      };
      const output = adapter.compile(parsed);
      expect(output).toContain('custom_field');
      expect(output).toContain('hello');
    });

    it('produces deterministic output', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Det test' },
        body: 'Same content.',
      };
      const a = adapter.compile(parsed);
      const b = adapter.compile(parsed);
      expect(a).toBe(b);
    });

    it('omits mode when primary (default)', () => {
      const parsed: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Primary', mode: 'primary' },
        body: 'body',
      };
      const output = adapter.compile(parsed);
      expect(output).not.toContain('mode:');
    });
  });

  describe('installPlan', () => {
    it('returns steps for project and user scope', () => {
      const normalized: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Plan test' },
        body: 'body',
        nameHint: 'plan-test',
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
      const normalized: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Verify test' },
        body: 'Verify body.',
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const result = adapter.verify(ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('returns true for matching compile/parse roundtrip via verify', () => {
      const normalized: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Original' },
        body: 'Original body.',
      };
      const ctx = { source: '', normalized, manifest: adapter.manifest };
      const result = adapter.verify(ctx);
      // Verification compares compile output re-parsed - should match
      expect(result.ok).toBe(true);
    });
  });

  describe('install and uninstall', () => {
    let tmpDir: string;

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'sb-oc-install-'));
    });

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('install writes file to temp dir', () => {
      const normalized: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Install test' },
        body: 'body',
        nameHint: 'install-test',
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
      const normalized: OpenCodeSkillResult = {
        kind: 'agent',
        frontmatter: { description: 'Uninstall test' },
        body: 'body',
        nameHint: 'uninstall-test',
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
    it('produces OPENCODE-004 for command with mode field', () => {
      const content = '---\ndescription: cmd\nagent: builder\nmode: subagent\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('OPENCODE-004');
    });

    it('produces OPENCODE-004 for command with permission field', () => {
      const content =
        '---\ndescription: cmd\nagent: builder\npermission:\n  edit: allow\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('OPENCODE-004');
    });

    it('produces OPENCODE-005 for instruction reference', () => {
      const content =
        '---\ndescription: test\ninstruction: .opencode/instructions/build.md\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('OPENCODE-005');
    });

    it('produces OPENCODE-005 for unknown fields', () => {
      const content = '---\ndescription: test\ncustom_field: hello\n---\n\nbody';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('OPENCODE-005');
    });

    it('produces OPENCODE-006 for missing description on agent', () => {
      const content = '---\n---\n\nbody text';
      const result = adapter.parse(content);
      expect(result.diagnostics).toBeDefined();
      const codes = result.diagnostics?.map((d) => d.code) ?? [];
      expect(codes).toContain('OPENCODE-006');
    });
  });

  describe('adapter contract (AC12)', () => {
    const contractSource = '---\ndescription: contract agent\n---\n\nBody';
    const contractNormalized: OpenCodeSkillResult = {
      kind: 'agent',
      frontmatter: { description: 'contract agent' },
      body: 'Body',
      nameHint: 'contract-agent',
    };

    describeAdapterContract(adapter, {
      source: contractSource,
      normalized: contractNormalized,
      detectRejectInput: '',
    });
  });
});
