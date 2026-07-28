import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PortableAdapter } from '../index.js';

const adapter = new PortableAdapter();

describe('Portable adapter filesystem integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-portable-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects a file path containing SKILL.md frontmatter', () => {
    const filePath = join(tmpDir, 'test-skill.md');
    writeFileSync(filePath, `---\nname: test\nversion: 1.0.0\n---\n\nBody`, 'utf-8');
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('detects a SKILL.md file', () => {
    const filePath = join(tmpDir, 'SKILL.md');
    writeFileSync(filePath, `---\nname: skill\nversion: 1.0.0\n---\n\nContent`, 'utf-8');
    expect(adapter.detect(filePath)).toBe(true);
  });

  it('detects a directory containing SKILL.md', () => {
    const dirPath = join(tmpDir, 'skill-pkg');
    mkdirSync(dirPath);
    writeFileSync(
      join(dirPath, 'SKILL.md'),
      `---\nname: pkg\nversion: 1.0.0\n---\n\nBody`,
      'utf-8',
    );
    expect(adapter.detect(dirPath)).toBe(true);
  });

  it('returns false for a directory without SKILL.md', () => {
    const dirPath = join(tmpDir, 'empty-dir');
    mkdirSync(dirPath);
    expect(adapter.detect(dirPath)).toBe(false);
  });

  it('returns false for a non-existent path', () => {
    expect(adapter.detect(join(tmpDir, 'nonexistent.md'))).toBe(false);
  });

  it('returns false for a file without frontmatter', () => {
    const filePath = join(tmpDir, 'plain.md');
    writeFileSync(filePath, 'Just plain text.', 'utf-8');
    expect(adapter.detect(filePath)).toBe(false);
  });

  it('returns false for a non-.md file', () => {
    const filePath = join(tmpDir, 'data.json');
    writeFileSync(filePath, '{}', 'utf-8');
    expect(adapter.detect(filePath)).toBe(false);
  });

  it('parses a SKILL.md file path', () => {
    const filePath = join(tmpDir, 'SKILL.md');
    writeFileSync(filePath, `---\nname: file-skill\nversion: 2.0.0\n---\n\nFile body`, 'utf-8');
    const result = adapter.parse(filePath);
    expect(result.frontmatter.name).toBe('file-skill');
    expect(result.frontmatter.version).toBe('2.0.0');
    expect(result.diagnostics).toBeUndefined();
  });

  it('parses a directory SKILL.md', () => {
    const dirPath = join(tmpDir, 'pkg-dir');
    mkdirSync(dirPath);
    writeFileSync(
      join(dirPath, 'SKILL.md'),
      `---\nname: dir-skill\nversion: 3.0.0\n---\n\nDir body`,
      'utf-8',
    );
    const result = adapter.parse(dirPath);
    expect(result.frontmatter.name).toBe('dir-skill');
    expect(result.frontmatter.version).toBe('3.0.0');
  });

  it('discovers resource files in a directory', () => {
    const dirPath = join(tmpDir, 'res-dir');
    mkdirSync(dirPath);
    writeFileSync(
      join(dirPath, 'SKILL.md'),
      `---\nname: res-skill\nversion: 1.0.0\n---\n\nBody`,
      'utf-8',
    );
    writeFileSync(join(dirPath, 'config.json'), '{"key": "value"}', 'utf-8');
    writeFileSync(join(dirPath, 'help.txt'), 'Some help text', 'utf-8');

    const result = adapter.parse(dirPath);
    expect(result.extensions).toBeDefined();
    expect(result.extensions?._resources).toBeDefined();
    const resources = result.extensions?._resources as string[];
    expect(resources).toContain('config.json');
    expect(resources).toContain('help.txt');
    expect(resources).not.toContain('SKILL.md');
  });

  it('compile output preserves deterministic content', () => {
    const filePath = join(tmpDir, 'det-skill.md');
    writeFileSync(filePath, `---\nname: det\nversion: 1.0.0\n---\n\nContent`, 'utf-8');

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
});
