export type Result<T, E = Error> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };
export declare function ok<T>(value: T): Result<T, never>;
export declare function fail<E>(error: E): Result<never, E>;
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
export declare const CoreErrorCodes: {
  readonly INTERNAL_ERROR: 'CORE-001';
  readonly INVALID_ARGUMENT: 'CORE-002';
  readonly NOT_FOUND: 'CORE-003';
  readonly ALREADY_EXISTS: 'CORE-004';
  readonly UNEXPECTED_STATE: 'CORE-005';
  readonly NOT_IMPLEMENTED: 'CORE-006';
};
export declare class DiagnosticCollector {
  private diagnostics;
  add(diagnostic: Diagnostic): void;
  addAll(diagnostics: Diagnostic[]): void;
  hasErrors(): boolean;
  hasWarnings(): boolean;
  toArray(): readonly Diagnostic[];
  isEmpty(): boolean;
  clear(): void;
}
export declare class SkillBridgeError extends Error {
  readonly code: string;
  readonly diagnostics: Diagnostic[];
  constructor(code: string, message: string, diagnostics?: Diagnostic[]);
  toJSON(): Record<string, unknown>;
}
export declare class ValidationError extends SkillBridgeError {
  readonly fieldErrors: Record<string, string[]>;
  constructor(
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
    diagnostics?: Diagnostic[],
  );
  toJSON(): Record<string, unknown>;
}
//# sourceMappingURL=index.d.ts.map
