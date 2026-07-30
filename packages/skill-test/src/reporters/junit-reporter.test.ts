import { describe, it, expect } from 'vitest';
import { generateJunitXml } from './junit-reporter.js';
import { JSON_DISCLAIMER } from './json-reporter.js';
import type { SuiteResult } from '@skillbridge/skill-test';

describe('generateJunitXml', () => {
  const result: SuiteResult = {
    suiteName: 'test-suite',
    total: 3,
    passed: 1,
    failed: 1,
    requiresReview: 1,
    tests: [
      { name: 'pass-test', status: 'pass', duration: 10, diagnostics: [], assertionResults: [] },
      {
        name: 'fail-test',
        status: 'fail',
        duration: 20,
        diagnostics: [{ severity: 'error', message: 'assertion failed', code: 'ERR-001' }],
        assertionResults: [],
      },
      {
        name: 'review-test',
        status: 'requiresReview',
        duration: 5,
        diagnostics: [],
        assertionResults: [],
      },
    ],
    diagnostics: [],
  };

  it('produces valid XML with testsuite root', () => {
    const xml = generateJunitXml(result);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<testsuite');
    expect(xml).toContain('</testsuite>');
  });

  it('includes disclaimer in properties', () => {
    const xml = generateJunitXml(result);
    expect(xml).toContain(JSON_DISCLAIMER);
  });

  it('includes testcase elements', () => {
    const xml = generateJunitXml(result);
    expect(xml).toContain('name="pass-test"');
    expect(xml).toContain('name="fail-test"');
    expect(xml).toContain('name="review-test"');
  });

  it('includes failure element for failed tests', () => {
    const xml = generateJunitXml(result);
    expect(xml).toContain('<failure');
    expect(xml).toContain('assertion failed');
  });

  it('includes skipped element for requiresReview tests', () => {
    const xml = generateJunitXml(result);
    expect(xml).toContain('<skipped');
    expect(xml).toContain('Requires human review');
  });
});
