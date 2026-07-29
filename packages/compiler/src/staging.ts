import { mkdtemp, mkdir, rm, rename, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import type { Result, Diagnostic } from '../../core/src/index.js';
import { ok, fail } from '../../core/src/index.js';
import { validateOutputPath } from './safety.js';
import { normalizeLineEndings } from './deterministic.js';

const MAX_STAGING_FILES = 10000;
const MAX_STAGING_BYTES = 500 * 1024 * 1024;

export interface StagingOptions {
  outputDir: string;
  prefix?: string;
  keepOnFailure?: boolean;
  dryRun?: boolean;
}

export class AtomicOutputWriter {
  private readonly outputDir: string;
  private readonly prefix: string;
  private readonly keepOnFailure: boolean;
  private readonly dryRun: boolean;
  private stagingDir: string | null = null;
  private prepared = false;
  private committed = false;
  private rolledBack = false;
  private fileCount = 0;
  private totalBytes = 0;

  constructor(options: StagingOptions) {
    this.outputDir = resolve(options.outputDir);
    this.prefix = options.prefix ?? '.skillbridge-staging-';
    this.keepOnFailure = options.keepOnFailure ?? false;
    this.dryRun = options.dryRun ?? false;
  }

  get isPrepared(): boolean {
    return this.prepared;
  }

  get isCommitted(): boolean {
    return this.committed;
  }

  get isRolledBack(): boolean {
    return this.rolledBack;
  }

  async prepare(): Promise<Result<string, Diagnostic>> {
    if (this.dryRun) {
      this.prepared = true;
      this.stagingDir = join(tmpdir(), `${this.prefix}dry-run`);
      return ok(this.stagingDir);
    }

    try {
      this.stagingDir = await mkdtemp(join(tmpdir(), this.prefix));
      this.prepared = true;
      return ok(this.stagingDir);
    } catch (err) {
      return fail({
        severity: 'error',
        message: `Failed to create staging directory: ${(err as Error).message}`,
        code: 'COMPILER-003',
        source: 'compiler',
      });
    }
  }

  async writeFile(relativePath: string, content: string): Promise<Result<void, Diagnostic>> {
    if (!this.prepared || !this.stagingDir) {
      return fail({
        severity: 'error',
        message: 'Staging directory not prepared — call prepare() first',
        code: 'COMPILER-012',
        source: 'compiler',
      });
    }

    if (this.committed) {
      return fail({
        severity: 'error',
        message: 'Already committed — cannot write after commit',
        code: 'COMPILER-012',
        source: 'compiler',
      });
    }

    if (this.rolledBack) {
      return fail({
        severity: 'error',
        message: 'Already rolled back — cannot write after rollback',
        code: 'COMPILER-012',
        source: 'compiler',
      });
    }

    const stagedPath = join(this.stagingDir, relativePath);

    const pathResult = validateOutputPath(stagedPath, this.stagingDir);
    if (!pathResult.ok) {
      return pathResult;
    }

    if (this.fileCount >= MAX_STAGING_FILES) {
      return fail({
        severity: 'error',
        message: `staging file count limit (${MAX_STAGING_FILES}) exceeded`,
        code: 'COMPILER-013',
        source: 'compiler',
      });
    }

    this.totalBytes += Buffer.byteLength(content, 'utf-8');
    if (this.totalBytes > MAX_STAGING_BYTES) {
      return fail({
        severity: 'error',
        message: `staging total size limit (${MAX_STAGING_BYTES} bytes) exceeded`,
        code: 'COMPILER-013',
        source: 'compiler',
      });
    }

    if (this.dryRun) {
      this.fileCount++;
      return ok(undefined);
    }

    try {
      await mkdir(dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, normalizeLineEndings(content), 'utf-8');
      this.fileCount++;
      return ok(undefined);
    } catch (err) {
      return fail({
        severity: 'error',
        message: `Failed to stage file ${relativePath}: ${(err as Error).message}`,
        code: 'COMPILER-004',
        source: 'compiler',
      });
    }
  }

  async commit(): Promise<Result<void, Diagnostic>> {
    if (!this.prepared || !this.stagingDir) {
      return fail({
        severity: 'error',
        message: 'Staging directory not prepared — call prepare() first',
        code: 'COMPILER-012',
        source: 'compiler',
      });
    }

    if (this.committed) {
      return ok(undefined);
    }

    if (this.rolledBack) {
      return fail({
        severity: 'error',
        message: 'Already rolled back — cannot commit',
        code: 'COMPILER-012',
        source: 'compiler',
      });
    }

    if (this.dryRun) {
      this.committed = true;
      return ok(undefined);
    }

    // Rename staging to a temp name first, then remove the old output, then rename into place.
    // This reduces the TOCTOU window compared to rm-then-rename.
    const tempName = `${this.outputDir}.tmp-${Date.now()}`;
    try {
      await rename(this.stagingDir, tempName);
    } catch (err) {
      return fail({
        severity: 'error',
        message: `Failed to stage rename: ${(err as Error).message}`,
        code: 'COMPILER-005',
        source: 'compiler',
      });
    }

    try {
      await rm(this.outputDir, { recursive: true, force: true });
    } catch {
      await rename(tempName, this.stagingDir);
      return fail({
        severity: 'error',
        message: `Failed to remove existing output directory: ${this.outputDir}`,
        code: 'COMPILER-005',
        source: 'compiler',
      });
    }

    try {
      await rename(tempName, this.outputDir);
      this.committed = true;
      return ok(undefined);
    } catch (err) {
      await rename(tempName, this.stagingDir);
      return fail({
        severity: 'error',
        message: `Failed to commit staging to ${this.outputDir}: ${(err as Error).message}`,
        code: 'COMPILER-005',
        source: 'compiler',
      });
    }
  }

  async rollback(): Promise<Result<void, Diagnostic>> {
    if (!this.prepared || !this.stagingDir) {
      return ok(undefined);
    }

    if (this.committed) {
      return fail({
        severity: 'error',
        message: 'Already committed — cannot rollback',
        code: 'COMPILER-006',
        source: 'compiler',
      });
    }

    if (this.rolledBack) {
      return ok(undefined);
    }

    if (this.dryRun || this.keepOnFailure) {
      this.rolledBack = true;
      return ok(undefined);
    }

    try {
      await rm(this.stagingDir, { recursive: true, force: true });
      this.rolledBack = true;
      this.prepared = false;
      return ok(undefined);
    } catch (err) {
      return fail({
        severity: 'error',
        message: `Failed to remove staging directory: ${(err as Error).message}`,
        code: 'COMPILER-006',
        source: 'compiler',
      });
    }
  }
}
