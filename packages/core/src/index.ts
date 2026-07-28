export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type Severity = 'error' | 'warning' | 'info' | 'debug';

export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

export interface Diagnostic {
  severity: Severity;
  message: string;
  code?: string;
  source?: string;
  location?: SourceLocation;
}

export type ErrorCode = `CORE-${number}`;

export const CoreErrorCodes = {
  INTERNAL_ERROR: 'CORE-001',
  INVALID_ARGUMENT: 'CORE-002',
  NOT_FOUND: 'CORE-003',
  ALREADY_EXISTS: 'CORE-004',
  UNEXPECTED_STATE: 'CORE-005',
  NOT_IMPLEMENTED: 'CORE-006',
} as const satisfies Record<string, ErrorCode>;

export class DiagnosticCollector {
  private diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  addAll(diagnostics: Diagnostic[]): void {
    for (const d of diagnostics) {
      this.diagnostics.push(d);
    }
  }

  hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === 'error');
  }

  hasWarnings(): boolean {
    return this.diagnostics.some((d) => d.severity === 'warning');
  }

  toArray(): readonly Diagnostic[] {
    return this.diagnostics;
  }

  isEmpty(): boolean {
    return this.diagnostics.length === 0;
  }

  clear(): void {
    this.diagnostics = [];
  }
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

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      diagnostics: this.diagnostics,
    };
  }
}

export class ValidationError extends SkillBridgeError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
    diagnostics?: Diagnostic[],
  ) {
    super(code, message, diagnostics);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors ?? {};
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      fieldErrors: this.fieldErrors,
    };
  }
}
