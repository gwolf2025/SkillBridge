import { describe, it, expect } from 'vitest';
import { parseArgs, printUsage, run } from './cli.js';

describe('parseArgs', () => {
  it('parses --help flag', () => {
    const result = parseArgs(['node', 'cli.js', '--help']);
    expect(result.help).toBe(true);
  });

  it('parses -h shortcut', () => {
    const result = parseArgs(['node', 'cli.js', '-h']);
    expect(result.help).toBe(true);
  });

  it('parses --version flag', () => {
    const result = parseArgs(['node', 'cli.js', '--version']);
    expect(result.version).toBe(true);
  });

  it('parses -v shortcut', () => {
    const result = parseArgs(['node', 'cli.js', '-v']);
    expect(result.version).toBe(true);
  });

  it('parses --json flag', () => {
    const result = parseArgs(['node', 'cli.js', '--json', 'adapters']);
    expect(result.json).toBe(true);
    expect(result.command).toBe('adapters');
  });

  it('parses --from and --to flags', () => {
    const result = parseArgs([
      'node',
      'cli.js',
      'convert',
      '--from',
      'markdown',
      '--to',
      'json',
      'file.md',
    ]);
    expect(result.command).toBe('convert');
    expect(result.from).toBe('markdown');
    expect(result.to).toBe('json');
    expect(result.args).toEqual(['file.md']);
  });

  it('parses --format flag', () => {
    const result = parseArgs(['node', 'cli.js', 'adapters', '--format', 'markdown']);
    expect(result.command).toBe('adapters');
    expect(result.format).toBe('markdown');
  });

  it('parses --detail flag', () => {
    const result = parseArgs(['node', 'cli.js', 'adapters', '--detail']);
    expect(result.detail).toBe(true);
  });

  it('parses --adapter flag', () => {
    const result = parseArgs(['node', 'cli.js', 'capabilities', '--adapter', 'adapter-portable']);
    expect(result.adapter).toBe('adapter-portable');
  });

  it('returns empty command when no args', () => {
    const result = parseArgs(['node', 'cli.js']);
    expect(result.command).toBe('');
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it('parses positional command', () => {
    const result = parseArgs(['node', 'cli.js', 'convert', 'my-file.md']);
    expect(result.command).toBe('convert');
    expect(result.args).toEqual(['my-file.md']);
  });
});

describe('printUsage', () => {
  it('includes all commands in usage text', () => {
    const text = printUsage();
    expect(text).toContain('convert');
    expect(text).toContain('parse');
    expect(text).toContain('validate');
    expect(text).toContain('inspect');
    expect(text).toContain('adapters');
    expect(text).toContain('capabilities');
    expect(text).toContain('doctor');
    expect(text).toContain('--help');
    expect(text).toContain('--version');
    expect(text).toContain('--json');
  });
});

describe('run', () => {
  it('returns usage when no arguments given', async () => {
    const result = await run(['node', 'cli.js']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
  });

  it('returns usage for --help', async () => {
    const result = await run(['node', 'cli.js', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
  });

  it('returns version for --version', async () => {
    const result = await run(['node', 'cli.js', '--version']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBeTruthy();
  });

  it('returns error for unknown command', async () => {
    const result = await run(['node', 'cli.js', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Error');
    expect(result.output).toContain('unknown command');
  });

  it('returns JSON error for unknown command with --json', async () => {
    const result = await run(['node', 'cli.js', '--json', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('CLI-001');
  });

  it('returns JSON output for adapters', async () => {
    const result = await run(['node', 'cli.js', '--json', 'adapters']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.value)).toBe(true);
    expect(parsed.value.length).toBeGreaterThanOrEqual(4);
  });

  it('returns human-readable output for adapters', async () => {
    const result = await run(['node', 'cli.js', 'adapters']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
    expect(result.output).toContain('adapter-claude');
    expect(result.output).toContain('adapter-codex');
  });

  it('returns error for parse without file', async () => {
    const result = await run(['node', 'cli.js', 'parse']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing file argument');
  });

  it('returns error for validate without dir', async () => {
    const result = await run(['node', 'cli.js', 'validate']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing directory argument');
  });

  it('returns error for inspect without dir', async () => {
    const result = await run(['node', 'cli.js', 'inspect']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing directory argument');
  });

  it('returns capabilities vocabulary', async () => {
    const result = await run(['node', 'cli.js', 'capabilities']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('file-read');
    expect(result.output).toContain('command-exec');
  });

  it('returns capabilities for specific adapter', async () => {
    const result = await run(['node', 'cli.js', 'capabilities', '--adapter', 'adapter-portable']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
  });

  it('returns error for unknown adapter in capabilities', async () => {
    const result = await run(['node', 'cli.js', 'capabilities', '--adapter', 'nonexistent']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('unknown adapter');
  });

  it('doctor exits 0', async () => {
    const result = await run(['node', 'cli.js', 'doctor']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('node-version');
    expect(result.output).toContain('adapters');
  });

  it('doctor --json returns structured output', async () => {
    const result = await run(['node', 'cli.js', '--json', 'doctor']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(parsed.value.checks).toBeDefined();
    expect(Array.isArray(parsed.value.checks)).toBe(true);
  });

  it('list-adapters alias works', async () => {
    const result = await run(['node', 'cli.js', 'list-adapters']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
  });

  it('adapters --detail shows extended info', async () => {
    const result = await run(['node', 'cli.js', 'adapters', '--detail']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Name:');
    expect(result.output).toContain('Description:');
  });

  it('adapters --format filters adapters', async () => {
    const result = await run(['node', 'cli.js', 'adapters', '--format', 'markdown']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
  });

  it('capabilities --json returns grouped JSON', async () => {
    const result = await run(['node', 'cli.js', '--json', 'capabilities']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(parsed.value.filesystem).toBeDefined();
  });

  it('capabilities --format flag is accepted without error', async () => {
    const result = await run(['node', 'cli.js', 'capabilities', '--format', 'markdown']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('IR Capability Vocabulary');
  });
});
