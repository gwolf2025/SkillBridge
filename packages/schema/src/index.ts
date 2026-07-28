import type { Result, Diagnostic } from '../../core/src/index.js';

export interface Schema<T> {
  validate(value: unknown): Result<T, Diagnostic[]>;
}

export function stringSchema(opts?: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}): Schema<string> {
  return {
    validate(value: unknown): Result<string, Diagnostic[]> {
      if (typeof value !== 'string') {
        return {
          ok: false,
          error: [{ severity: 'error', message: 'expected a string', code: 'SCHEMA-001' }],
        };
      }
      if (opts?.minLength !== undefined && value.length < opts.minLength) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `must be at least ${opts.minLength} characters`,
              code: 'SCHEMA-002',
            },
          ],
        };
      }
      if (opts?.maxLength !== undefined && value.length > opts.maxLength) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `must be at most ${opts.maxLength} characters`,
              code: 'SCHEMA-003',
            },
          ],
        };
      }
      if (opts?.pattern !== undefined && !opts.pattern.test(value)) {
        return {
          ok: false,
          error: [
            { severity: 'error', message: 'does not match required pattern', code: 'SCHEMA-004' },
          ],
        };
      }
      return { ok: true, value };
    },
  };
}

export function numberSchema(opts?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): Schema<number> {
  return {
    validate(value: unknown): Result<number, Diagnostic[]> {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return {
          ok: false,
          error: [{ severity: 'error', message: 'expected a number', code: 'SCHEMA-005' }],
        };
      }
      if (opts?.integer && !Number.isInteger(value)) {
        return {
          ok: false,
          error: [{ severity: 'error', message: 'must be an integer', code: 'SCHEMA-006' }],
        };
      }
      if (opts?.min !== undefined && value < opts.min) {
        return {
          ok: false,
          error: [
            { severity: 'error', message: `must be at least ${opts.min}`, code: 'SCHEMA-007' },
          ],
        };
      }
      if (opts?.max !== undefined && value > opts.max) {
        return {
          ok: false,
          error: [
            { severity: 'error', message: `must be at most ${opts.max}`, code: 'SCHEMA-008' },
          ],
        };
      }
      return { ok: true, value };
    },
  };
}

export function booleanSchema(): Schema<boolean> {
  return {
    validate(value: unknown): Result<boolean, Diagnostic[]> {
      if (typeof value !== 'boolean') {
        return {
          ok: false,
          error: [{ severity: 'error', message: 'expected a boolean', code: 'SCHEMA-009' }],
        };
      }
      return { ok: true, value };
    },
  };
}

export function enumSchema<T extends string>(values: readonly T[]): Schema<T> {
  return {
    validate(value: unknown): Result<T, Diagnostic[]> {
      if (!values.includes(value as T)) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `expected one of: ${values.join(', ')}`,
              code: 'SCHEMA-010',
            },
          ],
        };
      }
      return { ok: true, value: value as T };
    },
  };
}

export function arraySchema<T>(itemSchema: Schema<T>): Schema<T[]> {
  return {
    validate(value: unknown): Result<T[], Diagnostic[]> {
      if (!Array.isArray(value)) {
        return {
          ok: false,
          error: [{ severity: 'error', message: 'expected an array', code: 'SCHEMA-011' }],
        };
      }
      const errors: Diagnostic[] = [];
      const items: T[] = [];
      for (let i = 0; i < value.length; i++) {
        const result = itemSchema.validate(value[i]);
        if (!result.ok) {
          errors.push(...result.error.map((d) => ({ ...d, message: `[${i}] ${d.message}` })));
        } else {
          items.push(result.value);
        }
      }
      if (errors.length > 0) {
        return { ok: false, error: errors };
      }
      return { ok: true, value: items };
    },
  };
}

export function objectSchema<T extends Record<string, Schema<unknown>>>(
  shape: T,
): Schema<{ [K in keyof T]: T[K] extends Schema<infer U> ? U : never }> {
  return {
    validate(
      value: unknown,
    ): Result<{ [K in keyof T]: T[K] extends Schema<infer U> ? U : never }, Diagnostic[]> {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {
          ok: false,
          error: [{ severity: 'error', message: 'expected a plain object', code: 'SCHEMA-012' }],
        };
      }
      const record = value as Record<string, unknown>;
      const errors: Diagnostic[] = [];
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        const fieldResult = shape[key].validate(record[key]);
        if (!fieldResult.ok) {
          errors.push(
            ...fieldResult.error.map((d) => ({
              ...d,
              message: `${key}: ${d.message}`,
              source: key,
            })),
          );
        } else {
          result[key] = fieldResult.value;
        }
      }
      if (errors.length > 0) {
        return { ok: false, error: errors };
      }
      return {
        ok: true,
        value: result as { [K in keyof T]: T[K] extends Schema<infer U> ? U : never },
      };
    },
  };
}

export function optionalSchema<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    validate(value: unknown): Result<T | undefined, Diagnostic[]> {
      if (value === undefined || value === null) {
        return { ok: true, value: undefined };
      }
      return schema.validate(value);
    },
  };
}

export function validate<T>(schema: Schema<T>, value: unknown): Result<T, Diagnostic[]> {
  return schema.validate(value);
}
