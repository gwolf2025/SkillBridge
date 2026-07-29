import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSuite } from '../runner.js';
import { writeJsonReport } from '../reporters/json-reporter.js';
import { writeJunitXml } from '../reporters/junit-reporter.js';
import { JSON_DISCLAIMER } from '../reporters/json-reporter.js';
import type { SkillTestSuite } from '../index.js';

describe('runner end-to-end', () => {
  let tmpDir: string;
  let fixturePath: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-e2e-test-'));
    fixturePath = join(tmpDir, 'input.txt');
    writeFileSync(fixturePath, 'fixture content', 'utf-8');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs a full suite and produces JSON and JUnit output', () => {
    const suite: SkillTestSuite = {
      name: 'e2e-suite',
      tests: [
        {
          name: 'pass-test',
          input: { prompt: 'Hello', fixtures: [fixturePath] },
          assertions: [{ type: 'expectText', expected: 'processed prompt: Hello' }],
        },
        {
          name: 'review-test',
          assertions: [{ type: 'humanReview', reason: 'Manual check needed' }],
        },
      ],
    };

    const result = runSuite(suite);
    expect(result.suiteName).toBe('e2e-suite');
    expect(result.total).toBe(2);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.requiresReview).toBe(1);

    const jsonOut = join(tmpDir, 'report.json');
    const jsonStr = writeJsonReport(result, jsonOut);
    expect(existsSync(jsonOut)).toBe(true);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.disclaimer).toBe(JSON_DISCLAIMER);
    expect(parsed.tests).toHaveLength(2);

    const junitOut = join(tmpDir, 'report.xml');
    const xmlStr = writeJunitXml(result, junitOut);
    expect(existsSync(junitOut)).toBe(true);
    expect(xmlStr).toContain('<testsuite');
    expect(xmlStr).toContain('Requires human review');
  });

  it('reports failure for invalid test input', () => {
    const suite: SkillTestSuite = {
      name: 'invalid-suite',
      tests: [{ name: '', assertions: [{ type: 'expectText', expected: 'x' }] }],
    };

    const result = runSuite(suite);
    expect(result.total).toBe(1);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(1);
  });
});
