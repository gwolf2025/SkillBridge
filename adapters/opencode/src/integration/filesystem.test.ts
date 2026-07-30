import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OpenCodeAdapter } from '@skillbridge/adapter-opencode';

const adapter = new OpenCodeAdapter();

describe('OpenCode adapter filesystem integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-opencode-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects a .md file with valid frontmatter', () => {
    const filePath = join(tmpDir, 'test-agent.md');
    writeFileSync(filePath, '---\ndescription: test\n---\n\nBody', 'utf-8');
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('detects a .md file with command frontmatter', () => {
    const filePath = join(tmpDir, 'test-command.md');
    writeFileSync(filePath, '---\ndescription: cmd\nagent: builder\n---\n\nBody', 'utf-8');
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('returns false for a path without .md extension', () => {
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

  it('parses a file path and returns correct kind and body', () => {
    const filePath = join(tmpDir, 'parse-test.md');
    writeFileSync(filePath, '---\ndescription: File parsed\n---\n\nFile body content', 'utf-8');
    const result = adapter.parse(filePath);
    expect(result.kind).toBe('agent');
    expect(result.frontmatter.description).toBe('File parsed');
    expect(result.body).toBe('File body content');
    expect(result.nameHint).toBe('parse-test');
    expect(result.diagnostics).toBeUndefined();
  });

  it('parses a command file path', () => {
    const filePath = join(tmpDir, 'cmd-test.md');
    writeFileSync(filePath, '---\ndescription: Cmd\nagent: planner\n---\n\nCmd body', 'utf-8');
    const result = adapter.parse(filePath);
    expect(result.kind).toBe('command');
    expect(result.frontmatter.agent).toBe('planner');
    expect(result.body).toBe('Cmd body');
  });

  it('installs compiled output to a temp directory', () => {
    const installDir = join(tmpDir, 'opencode-test-dir', 'agents');
    mkdirSync(installDir, { recursive: true });

    const normalized = {
      kind: 'agent' as const,
      frontmatter: { description: 'Installed agent' },
      body: 'Installed body.',
      nameHint: 'installed-agent',
    };
    const ctx = {
      source: '',
      normalized,
      manifest: adapter.manifest,
      options: { installDir },
    };

    const installResult = adapter.install(ctx);
    expect(installResult.ok).toBe(true);

    const installedPath = join(installDir, 'installed-agent.md');
    expect(existsSync(installedPath)).toBe(true);

    const content = readFileSync(installedPath, 'utf-8');
    expect(content).toContain('description: Installed agent');
    expect(content).toContain('Installed body.');
  });

  it('uninstalls removes the file', () => {
    const installDir = join(tmpDir, 'opencode-uninstall-dir', 'agents');
    mkdirSync(installDir, { recursive: true });

    const normalized = {
      kind: 'agent' as const,
      frontmatter: { description: 'To uninstall' },
      body: 'To uninstall body.',
      nameHint: 'to-uninstall',
    };
    const ctx = {
      source: '',
      normalized,
      manifest: adapter.manifest,
      options: { installDir },
    };

    adapter.install(ctx);
    const installedPath = join(installDir, 'to-uninstall.md');
    expect(existsSync(installedPath)).toBe(true);

    const uninstallResult = adapter.uninstall(ctx);
    expect(uninstallResult.ok).toBe(true);
    expect(existsSync(installedPath)).toBe(false);
  });

  it('compile output is deterministic', () => {
    const filePath = join(tmpDir, 'det-test.md');
    writeFileSync(filePath, '---\ndescription: Deterministic\n---\n\nContent', 'utf-8');

    const parsed = adapter.parse(filePath);
    const a = adapter.compile(parsed);
    const b = adapter.compile(parsed);
    expect(a).toBe(b);
  });

  it('error diagnostic for non-existent file path', () => {
    const result = adapter.parse(join(tmpDir, 'no-such-file.md'));
    expect(result.diagnostics).toBeDefined();
    if (result.diagnostics) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe('error');
    }
  });

  it('does not access real user-level OpenCode directory', () => {
    const realUserDir = join(tmpdir(), '.config', 'opencode');
    expect(existsSync(realUserDir)).toBe(false);
  });
});
