import type {
  Adapter,
  ConversionContext,
  InstallPlan,
  InstallScope,
  OverwritePolicy,
  ConflictInfo,
  BackupEntry,
  Diagnostic,
} from '../../adapter-sdk/src/index.js';
import { ok } from '../../core/src/index.js';
import type { Result } from '../../core/src/index.js';
import { resolveProjectScope, resolveUserScope, resolveCustomScope, toPosixPath } from './paths.js';
import { inspect } from './inspector.js';
import { detect } from './conflict.js';
import { generate as generateManifest } from './manifest.js';
import type { IntegrityManifest } from './manifest.js';
import type { ResolvedInstallPlan } from './dryrun.js';

export interface PlannerOptions {
  scope?: InstallScope;
  customPath?: string;
  overwritePolicy?: OverwritePolicy;
  baseDir?: string;
  dryRun?: boolean;
}

export function plan(
  adapter: Adapter,
  context: ConversionContext,
  options?: PlannerOptions,
): Result<ResolvedInstallPlan, Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const adapterPlan: InstallPlan = adapter.installPlan
    ? adapter.installPlan(context)
    : { steps: [] };

  const scope: InstallScope = options?.scope ?? adapterPlan.scope ?? 'project';
  const overwritePolicy: OverwritePolicy =
    options?.overwritePolicy ?? adapterPlan.overwritePolicy ?? 'never';

  let destinationPaths: string[] = [];

  try {
    if (scope === 'project') {
      const baseDir = options?.baseDir ?? '.';
      destinationPaths = [toPosixPath(resolveProjectScope(baseDir))];
    } else if (scope === 'user') {
      destinationPaths = [toPosixPath(resolveUserScope())];
    } else if (scope === 'custom') {
      const customPath = options?.customPath ?? adapterPlan.customPath ?? '';
      if (!customPath) {
        diagnostics.push({
          severity: 'error',
          message: 'custom scope requires a customPath option',
          code: 'INSTALL-005',
        });
        return { ok: false, error: diagnostics };
      }
      const result = resolveCustomScope(customPath, options?.baseDir);
      if (!result.ok) {
        diagnostics.push(result.error);
        return { ok: false, error: diagnostics };
      }
      destinationPaths = [toPosixPath(result.value)];
    }
  } catch (e) {
    diagnostics.push({
      severity: 'error',
      message: `failed to resolve scope '${scope}': ${(e as Error).message}`,
      code: 'INSTALL-006',
    });
    return { ok: false, error: diagnostics };
  }

  const conflicts: ConflictInfo[] = [];
  let manifest: IntegrityManifest | undefined;

  const plannedFiles: Record<string, string> = {};
  for (const dp of destinationPaths) {
    plannedFiles[dp] = `planned-output-for-${dp}`;
  }

  const manifestResult = generateManifest(plannedFiles);
  if (!manifestResult.ok) {
    diagnostics.push(manifestResult.error);
  } else {
    manifest = manifestResult.value;
  }

  for (const dp of destinationPaths) {
    const stateResult = inspect(dp);
    if (!stateResult.ok) {
      diagnostics.push(stateResult.error);
      continue;
    }
    const state = stateResult.value;

    if (state.exists && state.isFile) {
      const conflictResult = detect(dp, plannedFiles[dp] ?? '');
      if (!conflictResult.ok) {
        diagnostics.push(conflictResult.error);
      } else if (conflictResult.value) {
        conflicts.push(conflictResult.value);
      }
    }
  }

  const backupPlan: BackupEntry[] = [];

  if (overwritePolicy === 'never' && conflicts.length > 0) {
    for (const c of conflicts) {
      diagnostics.push({
        severity: 'error',
        message: `overwrite policy 'never' blocks install: conflict at '${c.targetPath}'`,
        code: 'INSTALL-007',
      });
    }
    return { ok: false, error: diagnostics };
  }

  if (
    conflicts.length > 0 &&
    (overwritePolicy === 'always' ||
      overwritePolicy === 'if-newer' ||
      overwritePolicy === 'if-different')
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const c of conflicts) {
      if (overwritePolicy === 'if-newer' && c.existingModTime) {
        // Skip backup for if-newer (handled by caller)
      }
      backupPlan.push({
        sourcePath: c.targetPath,
        backupPath: `${c.targetPath}.backup.${timestamp}`,
        checksum: c.existingChecksum,
      });
    }
  }

  const result: ResolvedInstallPlan = {
    steps: adapterPlan.steps,
    estimatedDuration: adapterPlan.estimatedDuration,
    warnings: adapterPlan.warnings,
    requires: adapterPlan.requires,
    permissions: adapterPlan.permissions,
    scope,
    destinationPaths,
    overwritePolicy,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    backupPlan: backupPlan.length > 0 ? backupPlan : undefined,
    manifest,
    customPath: options?.customPath ?? adapterPlan.customPath,
  };

  return ok(result);
}
