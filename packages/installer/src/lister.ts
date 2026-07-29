import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter } from '../../adapter-sdk/src/index.js';
import type { Result, Diagnostic } from '../../core/src/index.js';
import { ok } from '../../core/src/index.js';
import { stripBom } from '../../core/src/win32.js';

export interface InstalledSkillInfo {
  name: string;
  adapterName: string;
  path: string;
  status: 'present' | 'missing';
}

export function listInstalled(
  adapters: Adapter[],
  directories: string[],
): Result<InstalledSkillInfo[], Diagnostic[]> {
  const results: InstalledSkillInfo[] = [];

  for (const dirPath of directories) {
    if (!existsSync(dirPath)) continue;

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(dirPath, entry.name, 'SKILL.md');

        if (!existsSync(skillPath)) continue;
        const content = tryReadFile(skillPath);
        if (!content) continue;

        for (const ad of adapters) {
          try {
            if (ad.detect(content) || ad.detect(skillPath)) {
              results.push({
                name: entry.name,
                adapterName: ad.manifest.name,
                path: skillPath,
                status: 'present',
              });
              break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return ok(results);
}

function tryReadFile(path: string): string | undefined {
  try {
    const s = statSync(path);
    if (!s.isFile()) return undefined;
    return stripBom(readFileSync(path, 'utf-8'));
  } catch {
    return undefined;
  }
}
