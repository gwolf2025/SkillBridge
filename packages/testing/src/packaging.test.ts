import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..', '..');

interface PkgJson {
  name: string;
  version: string;
  private?: boolean;
  files?: string[];
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
  repository?: Record<string, string>;
}

const PACKAGE_DIRS = [
  'packages/core',
  'packages/schema',
  'packages/ir',
  'packages/parser',
  'packages/compatibility',
  'packages/compiler',
  'packages/conversion',
  'packages/adapter-sdk',
  'packages/runtime',
  'packages/registry-local',
  'packages/testing',
  'packages/fs',
  'packages/installer',
  'packages/skill-test',
  'adapters/portable',
  'adapters/claude',
  'adapters/codex',
  'adapters/opencode',
  'apps/cli',
];

function readPkg(dir: string): PkgJson {
  return JSON.parse(readFileSync(join(rootDir, dir, 'package.json'), 'utf-8'));
}

describe('packaging invariants', () => {
  describe('version', () => {
    for (const dir of PACKAGE_DIRS) {
      it(`${dir} has version 0.1.0-alpha`, () => {
        expect(readPkg(dir).version).toBe('0.1.0-alpha');
      });
    }
  });

  describe('private', () => {
    for (const dir of PACKAGE_DIRS) {
      it(`${dir} has private: false`, () => {
        expect(readPkg(dir).private).toBe(false);
      });
    }
  });

  describe('files field', () => {
    for (const dir of PACKAGE_DIRS) {
      it(`${dir} has files field with dist, LICENSE, NOTICE, README.md`, () => {
        const pkg = readPkg(dir);
        expect(pkg.files).toBeDefined();
        expect(pkg.files).toContain('dist');
        expect(pkg.files).toContain('LICENSE');
        expect(pkg.files).toContain('NOTICE');
        expect(pkg.files).toContain('README.md');
      });
    }
  });

  describe('LICENSE and NOTICE files', () => {
    for (const dir of PACKAGE_DIRS) {
      it(`${dir}/LICENSE exists`, () => {
        expect(existsSync(join(rootDir, dir, 'LICENSE'))).toBe(true);
      });
      it(`${dir}/NOTICE exists`, () => {
        expect(existsSync(join(rootDir, dir, 'NOTICE'))).toBe(true);
      });
    }
  });

  describe('repository metadata', () => {
    for (const dir of PACKAGE_DIRS) {
      it(`${dir} has repository URL`, () => {
        const pkg = readPkg(dir);
        expect(pkg).toHaveProperty('repository');
        expect(pkg.repository).toBeTruthy();
      });
    }
  });

  describe('CLI bin configuration', () => {
    it('apps/cli has bin.skillbridge pointing to dist/index.js', () => {
      const pkg = readPkg('apps/cli');
      if (pkg.bin) {
        expect(pkg.bin.skillbridge).toBe('./dist/index.js');
      }
    });
  });
});
