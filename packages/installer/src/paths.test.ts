import { describe, it, expect } from 'vitest';
import { toPosixPath, resolveProjectScope, resolveUserScope, resolveCustomScope } from './paths.js';
import { homedir } from 'node:os';

describe('toPosixPath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toPosixPath('a\\b\\c')).toBe('a/b/c');
  });

  it('leaves POSIX paths unchanged', () => {
    expect(toPosixPath('a/b/c')).toBe('a/b/c');
  });
});

describe('resolveProjectScope', () => {
  it('resolves relative to cwd', () => {
    const result = resolveProjectScope('.');
    expect(result).toBeTruthy();
    expect(result).not.toContain('..');
  });
});

describe('resolveUserScope', () => {
  it('resolves to home directory', () => {
    expect(resolveUserScope()).toBe(homedir());
  });
});

describe('resolveCustomScope', () => {
  it('resolves a valid custom path', () => {
    const result = resolveCustomScope('/tmp/test');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeTruthy();
  });

  it('rejects path escaping allowed base', () => {
    const result = resolveCustomScope('/etc/passwd', '/safe/dir');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSTALL-004');
  });

  it('allows path within allowed base', () => {
    const result = resolveCustomScope('/safe/dir/sub', '/safe/dir');
    expect(result.ok).toBe(true);
  });

  it('rejects path with excessive .. traversal', () => {
    const result = resolveCustomScope('a/../../../../etc/passwd');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSTALL-004');
  });

  it('rejects deeply nested .. traversal', () => {
    const result = resolveCustomScope('a/b/../../../c/../../etc');
    expect(result.ok).toBe(false);
  });
});
