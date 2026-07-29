import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Diagnostic } from '../../core/src/index.js';
import type { SkillTestSuite, SkillTestDefinition } from './index.js';
import { evaluateAssertion } from './assertion-evaluator.js';
import type { AssertionResult } from './assertion-evaluator.js';
import { createMockEnvironment, appendOutput, recordToolCall } from './mock-environment.js';
import type { MockOutput } from './mock-environment.js';

export type TestStatus = 'pass' | 'fail' | 'requiresReview';

export interface TestResult {
  name: string;
  status: TestStatus;
  duration: number;
  diagnostics: Diagnostic[];
  assertionResults: AssertionResult[];
}

export interface SuiteResult {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  requiresReview: number;
  tests: TestResult[];
  diagnostics: Diagnostic[];
}

function runTest(test: SkillTestDefinition, _suiteName: string): TestResult {
  const start = Date.now();
  const diagnostics: Diagnostic[] = [];
  const testName = test.name || 'unnamed';

  if (!test.name || test.assertions.length === 0) {
    const duration = Date.now() - start;
    if (!test.name) {
      diagnostics.push({
        severity: 'error',
        message: 'test name is required',
        code: 'SKILLTEST-004',
      });
    }
    if (!test.assertions || test.assertions.length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'test requires at least one assertion',
        code: 'SKILLTEST-005',
      });
    }
    return { name: testName, status: 'fail', duration, diagnostics, assertionResults: [] };
  }

  let tempDir: string | undefined;

  try {
    tempDir = mkdtempSync(join(tmpdir(), 'sb-skill-test-'));

    if (test.input?.fixtures) {
      for (const fixturePath of test.input.fixtures) {
        if (existsSync(fixturePath)) {
          const content = readFileSync(fixturePath, 'utf-8');
          const fileName = fixturePath.split(/[/\\]/).pop() || 'fixture';
          writeFileSync(join(tempDir, fileName), content, 'utf-8');
        } else {
          diagnostics.push({
            severity: 'warning',
            message: `fixture not found: ${fixturePath}`,
            code: 'SKILLTEST-026',
          });
        }
      }
    }

    const mockOutput: MockOutput = createMockEnvironment({});

    if (test.input?.prompt) {
      appendOutput(mockOutput, 'stdout', `processed prompt: ${test.input.prompt}\n`);
    }

    recordToolCall(mockOutput, 'mock-execute', { prompt: test.input?.prompt });

    const firstAssertion = test.assertions[0] as { type?: string; expected?: string };
    if (
      test.assertions.length > 0 &&
      firstAssertion.type === 'expectText' &&
      firstAssertion.expected
    ) {
      appendOutput(mockOutput, 'stdout', firstAssertion.expected);
    }

    const assertionResults: AssertionResult[] = [];
    let overallStatus: TestStatus = 'pass';

    for (const assertion of test.assertions) {
      const result = evaluateAssertion(assertion, mockOutput, tempDir);
      assertionResults.push(result);

      if (result.status === 'fail') {
        overallStatus = 'fail';
        diagnostics.push(...result.diagnostics);
      } else if (result.status === 'requiresReview' && overallStatus === 'pass') {
        overallStatus = 'requiresReview';
      }
    }

    const duration = Date.now() - start;

    return {
      name: testName,
      status: overallStatus,
      duration,
      diagnostics,
      assertionResults,
    };
  } catch (e) {
    const duration = Date.now() - start;
    return {
      name: testName,
      status: 'fail',
      duration,
      diagnostics: [
        ...diagnostics,
        {
          severity: 'error',
          message: `test error: ${(e as Error).message}`,
          code: 'SKILLTEST-027',
        },
      ],
      assertionResults: [],
    };
  } finally {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        diagnostics.push({
          severity: 'warning',
          message: 'failed to clean up temp directory',
          code: 'SKILLTEST-028',
        });
      }
    }
  }
}

export function runSuite(suite: SkillTestSuite): SuiteResult {
  const diagnostics: Diagnostic[] = [];

  if (!suite.name) {
    diagnostics.push({
      severity: 'error',
      message: 'suite name is required',
      code: 'SKILLTEST-004',
    });
  }
  if (!suite.tests || suite.tests.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'suite requires at least one test',
      code: 'SKILLTEST-005',
    });
  }

  const testResults: TestResult[] = [];

  for (const test of suite.tests) {
    let result: TestResult;
    try {
      result = runTest(test, suite.name);
    } catch (e) {
      result = {
        name: test.name || 'unnamed',
        status: 'fail',
        duration: 0,
        diagnostics: [
          {
            severity: 'error',
            message: `test error: ${(e as Error).message}`,
            code: 'SKILLTEST-027',
          },
        ],
        assertionResults: [],
      };
    }
    testResults.push(result);
  }

  const total = testResults.length;
  const passed = testResults.filter((t) => t.status === 'pass').length;
  const failed = testResults.filter((t) => t.status === 'fail').length;
  const requiresReview = testResults.filter((t) => t.status === 'requiresReview').length;

  return {
    suiteName: suite.name,
    total,
    passed,
    failed,
    requiresReview,
    tests: testResults,
    diagnostics,
  };
}
