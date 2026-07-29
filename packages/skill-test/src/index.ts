import type { Result, Diagnostic } from '../../core/src/index.js';
import { ok, fail } from '../../core/src/index.js';
import {
  stringSchema,
  arraySchema,
  enumSchema,
  objectSchema,
  optionalSchema,
  validate,
} from '../../schema/src/index.js';
import type { Schema } from '../../schema/src/index.js';

// ── Input Types ──────────────────────────────────────────────

export interface TestInput {
  fixtures?: string[];
  prompt?: string;
  args?: string[];
}

// ── Assertion Types ──────────────────────────────────────────

export interface ExpectTextAssertion {
  type: 'expectText';
  expected: string;
  location?: string;
}

export interface ExpectJsonAssertion {
  type: 'expectJson';
  expected: unknown;
  location?: string;
}

export interface ProhibitTextAssertion {
  type: 'prohibitText';
  pattern: string;
  location?: string;
}

export interface FileAssertAssertion {
  type: 'fileAssert';
  path: string;
  exists?: boolean;
  content?: string;
  checksum?: string;
}

export interface ToolCallAssertion {
  type: 'toolCallAssert';
  tool: string;
  args?: unknown;
  count?: number;
  ordered?: boolean;
}

export interface PermissionAssertion {
  type: 'permissionAssert';
  resource: string;
  actions: string[];
  count?: number;
}

export interface JsonSchemaAssertion {
  type: 'jsonSchemaAssert';
  schema: Record<string, unknown>;
  location?: string;
}

export interface SnapshotAssertion {
  type: 'snapshot';
  name: string;
  location?: string;
}

export interface ExpectedDiagnostic {
  severity?: string;
  message?: string;
  code?: string;
}

export interface ExpectDiagnosticsAssertion {
  type: 'expectDiagnostics';
  diagnostics: ExpectedDiagnostic[];
}

export interface ConversionAssertion {
  type: 'conversionAssert';
  fromFormat: string;
  toFormat: string;
  assertions: Assertion[];
}

export interface HumanReviewAssertion {
  type: 'humanReview';
  reason: string;
  instructions?: string;
}

export type Assertion =
  | ExpectTextAssertion
  | ExpectJsonAssertion
  | ProhibitTextAssertion
  | FileAssertAssertion
  | ToolCallAssertion
  | PermissionAssertion
  | JsonSchemaAssertion
  | SnapshotAssertion
  | ExpectDiagnosticsAssertion
  | ConversionAssertion
  | HumanReviewAssertion;

// ── Definition Types ─────────────────────────────────────────

export interface SkillTestDefinition {
  name: string;
  description?: string;
  input?: TestInput;
  assertions: Assertion[];
  conversionAssertions?: ConversionAssertion[];
  humanReview?: HumanReviewAssertion;
}

export interface SkillTestSuite {
  name: string;
  description?: string;
  tests: SkillTestDefinition[];
}

// ── Schema Helpers ───────────────────────────────────────────

const testInputSchema = objectSchema({
  fixtures: optionalSchema(arraySchema(stringSchema())),
  prompt: optionalSchema(stringSchema()),
  args: optionalSchema(arraySchema(stringSchema())),
});

const expectedDiagnosticSchema = objectSchema({
  severity: optionalSchema(stringSchema()),
  message: optionalSchema(stringSchema()),
  code: optionalSchema(stringSchema()),
});

const assertionTypeSchema = enumSchema([
  'expectText',
  'expectJson',
  'prohibitText',
  'fileAssert',
  'toolCallAssert',
  'permissionAssert',
  'jsonSchemaAssert',
  'snapshot',
  'expectDiagnostics',
  'conversionAssert',
  'humanReview',
] as const);

