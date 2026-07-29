import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CodexAdapter } from '../index.js';
import type { CodexSkillResult } from '../index.js';

const adapter = new CodexAdapter();

describe('Codex adapter filesystem integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-codex-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects a .md file with valid name and description frontmatter', () => {
    const filePath = join(tmpDir, 'test-skill.md');
    writeFileSync(
      filePath,
      '---\nname: test-skill\ndescription: A test skill\n---\n\nBody',
      'utf-8',
    );
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('detects a SKILL.md file with valid frontmatter', () => {
    const skillDir = join(tmpDir, 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    const filePath = join(skillDir, 'SKILL.md');
    writeFileSync(filePath, '---\nname: my-skill\ndescription: A skill\n---\n\nBody', 'utf-8');
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('returns false for a file without .md extension', () => {
    const filePath = join(tmpDir, 'data.json');
    writeFileSync(filePath, '{}', 'utf-8');
    expect(adapter.detect(filePath)).toBe(false);
  });

  it('returns false for a non-existent path', () => {
    expect(adapter.detect(join(tmpDir, 'nonexistent.md'))).toBe(false);
  });

  it('returns false for a file without frontmatter', () => {
    const filePath = join(tmpDir, 'plain.md');
    writeFileSync(filePath, 'Just plain text.', 'utf-8');
    expect(adapter.detect(filePath)).toBe(false);
  });

  it('parses a file path and returns correct name and body', () => {
    const filePath = join(tmpDir, 'parse-skill.md');
    writeFileSync(
      filePath,
      '---\nname: parse-skill\ndescription: File parsed skill.\n---\n\nFile body content',
      'utf-8',
    );
    const result = adapter.parse(filePath);
    expect(result.name).toBe('parse-skill');
    expect(result.description).toBe('File parsed skill.');
    expect(result.body).toBe('File body content');
  });

  it('discovers and parses agents/openai.yaml companion file', () => {
    const skillDir = join(tmpDir, 'companion-skill');
    mkdirSync(join(skillDir, 'agents'), { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: companion-skill\ndescription: A companion skill.\n---\n\nBody with companion.',
      'utf-8',
    );
    writeFileSync(
      join(skillDir, 'agents', 'openai.yaml'),
      'interface:\n  display_name: "Companion Skill"\npolicy:\n  allow_implicit_invocation: false\n',
      'utf-8',
    );
    const result = adapter.parse(join(skillDir, 'SKILL.md'));
    expect(result.name).toBe('companion-skill');
    expect(result.extensions).toBeDefined();
    expect(result.extensions?._codexOpenaiYaml).toBeDefined();
    const yamlContent = result.extensions?._codexOpenaiYaml as Record<string, unknown>;
    expect(yamlContent.interface).toBeDefined();
    expect((yamlContent.interface as Record<string, unknown>).display_name).toBe('Companion Skill');
  });

  it('installs compiled output to a temp directory with SKILL.md', () => {
    const installDir = join(tmpDir, 'install-test-dir');
    mkdirSync(installDir, { recursive: true });

    const result: CodexSkillResult = {
      name: 'installed-skill',
      description: 'Installed skill.',
      frontmatter: { name: 'installed-skill', description: 'Installed skill.' },
      body: 'Installed body.',
    };
    const ctx = {
      source: '',
      normalized: result,
      manifest: adapter.manifest,
      options: { installDir },
    };

    const installResult = adapter.install(ctx);
    expect(installResult.ok).toBe(true);

    const installedPath = join(installDir, 'SKILL.md');
    expect(existsSync(installedPath)).toBe(true);

    const content = readFileSync(installedPath, 'utf-8');
    expect(content).toContain('description: Installed skill.');
    expect(content).toContain('Installed body.');
  });

  it('install with companion openaiYaml writes companion file', () => {
    const installDir = join(tmpDir, 'companion-install-dir');
    mkdirSync(installDir, { recursive: true });

    const result: CodexSkillResult = {
      name: 'companion-installed',
      description: 'Companion installed.',
      frontmatter: { name: 'companion-installed', description: 'Companion installed.' },
      body: 'Body.',
      extensions: { _codexOpenaiYaml: { interface: { display_name: 'Installed Companion' } } },
    };
    const ctx = {
      source: '',
      normalized: result,
      manifest: adapter.manifest,
      options: { installDir },
    };

    const installResult = adapter.install(ctx);
    expect(installResult.ok).toBe(true);

    expect(existsSync(join(installDir, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(installDir, 'agents', 'openai.yaml'))).toBe(true);

    const yamlContent = readFileSync(join(installDir, 'agents', 'openai.yaml'), 'utf-8');
    expect(yamlContent).toContain('display_name');
  });

  it('uninstall removes SKILL.md', () => {
    const installDir = join(tmpDir, 'uninstall-test-dir');
    mkdirSync(installDir, { recursive: true });

    const result: CodexSkillResult = {
      name: 'to-uninstall',
      description: 'To uninstall.',
      frontmatter: { name: 'to-uninstall', description: 'To uninstall.' },
      body: 'To uninstall body.',
    };
    const ctx = {
      source: '',
      normalized: result,
      manifest: adapter.manifest,
      options: { installDir },
    };

    adapter.install(ctx);
    const installedPath = join(installDir, 'SKILL.md');
    expect(existsSync(installedPath)).toBe(true);

    const uninstallResult = adapter.uninstall(ctx);
    expect(uninstallResult.ok).toBe(true);
    expect(existsSync(installedPath)).toBe(false);
  });

  it('compile output is deterministic from file source', () => {
    const filePath = join(tmpDir, 'det-test.md');
    writeFileSync(
      filePath,
      '---\nname: det-skill\ndescription: Deterministic.\n---\n\nContent',
      'utf-8',
    );
    const parsed = adapter.parse(filePath);
    const a = adapter.compile(parsed);
    const b = adapter.compile(parsed);
    expect(a).toBe(b);
  });

  it('creates CODEX-002 diagnostic for malformed agents/openai.yaml', () => {
    const skillDir = join(tmpDir, 'bad-yaml-skill');
    mkdirSync(join(skillDir, 'agents'), { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: bad-yaml-skill\ndescription: test\n---\n\nBody.',
      'utf-8',
    );
    writeFileSync(join(skillDir, 'agents', 'openai.yaml'), 'unclosed: [list\n', 'utf-8');
    const result = adapter.parse(join(skillDir, 'SKILL.md'));
    const codes = result.diagnostics?.map((d) => d.code) ?? [];
    expect(codes).toContain('CODEX-002');
  });

  it('does not access real user-level .agents directory', () => {
    const realUserDir = join(tmpdir(), '.agents');
    expect(existsSync(realUserDir)).toBe(false);
  });
});
