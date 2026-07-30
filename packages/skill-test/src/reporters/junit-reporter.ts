import { writeFileSync } from 'node:fs';
import type { SuiteResult, TestResult } from '@skillbridge/skill-test';
import { JSON_DISCLAIMER } from './json-reporter.js';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function testToXml(test: TestResult): string {
  const parts: string[] = [];
  const name = escapeXml(test.name);
  const time = (test.duration / 1000).toFixed(3);

  if (test.status === 'requiresReview') {
    parts.push(`  <testcase name="${name}" time="${time}">`);
    parts.push(`    <skipped message="Requires human review" />`);
    parts.push(`  </testcase>`);
  } else if (test.status === 'fail') {
    parts.push(`  <testcase name="${name}" time="${time}">`);
    for (const d of test.diagnostics) {
      const msg = escapeXml(d.message);
      parts.push(`    <failure message="${msg}" type="${escapeXml(d.code || 'error')}">`);
      parts.push(`      ${msg}`);
      parts.push(`    </failure>`);
    }
    parts.push(`  </testcase>`);
  } else {
    parts.push(`  <testcase name="${name}" time="${time}" />`);
  }

  return parts.join('\n');
}

export function generateJunitXml(result: SuiteResult): string {
  const total = result.total;
  const failures = result.failed;
  const skipped = result.requiresReview;
  const time = result.tests.reduce((sum, t) => sum + t.duration, 0) / 1000;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<testsuite name="${escapeXml(result.suiteName)}" tests="${total}" failures="${failures}" skipped="${skipped}" time="${time.toFixed(3)}">`,
  );
  lines.push(`  <properties>`);
  lines.push(`    <property name="disclaimer" value="${escapeXml(JSON_DISCLAIMER)}" />`);
  lines.push(`  </properties>`);

  for (const test of result.tests) {
    lines.push(testToXml(test));
  }

  lines.push(`</testsuite>`);
  return lines.join('\n');
}

export function writeJunitXml(result: SuiteResult, outputPath?: string): string {
  const xml = generateJunitXml(result);
  if (outputPath) {
    writeFileSync(outputPath, xml, 'utf-8');
  }
  return xml;
}
