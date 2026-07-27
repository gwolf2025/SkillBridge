/**
 * @skillbridge/core
 *
 * Shared domain primitives, diagnostics, result types, and common errors.
 * No vendor-specific logic lives here.
 */

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type Severity = 'error' | 'warning' | 'info' | 'debug';

export interface Diagnostic {
  severity: Severity;
  message: string;
  code?: string;
  source?: string;
  location?: { line: number; column: number };
}

export class SkillBridgeError extends Error {
  public readonly code: string;
  public readonly diagnostics: Diagnostic[];

  constructor(code: string, message: string, diagnostics?: Diagnostic[]) {
    super(message);
    this.name = 'SkillBridgeError';
    this.code = code;
    this.diagnostics = diagnostics ?? [];
  }
}
