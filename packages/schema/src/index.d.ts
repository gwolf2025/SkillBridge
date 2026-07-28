import type { Result, Diagnostic } from '../../core/src/index.js';
export interface Schema<T> {
  validate(value: unknown): Result<T, Diagnostic[]>;
}
export declare function stringSchema(opts?: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}): Schema<string>;
export declare function numberSchema(opts?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): Schema<number>;
export declare function booleanSchema(): Schema<boolean>;
export declare function enumSchema<T extends string>(values: readonly T[]): Schema<T>;
export declare function arraySchema<T>(itemSchema: Schema<T>): Schema<T[]>;
export declare function objectSchema<T extends Record<string, Schema<unknown>>>(
  shape: T,
): Schema<{
  [K in keyof T]: T[K] extends Schema<infer U> ? U : never;
}>;
export declare function optionalSchema<T>(schema: Schema<T>): Schema<T | undefined>;
export declare function validate<T>(schema: Schema<T>, value: unknown): Result<T, Diagnostic[]>;
//# sourceMappingURL=index.d.ts.map
