import { describe, it, expect } from 'vitest';
import { hasReservedWindowsFilename, stripBom, isCaseInsensitivePathEqual } from './win32.js';

describe('hasReservedWindowsFilename', () => {
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT5'];
  for (const name of reserved) {
    it(`detects reserved name '${name}'`, () => {
      expect(hasReservedWindowsFilename(name)).toBe(true);
      expect(hasReservedWindowsFilename(`dir/${name}`)).toBe(true);
      expect(hasReservedWindowsFilename(`dir/${name}.txt`)).toBe(true);
    });
  }

  it('allows normal filenames', () => {
    expect(hasReservedWindowsFilename('readme.txt')).toBe(false);
    expect(hasReservedWindowsFilename('component.ts')).toBe(false);
    expect(hasReservedWindowsFilename('config.json')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(hasReservedWindowsFilename('CON')).toBe(true);
    expect(hasReservedWindowsFilename('con')).toBe(true);
    expect(hasReservedWindowsFilename('Con')).toBe(true);
  });

  it('handles backslash paths', () => {
    expect(hasReservedWindowsFilename('dir\\NUL')).toBe(true);
  });
});

describe('stripBom', () => {
  it('strips leading BOM character', () => {
    expect(stripBom('\uFEFFhello')).toBe('hello');
  });

  it('does not modify content without BOM', () => {
    expect(stripBom('hello')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(stripBom('')).toBe('');
  });
});

describe('isCaseInsensitivePathEqual', () => {
  it('compares case-insensitively', () => {
    expect(isCaseInsensitivePathEqual('C:\\Users', 'c:\\users')).toBe(true);
    expect(isCaseInsensitivePathEqual('/Home/User', '/home/user')).toBe(true);
  });

  it('detects different paths', () => {
    expect(isCaseInsensitivePathEqual('/a/b', '/a/c')).toBe(false);
  });
});
