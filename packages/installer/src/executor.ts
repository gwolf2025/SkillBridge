import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  renameSync,
  rmSync,
  existsSync,
  cpSync,
  mkdirSync,
} from 'node:fs';
import { join, dirname, resolve, relative, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import type { Adapter, ConversionContext, Diagnostic } from '../../adapter-sdk/src/index.js';
import type { ResolvedInstallPlan } from './dryrun.js';
import { ok } from '../../core/src/index.js';
import type { Result } from '../../core/src/index.js';
import type { IntegrityManifest } from './manifest.js';
import { generate as generateManifest } from './manifest.js';

export type ExecutorAction = 'install' | 'uninstall';

export interface ExecutorOptions {
  adapter: Adapter;
  context: ConversionContext;
  plan: ResolvedInstallPlan;
  force?: boolean;
  dryRun?: boolean;
  action: ExecutorAction;
}

export interface ExecutorResult {
  action: ExecutorAction;
  success: boolean;
  manifest?: IntegrityManifest;
  backupPaths?: string[];
  checks?: VerifyCheck[];
}

export interface VerifyCheck {
  filePath: string;
  status: 'match' | 'missing' | 'mismatch';
  expectedChecksum?: string;
  actualChecksum?: string;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function validatePathInDir(
  targetPath: string,
  allowedDir: string,
  label: string,
  diagnostics: Diagnostic[],
): boolean {
  const resolved = resolve(targetPath);
  const allowed = resolve(allowedDir);
  const rel = relative(allowed, resolved);
  if (rel.startsWith('..') || normalize(rel).startsWith('..')) {
    diagnostics.push({
      severity: 'error',
      message: `path traversal blocked: ${label} '${targetPath}' is outside '${allowedDir}'`,
      code: 'INSTALL-012',
    });
    return false;
  }
  return true;
}

interface BackupRecord {
  sourcePath: string;
  backupPath: string;
}

function readPlanOutput(plan: ResolvedInstallPlan): Record<string, string> {
  const files: Record<string, string> = {};
  for (let i = 0; i < plan.steps.length; i++) {
    files[`step-${i}`] = plan.steps[i];
  }
  return files;
}

export function execute(opts: ExecutorOptions): Result<ExecutorResult, Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const { adapter, context, plan, force, dryRun, action } = opts;
  const hasConflicts = plan.conflicts && plan.conflicts.length > 0;

  if (action === 'install' && hasConflicts && !force) {
    for (const c of plan.conflicts!) {
      diagnostics.push({
        severity: 'error',
        message: `conflict at '${c.targetPath}' — use --force to overwrite`,
        code: 'INSTALL-008',
      });
    }
    return { ok: false, error: diagnostics };
  }

  if (dryRun) {
    return ok({ action, success: true });
  }

  if (!adapter.install) {
    diagnostics.push({
      severity: 'error',
      message: `adapter '${adapter.manifest.name}' does not support install`,
      code: 'INSTALL-009',
    });
    return { ok: false, error: diagnostics };
  }

  const stagingDir = mkdtempSync(join(tmpdir(), 'sb-inst-exec-'));
  const backups: BackupRecord[] = [];
  let committed = false;

  try {
    const plannedFiles = readPlanOutput(plan);
    const plannedDirs = plan.destinationPaths ?? [];

    // Validate all destination paths before any writes
    for (const dp of plannedDirs) {
      if (!validatePathInDir(dp, stagingDir, 'destination path', diagnostics)) {
        return { ok: false, error: diagnostics };
      }
    }

    const manifestResult = generateManifest(plannedFiles);
    if (!manifestResult.ok) {
      diagnostics.push(manifestResult.error);
      return { ok: false, error: diagnostics };
    }
    const manifest = manifestResult.value;

    for (const [relPath, content] of Object.entries(plannedFiles)) {
      if (!validatePathInDir(relPath, '', 'planned file path', diagnostics)) {
        return { ok: false, error: diagnostics };
      }
      const stagePath = join(stagingDir, relPath);
      mkdirSync(dirname(stagePath), { recursive: true });
      writeFileSync(stagePath, content, 'utf-8');
    }

    if (action === 'install') {
      if (plan.backupPlan && plan.backupPlan.length > 0) {
        for (const be of plan.backupPlan) {
          if (existsSync(be.sourcePath)) {
            const bDir = dirname(be.backupPath);
            mkdirSync(bDir, { recursive: true });
            cpSync(be.sourcePath, be.backupPath, { recursive: true });
            backups.push({ sourcePath: be.sourcePath, backupPath: resolve(be.backupPath) });
          }
        }
      }

      for (const dp of plannedDirs) {
        mkdirSync(dp, { recursive: true });
      }

      for (const [relPath] of Object.entries(plannedFiles)) {
        const sourcePath = join(stagingDir, relPath);
        const destDir = plannedDirs[0] ?? '.';
        const destPath = join(destDir, relPath);
        mkdirSync(dirname(destPath), { recursive: true });
        renameSync(sourcePath, destPath);
      }

      adapter.install(context);
    } else if (action === 'uninstall') {
      for (const dp of plannedDirs) {
        if (existsSync(dp)) {
          const backupPath = resolve(`${dp}.uninstall-backup`);
          cpSync(dp, backupPath, { recursive: true });
          backups.push({ sourcePath: dp, backupPath });
          rmSync(dp, { recursive: true, force: true });
        }
      }
    }

    committed = true;
    rmSync(stagingDir, { recursive: true, force: true });

    return ok({
      action,
      success: true,
      manifest,
      backupPaths: backups.length > 0 ? backups.map((b) => b.backupPath) : undefined,
    });
  } catch (e) {
    if (!committed) {
      for (const b of backups) {
        try {
          if (existsSync(b.backupPath)) {
            const parentDir = dirname(b.sourcePath);
            mkdirSync(parentDir, { recursive: true });
            renameSync(b.backupPath, b.sourcePath);
          }
        } catch {
          // best-effort rollback
        }
      }

      try {
        rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }

    diagnostics.push({
      severity: 'error',
      message: `${action} failed: ${(e as Error).message}`,
      code: 'INSTALL-010',
    });
    return { ok: false, error: diagnostics };
  }
}

export function verifyInstalled(
  manifest: IntegrityManifest,
  baseDir: string,
): Result<VerifyCheck[], Diagnostic[]> {
  const checks: VerifyCheck[] = [];

  for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
    const fullPath = join(baseDir, relPath);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const actualHash = sha256(content);
      if (actualHash === expectedHash) {
        checks.push({
          filePath: fullPath,
          status: 'match',
          expectedChecksum: expectedHash,
          actualChecksum: actualHash,
        });
      } else {
        checks.push({
          filePath: fullPath,
          status: 'mismatch',
          expectedChecksum: expectedHash,
          actualChecksum: actualHash,
        });
      }
    } catch {
      checks.push({ filePath: fullPath, status: 'missing', expectedChecksum: expectedHash });
    }
  }

  return ok(checks);
}

