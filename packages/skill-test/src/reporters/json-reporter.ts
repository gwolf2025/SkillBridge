import { writeFileSync } from 'node:fs';
import type { SuiteResult } from '../runner.js';

export const JSON_DISCLAIMER = 'Mock execution does not prove real-agent behavior';

export function generateJsonReport(result: SuiteResult): string {
  return JSON.stringify(
    {
      suiteName: result.suiteName,
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      requiresReview: result.requiresReview,
      disclaimer: JSON_DISCLAIMER,
      tests: result.tests.map((t) => ({
        name: t.name,
        status: t.status,
        duration: t.duration,
        diagnostics: t.diagnostics.length > 0 ? t.diagnostics : undefined,
      })),
    },
    null,
    2,
  );
}

export function writeJsonReport(result: SuiteResult, outputPath?: string): string {
  const json = generateJsonReport(result);
  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
  }
  return json;
}
