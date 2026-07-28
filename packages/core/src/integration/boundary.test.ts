import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, relative, join } from 'path';
import { fileURLToPath } from 'url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

const PACKAGE_DIRS: Record<string, string> = {
  core: resolve(rootDir, 'packages', 'core'),
  schema: resolve(rootDir, 'packages', 'schema'),
  ir: resolve(rootDir, 'packages', 'ir'),
  parser: resolve(rootDir, 'packages', 'parser'),
  compatibility: resolve(rootDir, 'packages', 'compatibility'),
  compiler: resolve(rootDir, 'packages', 'compiler'),
  conversion: resolve(rootDir, 'packages', 'conversion'),
  runtime: resolve(rootDir, 'packages', 'runtime'),
  'adapter-sdk': resolve(rootDir, 'packages', 'adapter-sdk'),
  'registry-local': resolve(rootDir, 'packages', 'registry-local'),
  testing: resolve(rootDir, 'packages', 'testing'),
  'adapter-portable': resolve(rootDir, 'adapters', 'portable'),
  'adapter-claude': resolve(rootDir, 'adapters', 'claude'),
  'adapter-codex': resolve(rootDir, 'adapters', 'codex'),
  'adapter-opencode': resolve(rootDir, 'adapters', 'opencode'),
};

const FORBIDDEN_IMPORTS: Array<{ from: string[]; to: string[]; reason: string }> = [
  {
    from: ['core', 'schema', 'ir', 'parser', 'compatibility', 'compiler'],
    to: ['adapter-portable', 'adapter-claude', 'adapter-codex', 'adapter-opencode'],
    reason: 'shared packages must not import concrete adapters',
  },
  {
    from: ['core', 'schema', 'ir', 'parser', 'compatibility', 'compiler'],
    to: ['commercial'],
    reason: 'open-source packages must not import commercial code',
  },
  {
    from: ['conversion'],
    to: ['adapter-portable', 'adapter-claude', 'adapter-codex', 'adapter-opencode'],
    reason: 'conversion may depend on adapter-sdk interfaces but not concrete adapters',
  },
  {
    from: ['adapter-portable', 'adapter-claude', 'adapter-codex', 'adapter-opencode'],
    to: ['adapter-portable', 'adapter-claude', 'adapter-codex', 'adapter-opencode'],
    reason: 'adapters must not import from other adapters',
  },
];

describe('architecture boundaries', () => {
  for (const rule of FORBIDDEN_IMPORTS) {
    for (const fromPkg of rule.from) {
      for (const toPkg of rule.to) {
        it(`${fromPkg} must not import ${toPkg} (${rule.reason})`, () => {
          const fromDir = PACKAGE_DIRS[fromPkg];
          const toDir = PACKAGE_DIRS[toPkg] ?? resolve(rootDir, toPkg);
          if (!fromDir) return; // skip unknown packages

          const violations = findImports(fromDir, toDir);
          expect(
            violations,
            [
              `Found ${violations.length} import(s) from ${fromPkg} to ${toPkg}`,
              ...violations.map((v) => `  ${relative(rootDir, v)}`),
            ].join('\n'),
          ).toEqual([]);
        });
      }
    }
  }
});

function findImports(sourceDir: string, targetDir: string): string[] {
  const sourceFiles = findSourceFiles(sourceDir, 'src');
  const violations: string[] = [];

  for (const fullPath of sourceFiles) {
    const content = readFileSync(fullPath, 'utf8');
    const importLines = content.match(/from\s+['"].*?['"]/g) ?? [];

    for (const line of importLines) {
      const importPath = line.replace(/from\s+['"]/, '').replace(/['"]$/, '');
      if (importPath.startsWith('.')) {
        const resolved = resolve(dirname(fullPath), importPath);
        if (resolved.startsWith(targetDir)) {
          violations.push(fullPath);
          break;
        }
      }
    }
  }

  return violations;
}

function findSourceFiles(root: string, subdir: string): string[] {
  const dir = resolve(root, subdir);
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...findSourceFiles(root, join(subdir, entry)));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        results.push(full);
      }
    }
  } catch {
    // directory doesn't exist — skip
  }
  return results;
}
