import { describe, it, expect } from 'vitest';
import { validatePathSafety, classifyFile } from './index.js';

describe('validatePathSafety', () => {
  const root = process.cwd();

  it('accepts a valid relative path', () => {
    const result = validatePathSafety('packages/fs/src/index.ts', root);
    expect(result.ok).toBe(true);
  });

  it('accepts nested relative paths', () => {
    const result = validatePathSafety('node_modules/typescript/lib/typescript.js', root);
    expect(result.ok).toBe(true);
  });

  it('rejects absolute paths', () => {
    const result = validatePathSafety('/etc/passwd', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('FS-002');
    }
  });

  it('rejects traversal via ..', () => {
    const result = validatePathSafety('../../etc/passwd', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('FS-003');
    }
  });

  it('rejects empty path', () => {
    const result = validatePathSafety('', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('FS-001');
    }
  });

  it('rejects whitespace-only path', () => {
    const result = validatePathSafety('   ', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('FS-001');
    }
  });

  it('accepts path that stays within root', () => {
    const result = validatePathSafety('./packages/fs/src/index.test.ts', root);
    expect(result.ok).toBe(true);
  });
});

describe('classifyFile', () => {
  it('classifies .sh as script', () => {
    const result = classifyFile('scripts/build.sh');
    expect(result.isScript).toBe(true);
    expect(result.isConfig).toBe(false);
    expect(result.isDocumentation).toBe(false);
    expect(result.isAsset).toBe(false);
    expect(result.isTest).toBe(false);
  });

  it('classifies .bat as script', () => {
    expect(classifyFile('scripts/deploy.bat').isScript).toBe(true);
  });

  it('classifies .ps1 as script', () => {
    expect(classifyFile('scripts/setup.ps1').isScript).toBe(true);
  });

  it('classifies .md as documentation', () => {
    const result = classifyFile('docs/guide.md');
    expect(result.isDocumentation).toBe(true);
    expect(result.isScript).toBe(false);
  });

  it('classifies .txt as documentation', () => {
    expect(classifyFile('README.txt').isDocumentation).toBe(true);
  });

  it('classifies .json as config', () => {
    const result = classifyFile('config/settings.json');
    expect(result.isConfig).toBe(true);
  });

  it('classifies .yaml as config', () => {
    expect(classifyFile('config.yaml').isConfig).toBe(true);
  });

  it('classifies .png as asset', () => {
    const result = classifyFile('assets/logo.png');
    expect(result.isAsset).toBe(true);
  });

  it('classifies .svg as asset', () => {
    expect(classifyFile('assets/icon.svg').isAsset).toBe(true);
  });

  it('classifies files in test/ directory as test', () => {
    const result = classifyFile('tests/unit.test.ts');
    expect(result.isTest).toBe(true);
    expect(result.isScript).toBe(false);
  });

  it('classifies .test.ts as test', () => {
    const result = classifyFile('src/foo.test.ts');
    expect(result.isTest).toBe(true);
  });

  it('classifies .spec.ts as test', () => {
    expect(classifyFile('src/bar.spec.ts').isTest).toBe(true);
  });

  it('classifies __tests__ directory as test', () => {
    expect(classifyFile('__tests__/baz.ts').isTest).toBe(true);
  });

  it('returns all false for unknown extensions', () => {
    const result = classifyFile('data.bin');
    expect(result.isScript).toBe(false);
    expect(result.isConfig).toBe(false);
    expect(result.isDocumentation).toBe(false);
    expect(result.isAsset).toBe(false);
    expect(result.isTest).toBe(false);
  });

  it('handles Windows backslash paths', () => {
    const result = classifyFile('scripts\\build.sh');
    expect(result.isScript).toBe(true);
  });

  it('handles mixed separators', () => {
    const result = classifyFile('assets\\icons/logo.svg');
    expect(result.isAsset).toBe(true);
  });

  it('handles extensionless files', () => {
    const result = classifyFile('Makefile');
    expect(result.isScript).toBe(false);
    expect(result.isConfig).toBe(false);
    expect(result.isDocumentation).toBe(false);
    expect(result.isAsset).toBe(false);
    expect(result.isTest).toBe(false);
  });
});
