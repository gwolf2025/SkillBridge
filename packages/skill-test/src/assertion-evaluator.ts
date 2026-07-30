import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, normalize, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { Diagnostic } from '@skillbridge/core';
import type {
  Assertion,
  ExpectTextAssertion,
  ExpectJsonAssertion,
  ProhibitTextAssertion,
  FileAssertAssertion,
  ToolCallAssertion,
  PermissionAssertion,
  JsonSchemaAssertion,
  SnapshotAssertion,
  ExpectDiagnosticsAssertion,
  ConversionAssertion,
} from './index.js';
import type { MockOutput } from './mock-environment.js';

export type AssertionStatus = 'pass' | 'fail' | 'requiresReview';

export interface AssertionResult {
  assertion: Assertion;
  status: AssertionStatus;
  diagnostics: Diagnostic[];
}

function isInsideTempDir(targetPath: string, tempDir: string): boolean {
  const resolved = resolve(targetPath);
  const resolvedTemp = resolve(tempDir);
  const rel = relative(resolvedTemp, resolved);
  return !rel.startsWith('..') && !normalize(rel).startsWith(`..${sep}`);
}

export function evaluateAssertion(
  assertion: Assertion,
  output: MockOutput,
  tempDir: string,
): AssertionResult {
  switch (assertion.type) {
    case 'expectText':
      return evaluateExpectText(assertion, output);
    case 'expectJson':
      return evaluateExpectJson(assertion, output);
    case 'prohibitText':
      return evaluateProhibitText(assertion, output);
    case 'fileAssert':
      return evaluateFileAssert(assertion, tempDir);
    case 'toolCallAssert':
      return evaluateToolCall(assertion, output);
    case 'permissionAssert':
      return evaluatePermission(assertion, output);
    case 'jsonSchemaAssert':
      return evaluateJsonSchema(assertion, output);
    case 'snapshot':
      return evaluateSnapshot(assertion, output, tempDir);
    case 'expectDiagnostics':
      return evaluateExpectDiagnostics(assertion, output);
    case 'conversionAssert':
      return evaluateConversionAssert(assertion, output, tempDir);
    case 'humanReview':
      return {
        assertion,
        status: 'requiresReview',
        diagnostics: [
          {
            severity: 'info',
            message: `human review required: ${assertion.reason}`,
            code: 'SKILLTEST-006',
          },
        ],
      };
    default:
      return {
        assertion,
        status: 'fail',
        diagnostics: [
          { severity: 'error', message: `unknown assertion type`, code: 'SKILLTEST-002' },
        ],
      };
  }
}

function evaluateExpectText(a: ExpectTextAssertion, output: MockOutput): AssertionResult {
  const source = a.location === 'stderr' ? output.stderr : output.stdout;
  if (source.includes(a.expected)) {
    return { assertion: a, status: 'pass', diagnostics: [] };
  }
  return {
    assertion: a,
    status: 'fail',
    diagnostics: [
      {
        severity: 'error',
        message: `expected text '${a.expected}' not found in ${a.location ?? 'stdout'}`,
        code: 'SKILLTEST-007',
      },
    ],
  };
}

function evaluateExpectJson(a: ExpectJsonAssertion, output: MockOutput): AssertionResult {
  const source = a.location === 'stderr' ? output.stderr : output.stdout;
  try {
    const parsed = JSON.parse(source);
    if (JSON.stringify(parsed) === JSON.stringify(a.expected)) {
      return { assertion: a, status: 'pass', diagnostics: [] };
    }
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `JSON output does not match expected`,
          code: 'SKILLTEST-008',
        },
      ],
    };
  } catch {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        { severity: 'error', message: `output is not valid JSON`, code: 'SKILLTEST-009' },
      ],
    };
  }
}

function evaluateProhibitText(a: ProhibitTextAssertion, output: MockOutput): AssertionResult {
  const source = a.location === 'stderr' ? output.stderr : output.stdout;
  if (source.includes(a.pattern)) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `prohibited pattern '${a.pattern}' found in ${a.location ?? 'stdout'}`,
          code: 'SKILLTEST-010',
        },
      ],
    };
  }
  return { assertion: a, status: 'pass', diagnostics: [] };
}

function evaluateFileAssert(a: FileAssertAssertion, tempDir: string): AssertionResult {
  const resolvedPath = resolve(join(tempDir, a.path));
  if (!isInsideTempDir(resolvedPath, tempDir)) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `path '${a.path}' escapes the temp directory`,
          code: 'SKILLTEST-011',
        },
      ],
    };
  }

  const shouldExist = a.exists !== false;
  const fileExists = existsSync(resolvedPath);

  if (shouldExist && !fileExists) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        { severity: 'error', message: `file '${a.path}' does not exist`, code: 'SKILLTEST-012' },
      ],
    };
  }
  if (!shouldExist && fileExists) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `file '${a.path}' exists but should not`,
          code: 'SKILLTEST-013',
        },
      ],
    };
  }

  if (a.content !== undefined && fileExists) {
    const actual = readFileSync(resolvedPath, 'utf-8');
    if (actual !== a.content) {
      return {
        assertion: a,
        status: 'fail',
        diagnostics: [
          {
            severity: 'error',
            message: `file '${a.path}' content does not match`,
            code: 'SKILLTEST-014',
          },
        ],
      };
    }
  }

  if (a.checksum !== undefined && fileExists) {
    const actual = readFileSync(resolvedPath, 'utf-8');
    const hash = createHash('sha256').update(actual, 'utf-8').digest('hex');
    if (hash !== a.checksum) {
      return {
        assertion: a,
        status: 'fail',
        diagnostics: [
          {
            severity: 'error',
            message: `file '${a.path}' checksum does not match`,
            code: 'SKILLTEST-015',
          },
        ],
      };
    }
  }

  return { assertion: a, status: 'pass', diagnostics: [] };
}

