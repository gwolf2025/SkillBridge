import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeCodeAdapter } from '../index.js';
import type { ClaudeSkillResult } from '../index.js';

const adapter = new ClaudeCodeAdapter();

describe('Claude adapter filesystem integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-claude-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects a .md file with valid frontmatter', () => {
    const filePath = join(tmpDir, 'test-skill.md');
    writeFileSync(filePath, '---\ndescription: test\n---\n\nBody', 'utf-8');
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('detects a file with name frontmatter', () => {
    const filePath = join(tmpDir, 'test-name.md');
    writeFileSync(filePath, '---\nname: test-name\n---\n\nBody', 'utf-8');
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
    expect(result.diagnostics).toBeUndefined();
  });

  it('installs compiled output to a temp directory', () => {
    const installDir = join(tmpDir, 'install-test-dir');
    mkdirSync(installDir, { recursive: true });

    const result: ClaudeSkillResult = {
      name: 'installed-skill',
      description: 'Installed skill.',
      frontmatter: { name: 'installed-skill', description: 'Installed skill.' },
      body: 'Installed body.',
      allowedTools: [],
    };
    const ctx = {
      source: '',
      normalized: result,
      manifest: adapter.manifest,
      options: { installDir },
    };

    const installResult = adapter.install(ctx);
    expect(installResult.ok).toBe(true);

    const installedPath = join(installDir, 'installed-skill.md');
    expect(existsSync(installedPath)).toBe(true);

    const content = readFileSync(installedPath, 'utf-8');
    expect(content).toContain('description: Installed skill.');
    expect(content).toContain('Installed body.');
  });

  it('uninstalls removes the file', () => {
    const installDir = join(tmpDir, 'uninstall-test-dir');
    mkdirSync(installDir, { recursive: true });

    const result: ClaudeSkillResult = {
      name: 'to-uninstall',
      description: 'To uninstall.',
      frontmatter: { name: 'to-uninstall', description: 'To uninstall.' },
      body: 'To uninstall body.',
      allowedTools: [],
    };
    const ctx = {
      source: '',
      normalized: result,
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

  it('treats non-existent file path as body content', () => {
    const result = adapter.parse(join(tmpDir, 'no-such-file.md'));
    expect(result.diagnostics).toBeUndefined();
    expect(result.body).toContain('no-such-file.md');
  });

  it('does not access real user-level Claude directory', () => {
    const realUserDir = join(tmpdir(), '.claude');
    expect(existsSync(realUserDir)).toBe(false);
  });
});