function assertionSchema(): Schema<Assertion> {
  return {
    validate(value: unknown): Result<Assertion, Diagnostic[]> {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return fail([
          { severity: 'error', message: 'assertion must be an object', code: 'SKILLTEST-001' },
        ]);
      }
      const record = value as Record<string, unknown>;
      const typeResult = assertionTypeSchema.validate(record.type);
      if (!typeResult.ok) {
        return fail([
          {
            severity: 'error',
            message: `invalid assertion type: ${JSON.stringify(record.type)}`,
            code: 'SKILLTEST-002',
          },
        ]);
      }

      const type = typeResult.value;

      switch (type) {
        case 'expectText': {
          if (typeof record.expected !== 'string') {
            return fail([
              {
                severity: 'error',
                message: 'expectText requires a string expected field',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          return ok({
            type,
            expected: record.expected,
            location: record.location as string | undefined,
          } as ExpectTextAssertion);
        }
        case 'expectJson':
          return ok({
            type,
            expected: record.expected,
            location: record.location as string | undefined,
          } as ExpectJsonAssertion);
        case 'prohibitText': {
          if (typeof record.pattern !== 'string') {
            return fail([
              {
                severity: 'error',
                message: 'prohibitText requires a string pattern field',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          return ok({
            type,
            pattern: record.pattern,
            location: record.location as string | undefined,
          } as ProhibitTextAssertion);
        }
        case 'fileAssert': {
          if (typeof record.path !== 'string') {
            return fail([
              {
                severity: 'error',
                message: 'fileAssert requires a string path field',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          return ok({
            type,
            path: record.path,
            exists: record.exists as boolean | undefined,
            content: record.content as string | undefined,
            checksum: record.checksum as string | undefined,
          } as FileAssertAssertion);
        }
        case 'toolCallAssert': {
          if (typeof record.tool !== 'string') {
            return fail([
              {
                severity: 'error',
                message: 'toolCallAssert requires a string tool field',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          return ok({
            type,
            tool: record.tool,
            args: record.args,
            count: record.count as number | undefined,
            ordered: record.ordered as boolean | undefined,
          } as ToolCallAssertion);
        }
        case 'permissionAssert': {
          if (typeof record.resource !== 'string' || !Array.isArray(record.actions)) {
            return fail([
              {
                severity: 'error',
                message: 'permissionAssert requires string resource and array actions',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          return ok({
            type,
            resource: record.resource,
            actions: record.actions as string[],
            count: record.count as number | undefined,
          } as PermissionAssertion);
        }
        case 'jsonSchemaAssert': {
          if (typeof record.schema !== 'object' || record.schema === null) {
            return fail([
              {
                severity: 'error',
                message: 'jsonSchemaAssert requires an object schema field',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          return ok({
            type,
            schema: record.schema as Record<string, unknown>,
            location: record.location as string | undefined,
          } as JsonSchemaAssertion);
        }
        case 'snapshot': {
          if (typeof record.name !== 'string' || record.name === '') {
            return fail([
              {
                severity: 'error',
                message: 'snapshot requires a non-empty name field',
                code: 'SKILLTEST-004',
              },
            ]);
          }
          return ok({
            type,
            name: record.name,
            location: record.location as string | undefined,
          } as SnapshotAssertion);
        }
        case 'expectDiagnostics': {
          if (!Array.isArray(record.diagnostics)) {
            return fail([
              {
                severity: 'error',
                message: 'expectDiagnostics requires a diagnostics array',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          const diagResult = validate(arraySchema(expectedDiagnosticSchema), record.diagnostics);
          if (!diagResult.ok) return fail(diagResult.error);
          return ok({ type, diagnostics: diagResult.value } as ExpectDiagnosticsAssertion);
        }
        case 'conversionAssert': {
          if (typeof record.fromFormat !== 'string' || typeof record.toFormat !== 'string') {
            return fail([
              {
                severity: 'error',
                message: 'conversionAssert requires fromFormat and toFormat strings',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          if (!Array.isArray(record.assertions)) {
            return fail([
              {
                severity: 'error',
                message: 'conversionAssert requires an assertions array',
                code: 'SKILLTEST-003',
              },
            ]);
          }
          const subResult = validate(arraySchema(assertionSchema()), record.assertions);
          if (!subResult.ok) return fail(subResult.error);
          return ok({
            type,
            fromFormat: record.fromFormat,
            toFormat: record.toFormat,
            assertions: subResult.value,
          } as ConversionAssertion);
        }
        case 'humanReview': {
          if (typeof record.reason !== 'string' || record.reason === '') {
            return fail([
              {
                severity: 'error',
                message: 'humanReview requires a non-empty reason field',
                code: 'SKILLTEST-004',
              },
            ]);
          }
          return ok({
            type,
            reason: record.reason,
            instructions: record.instructions as string | undefined,
          } as HumanReviewAssertion);
        }
        default:
          return fail([
            {
              severity: 'error',
              message: `unknown assertion type: ${type}`,
              code: 'SKILLTEST-002',
            },
          ]);
      }
    },
  };
}

// ── Validation ───────────────────────────────────────────────

export function validateSkillTest(value: unknown): Result<SkillTestDefinition, Diagnostic[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail([
      { severity: 'error', message: 'skill test must be an object', code: 'SKILLTEST-001' },
    ]);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.name !== 'string' || record.name === '') {
    return fail([
      { severity: 'error', message: 'skill test requires a non-empty name', code: 'SKILLTEST-004' },
    ]);
  }

  if (!Array.isArray(record.assertions) || record.assertions.length === 0) {
    return fail([
      {
        severity: 'error',
        message: 'skill test requires at least one assertion',
        code: 'SKILLTEST-005',
      },
    ]);
  }

  const diagnostics: Diagnostic[] = [];

  let input: TestInput | undefined;
  if (record.input !== undefined) {
    const inputResult = validate(testInputSchema, record.input);
    if (!inputResult.ok) {
      diagnostics.push(...inputResult.error);
    } else {
      input = inputResult.value;
    }
  }

  const assertions: Assertion[] = [];
  const assertionSchemaObj = assertionSchema();
  for (let i = 0; i < record.assertions.length; i++) {
    const result = assertionSchemaObj.validate(record.assertions[i]);
    if (!result.ok) {
      diagnostics.push(...result.error);
    } else {
      assertions.push(result.value);
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  const result: SkillTestDefinition = {
    name: record.name as string,
    description: record.description as string | undefined,
    input,
    assertions,
  };

  if (record.conversionAssertions !== undefined) {
    const caSchema = assertionSchema();
    const caResult = validate(arraySchema(caSchema), record.conversionAssertions);
    if (caResult.ok) {
      result.conversionAssertions = caResult.value as ConversionAssertion[];
    } else {
      diagnostics.push(...caResult.error);
    }
  }

  if (record.humanReview !== undefined) {
    if (typeof record.humanReview !== 'object' || record.humanReview === null) {
      diagnostics.push({
        severity: 'error',
        message: 'humanReview must be an object',
        code: 'SKILLTEST-001',
      });
    } else {
      const hr = record.humanReview as Record<string, unknown>;
      if (typeof hr.reason !== 'string' || hr.reason === '') {
        diagnostics.push({
          severity: 'error',
          message: 'humanReview requires a non-empty reason field',
          code: 'SKILLTEST-004',
        });
      } else {
        result.humanReview = {
          type: 'humanReview',
          reason: hr.reason as string,
          instructions: hr.instructions as string | undefined,
        };
      }
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return ok(result);
}

export function validateSkillTestSuite(value: unknown): Result<SkillTestSuite, Diagnostic[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail([
      { severity: 'error', message: 'test suite must be an object', code: 'SKILLTEST-001' },
    ]);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.name !== 'string' || record.name === '') {
    return fail([
      { severity: 'error', message: 'test suite requires a non-empty name', code: 'SKILLTEST-004' },
    ]);
  }

  if (!Array.isArray(record.tests) || record.tests.length === 0) {
    return fail([
      {
        severity: 'error',
        message: 'test suite requires at least one test',
        code: 'SKILLTEST-005',
      },
    ]);
  }

  const tests: SkillTestDefinition[] = [];
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < record.tests.length; i++) {
    const testResult = validateSkillTest(record.tests[i]);
    if (!testResult.ok) {
      diagnostics.push(...testResult.error);
    } else {
      tests.push(testResult.value);
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return ok({
    name: record.name as string,
    description: record.description as string | undefined,
    tests,
  });
}
