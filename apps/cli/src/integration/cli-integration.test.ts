import { describe, it, expect } from 'vitest';
import { run, printUsage } from '../cli.js';

describe('CLI integration', () => {
  it('--help prints usage and exits 0', () => {
    const result = run(['node', 'skillbridge', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
    expect(result.output).toContain('convert');
    expect(result.output).toContain('list-adapters');
  });

  it('--version prints version and exits 0', () => {
    const result = run(['node', 'skillbridge', '--version']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('0.0.0');
  });

  it('list-adapters prints adapter table and exits 0', () => {
    const result = run(['node', 'skillbridge', 'list-adapters']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
    expect(result.output).toContain('adapter-claude');
    expect(result.output).toContain('adapter-codex');
    expect(result.output).toContain('adapter-opencode');
  });

  it('list-adapters --json prints JSON array and exits 0', () => {
    const result = run(['node', 'skillbridge', '--json', 'list-adapters']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.value)).toBe(true);
    const names = parsed.value.map((m: { name: string }) => m.name);
    expect(names).toContain('adapter-portable');
    expect(names).toContain('adapter-claude');
  });

  it('unknown command exits 1', () => {
    const result = run(['node', 'skillbridge', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Error');
    expect(result.output).toContain('unknown command');
  });

  it('unknown command --json exits 1 with structured error', () => {
    const result = run(['node', 'skillbridge', '--json', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('CLI-001');
    expect(parsed.error.message).toContain('unknown command');
  });

  it('convert with no source exits 1', () => {
    const result = run(['node', 'skillbridge', 'convert']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing source argument');
  });

  it('no args shows usage and exits 0', () => {
    const result = run(['node', 'skillbridge']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
  });

  it('convert --json with nonexistent source exits 1', () => {
    const result = run([
      'node',
      'skillbridge',
      '--json',
      'convert',
      '--from',
      'markdown',
      '--to',
      'markdown',
      '/nonexistent/path.md',
    ]);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('CLI-003');
  });

  it('usage text is deterministic', () => {
    const text = printUsage();
    expect(text).toContain('convert');
    expect(text).toContain('list-adapters');
    expect(text).toContain('--help');
    expect(text).toContain('--version');
    expect(text).toContain('--from');
    expect(text).toContain('--to');
    expect(text).toContain('--policy');
    expect(text).toContain('--source-adapter');
    expect(text).toContain('--target-adapter');
  });
});