export function repair(
  _adapter: Adapter,
  _context: ConversionContext,
  plan: ResolvedInstallPlan,
  checks: VerifyCheck[],
): Result<ExecutorResult, Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const stagingDir = mkdtempSync(join(tmpdir(), 'sb-inst-repair-'));

  try {
    const plannedFiles = readPlanOutput(plan);
    const manifestResult = generateManifest(plannedFiles);
    if (!manifestResult.ok) {
      diagnostics.push(manifestResult.error);
      return { ok: false, error: diagnostics };
    }
    const manifest = manifestResult.value;

    const damaged = checks.filter((c) => c.status !== 'match');

    if (damaged.length === 0) {
      return ok({ action: 'install', success: true, manifest });
    }

    for (const check of damaged) {
      if (check.status === 'missing' || check.status === 'mismatch') {
        const relPath = Object.entries(manifest.files).find(
          ([, hash]) => hash === check.expectedChecksum,
        )?.[0];
        if (relPath && plannedFiles[relPath]) {
          if (!validatePathInDir(relPath, '', 'repair relPath', diagnostics)) {
            continue;
          }
          if (!validatePathInDir(check.filePath, '', 'repair destination', diagnostics)) {
            continue;
          }
          const stagePath = join(stagingDir, relPath);
          mkdirSync(dirname(stagePath), { recursive: true });
          writeFileSync(stagePath, plannedFiles[relPath], 'utf-8');

          mkdirSync(dirname(check.filePath), { recursive: true });
          renameSync(stagePath, check.filePath);
        }
      }
    }

    rmSync(stagingDir, { recursive: true, force: true });

    return ok({ action: 'install', success: true, manifest });
  } catch (e) {
    diagnostics.push({
      severity: 'error',
      message: `repair failed: ${(e as Error).message}`,
      code: 'INSTALL-011',
    });
    return { ok: false, error: diagnostics };
  }
}