function evaluateToolCall(a: ToolCallAssertion, output: MockOutput): AssertionResult {
  const matching = output.toolCalls.filter((tc) => tc.tool === a.tool);
  if (matching.length === 0) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        { severity: 'error', message: `tool '${a.tool}' was not called`, code: 'SKILLTEST-016' },
      ],
    };
  }
  if (a.count !== undefined && matching.length !== a.count) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `tool '${a.tool}' called ${matching.length} times, expected ${a.count}`,
          code: 'SKILLTEST-017',
        },
      ],
    };
  }
  if (a.args !== undefined) {
    const argsMatch = matching.some((tc) => JSON.stringify(tc.args) === JSON.stringify(a.args));
    if (!argsMatch) {
      return {
        assertion: a,
        status: 'fail',
        diagnostics: [
          {
            severity: 'error',
            message: `tool '${a.tool}' was not called with matching args`,
            code: 'SKILLTEST-018',
          },
        ],
      };
    }
  }
  return { assertion: a, status: 'pass', diagnostics: [] };
}

function evaluatePermission(a: PermissionAssertion, output: MockOutput): AssertionResult {
  const matching = output.permissionRequests.filter((pr) => pr.resource === a.resource);
  if (matching.length === 0) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `permission for '${a.resource}' was not requested`,
          code: 'SKILLTEST-019',
        },
      ],
    };
  }
  if (a.count !== undefined && matching.length !== a.count) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `permission '${a.resource}' requested ${matching.length} times, expected ${a.count}`,
          code: 'SKILLTEST-020',
        },
      ],
    };
  }
  const actionsMatch = matching.some(
    (pr) => JSON.stringify(pr.actions) === JSON.stringify(a.actions),
  );
  if (!actionsMatch) {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `permission '${a.resource}' not requested with actions ${JSON.stringify(a.actions)}`,
          code: 'SKILLTEST-021',
        },
      ],
    };
  }
  return { assertion: a, status: 'pass', diagnostics: [] };
}

function evaluateJsonSchema(a: JsonSchemaAssertion, output: MockOutput): AssertionResult {
  const source = a.location === 'stderr' ? output.stderr : output.stdout;
  try {
    const parsed = JSON.parse(source);
    const schema = a.schema;
    if (schema.type === 'object' && typeof parsed !== 'object') {
      return {
        assertion: a,
        status: 'fail',
        diagnostics: [
          {
            severity: 'error',
            message: `output is not an object, expected type 'object'`,
            code: 'SKILLTEST-022',
          },
        ],
      };
    }
    if (schema.type === 'string' && typeof parsed !== 'string') {
      return {
        assertion: a,
        status: 'fail',
        diagnostics: [
          {
            severity: 'error',
            message: `output is not a string, expected type 'string'`,
            code: 'SKILLTEST-022',
          },
        ],
      };
    }
    return { assertion: a, status: 'pass', diagnostics: [] };
  } catch {
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `output is not valid JSON for schema validation`,
          code: 'SKILLTEST-009',
        },
      ],
    };
  }
}

function evaluateSnapshot(
  a: SnapshotAssertion,
  output: MockOutput,
  tempDir: string,
): AssertionResult {
  const source = a.location === 'stderr' ? output.stderr : output.stdout;
  const snapshotPath = join(tempDir, `.snapshot-${a.name}`);
  if (existsSync(snapshotPath)) {
    const stored = readFileSync(snapshotPath, 'utf-8');
    if (stored === source) {
      return { assertion: a, status: 'pass', diagnostics: [] };
    }
    return {
      assertion: a,
      status: 'fail',
      diagnostics: [
        {
          severity: 'error',
          message: `snapshot '${a.name}' does not match stored value`,
          code: 'SKILLTEST-023',
        },
      ],
    };
  }
  return {
    assertion: a,
    status: 'fail',
    diagnostics: [
      {
        severity: 'error',
        message: `snapshot '${a.name}' not found — run with --update-snapshots`,
        code: 'SKILLTEST-024',
      },
    ],
  };
}

function evaluateExpectDiagnostics(
  a: ExpectDiagnosticsAssertion,
  output: MockOutput,
): AssertionResult {
  for (const expected of a.diagnostics) {
    const found = output.diagnostics.some((d) => {
      if (expected.severity && d.severity !== expected.severity) return false;
      if (expected.message && !d.message?.includes(expected.message)) return false;
      if (expected.code && d.code !== expected.code) return false;
      return true;
    });
    if (!found) {
      return {
        assertion: a,
        status: 'fail',
        diagnostics: [
          {
            severity: 'error',
            message: `expected diagnostic not found: ${JSON.stringify(expected)}`,
            code: 'SKILLTEST-025',
          },
        ],
      };
    }
  }
  return { assertion: a, status: 'pass', diagnostics: [] };
}

function evaluateConversionAssert(
  a: ConversionAssertion,
  output: MockOutput,
  tempDir: string,
): AssertionResult {
  const failures: Diagnostic[] = [];
  for (const sub of a.assertions) {
    const result = evaluateAssertion(sub, output, tempDir);
    if (result.status === 'fail') {
      failures.push(...result.diagnostics);
    }
  }
  if (failures.length > 0) {
    return { assertion: a, status: 'fail', diagnostics: failures };
  }
  return { assertion: a, status: 'pass', diagnostics: [] };
}
