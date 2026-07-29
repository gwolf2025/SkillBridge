import type { OutputManifest } from './manifest.js';

export interface CompilationReport {
  manifest: OutputManifest;
  fileCount: number;
  totalBytes: number;
  warnings: string[];
  errors: string[];
  startedAt: string;
  completedAt: string;
  reproducible: boolean;
}

export function generateReport(
  manifest: OutputManifest,
  warnings: string[],
  errors: string[],
  startedAt: string,
  completedAt: string,
  totalBytes?: number,
): CompilationReport {
  return {
    manifest,
    fileCount: manifest.files.length,
    totalBytes: totalBytes ?? 0,
    warnings,
    errors,
    startedAt,
    completedAt,
    reproducible: errors.length === 0,
  };
}
