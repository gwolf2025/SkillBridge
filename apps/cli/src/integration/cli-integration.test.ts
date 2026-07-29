import { describe, it, expect } from 'vitest';
import { run, printUsage } from '../cli.js';

describe('CLI integration', () => {
  it('--help prints usage and exits 0', async () => {
    const result = await run(['node', 'skillbridge', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
    expect(result.output).toContain('parse');
    expect(result.output).toContain('validate');
    expect(result.output).toContain('inspect');
    expect(result.output).toContain('adapters');
    expect(result.output).toContain('capabilities');
    expect(result.output).toContain('doctor');
  });

  it('--version prints version and exits 0', async () => {
    const result = await run(['node', 'skillbridge', '--version']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('0.0.0');
  });

  it('adapters lists at least 4 adapters', async () => {
    const result = await run(['node', 'skillbridge', 'adapters']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
    expect(result.output).toContain('adapter-claude');
    expect(result.output).toContain('adapter-codex');
    expect(result.output).toContain('adapter-opencode');
  });

  it('adapters --json returns JSON array', async () => {
    const result = await run(['node', 'skillbridge', '--json', 'adapters']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.value)).toBe(true);
    const names = parsed.value.map((m: { name: string }) => m.name);
    expect(names).toContain('adapter-portable');
    expect(names).toContain('adapter-claude');
  });

  it('unknown command exits 1', async () => {
    const result = await run(['node', 'skillbridge', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Error');
    expect(result.output).toContain('unknown command');
  });

  it('unknown command --json exits 1 with structured error', async () => {
    const result = await run(['node', 'skillbridge', '--json', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('CLI-001');
  });

  it('no args shows usage and exits 0', async () => {
    const result = await run(['node', 'skillbridge']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
  });

  it('parse --json with valid source returns structured data', async () => {
    const result = await run(['node', 'skillbridge', '--json', 'parse', '--', __filename]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(parsed.value.frontmatter).toBeDefined();
  });

  it('capabilities lists vocabulary', async () => {
    const result = await run(['node', 'skillbridge', 'capabilities']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('file-read');
    expect(result.output).toContain('file-write');
    expect(result.output).toContain('command-exec');
  });

  it('capabilities --adapter shows adapter capabilities', async () => {
    const result = await run([
      'node',
      'skillbridge',
      'capabilities',
      '--adapter',
      'adapter-portable',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
    expect(result.output).toContain('detect');
  });

  it('doctor exits 0 with diagnostics', async () => {
    const result = await run(['node', 'skillbridge', 'doctor']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('node-version');
    expect(result.output).toContain('adapters');
    expect(result.output).toContain('platform');
  });

  it('doctor --json returns structured JSON without secrets', async () => {
    const result = await run(['node', 'skillbridge', '--json', 'doctor']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.value.checks)).toBe(true);
    const envCheck = parsed.value.checks.find((c: { check: string }) => c.check === 'environment');
    expect(envCheck).toBeDefined();
  });

  it('usage text is deterministic', () => {
    const text = printUsage();
    expect(text).toContain('parse');
    expect(text).toContain('validate');
    expect(text).toContain('inspect');
    expect(text).toContain('adapters');
    expect(text).toContain('capabilities');
    expect(text).toContain('doctor');
    expect(text).toContain('--format');
    expect(text).toContain('--detail');
    expect(text).toContain('--adapter');
  });
});
