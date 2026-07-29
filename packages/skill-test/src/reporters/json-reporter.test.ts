import { describe, it, expect } from 'vitest';
import { generateJsonReport, JSON_DISCLAIMER } from './json-reporter.js';
import type { SuiteResult } from '../runner.js';

describe('generateJsonReport', () => {
  const result: SuiteResult = {
    suiteName: 'test-suite',
    total: 2,
    passed: 1,
    failed: 1,
    requiresReview: 0,
    tests: [
      { name: 'pass-test', status: 'pass', duration: 10, diagnostics: [], assertionResults: [] },
      {
        name: 'fail-test',
        status: 'fail',
        duration: 20,
        diagnostics: [{ severity: 'error', message: 'fail', code: 'ERR' }],
        assertionResults: [],
      },
    ],
    diagnostics: [],
  };

  it('includes disclaimer field', () => {
    const json = JSON.parse(generateJsonReport(result));
    expect(json.disclaimer).toBe(JSON_DISCLAIMER);
  });

  it('includes suite name and counts', () => {
    const json = JSON.parse(generateJsonReport(result));
    expect(json.suiteName).toBe('test-suite');
    expect(json.total).toBe(2);
    expect(json.passed).toBe(1);
    expect(json.failed).toBe(1);
  });

  it('includes test details with diagnostics', () => {
    const json = JSON.parse(generateJsonReport(result));
    expect(json.tests).toHaveLength(2);
    expect(json.tests[0].status).toBe('pass');
    expect(json.tests[1].status).toBe('fail');
    expect(json.tests[1].diagnostics).toBeDefined();
  });

  it('omits diagnostics when empty', () => {
    const json = JSON.parse(generateJsonReport(result));
    expect(json.tests[0].diagnostics).toBeUndefined();
  });
});
