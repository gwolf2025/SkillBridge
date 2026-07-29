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
    const result = parseArgs(['node', 'cli.js', '--json', 'list-adapters']);
    expect(result.json).toBe(true);
    expect(result.command).toBe('list-adapters');
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

  it('parses --from=value syntax', () => {
    const result = parseArgs([
      'node',
      'cli.js',
      'convert',
      '--from=markdown',
      '--to=json',
      'file.md',
    ]);
    expect(result.from).toBe('markdown');
    expect(result.to).toBe('json');
  });

  it('parses --policy flag', () => {
    const result = parseArgs(['node', 'cli.js', 'convert', '--policy', 'strict', 'file.md']);
    expect(result.policy).toBe('strict');
  });

  it('parses --source-adapter and --target-adapter', () => {
    const result = parseArgs([
      'node',
      'cli.js',
      'convert',
      '--source-adapter',
      'adapter-claude',
      'file.md',
    ]);
    expect(result.sourceAdapter).toBe('adapter-claude');
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
  it('includes usage text', () => {
    const text = printUsage();
    expect(text).toContain('Usage:');
    expect(text).toContain('skillbridge');
    expect(text).toContain('convert');
    expect(text).toContain('list-adapters');
    expect(text).toContain('--help');
    expect(text).toContain('--version');
    expect(text).toContain('--json');
  });
});

describe('run', () => {
  it('returns usage when no arguments given', () => {
    const result = run(['node', 'cli.js']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
  });

  it('returns usage for --help', () => {
    const result = run(['node', 'cli.js', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
  });

  it('returns version for --version', () => {
    const result = run(['node', 'cli.js', '--version']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBeTruthy();
  });

  it('returns error for unknown command', () => {
    const result = run(['node', 'cli.js', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Error');
    expect(result.output).toContain('unknown command');
  });

  it('returns JSON error for unknown command with --json', () => {
    const result = run(['node', 'cli.js', '--json', 'unknown-command']);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('CLI-001');
  });

  it('returns error for convert without source', () => {
    const result = run(['node', 'cli.js', 'convert']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing source argument');
  });

  it('returns JSON output for list-adapters', () => {
    const result = run(['node', 'cli.js', '--json', 'list-adapters']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.value)).toBe(true);
    expect(parsed.value.length).toBeGreaterThanOrEqual(4);
  });

  it('returns human-readable output for list-adapters', () => {
    const result = run(['node', 'cli.js', 'list-adapters']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('adapter-portable');
    expect(result.output).toContain('adapter-claude');
    expect(result.output).toContain('adapter-codex');
  });
});
