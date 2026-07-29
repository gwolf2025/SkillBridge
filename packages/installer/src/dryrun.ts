import type { InstallPlan, InstallScope } from '../../adapter-sdk/src/index.js';
import type { IntegrityManifest } from './manifest.js';

export interface ResolvedInstallPlan extends InstallPlan {
  scope: InstallScope;
  destinationPaths: string[];
  manifest?: IntegrityManifest;
}

export interface DryRunOptions {
  plan: ResolvedInstallPlan;
  adapterName: string;
}

export function formatDryRun(opts: DryRunOptions): string {
  const lines: string[] = [];
  const p = opts.plan;

  lines.push(`Installation Plan: ${opts.adapterName}`);
  lines.push(`  Scope: ${p.scope}${p.customPath ? ` (${p.customPath})` : ''}`);

  if (p.destinationPaths.length > 0) {
    lines.push('  Destinations:');
    for (const dp of p.destinationPaths) {
      lines.push(`    - ${dp}`);
    }
  }

  if (p.steps.length > 0) {
    lines.push('  Steps:');
    for (const step of p.steps) {
      lines.push(`    - ${step}`);
    }
  }

  if (p.overwritePolicy) {
    lines.push(`  Overwrite Policy: ${p.overwritePolicy}`);
  }

  if (p.conflicts && p.conflicts.length > 0) {
    lines.push('  Conflicts:');
    for (const c of p.conflicts) {
      lines.push(`    - [${c.severity}] ${c.targetPath}`);
    }
  }

  if (p.backupPlan && p.backupPlan.length > 0) {
    lines.push('  Backup Plan:');
    for (const b of p.backupPlan) {
      const checksum = b.checksum ? ` (checksum: ${b.checksum.slice(0, 12)}...)` : '';
      lines.push(`    - ${b.sourcePath} → ${b.backupPath}${checksum}`);
    }
  }

  if (p.manifest) {
    lines.push('  Integrity Manifest:');
    for (const [filePath, hash] of Object.entries(p.manifest.files)) {
      lines.push(`    - ${filePath}: ${hash.slice(0, 16)}...`);
    }
  }

  if (p.warnings && p.warnings.length > 0) {
    lines.push('  Warnings:');
    for (const w of p.warnings) {
      lines.push(`    - ${w.message}`);
    }
  }

  return lines.join('\n');
}
