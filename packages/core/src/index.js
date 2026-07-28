export function ok(value) {
    return { ok: true, value };
}
export function fail(error) {
    return { ok: false, error };
}
export const CoreErrorCodes = {
    INTERNAL_ERROR: 'CORE-001',
    INVALID_ARGUMENT: 'CORE-002',
    NOT_FOUND: 'CORE-003',
    ALREADY_EXISTS: 'CORE-004',
    UNEXPECTED_STATE: 'CORE-005',
    NOT_IMPLEMENTED: 'CORE-006',
};
export class DiagnosticCollector {
    diagnostics = [];
    add(diagnostic) {
        this.diagnostics.push(diagnostic);
    }
    addAll(diagnostics) {
        for (const d of diagnostics) {
            this.diagnostics.push(d);
        }
    }
    hasErrors() {
        return this.diagnostics.some((d) => d.severity === 'error');
    }
    hasWarnings() {
        return this.diagnostics.some((d) => d.severity === 'warning');
    }
    toArray() {
        return this.diagnostics;
    }
    isEmpty() {
        return this.diagnostics.length === 0;
    }
    clear() {
        this.diagnostics = [];
    }
}
export class SkillBridgeError extends Error {
    code;
    diagnostics;
    constructor(code, message, diagnostics) {
        super(message);
        this.name = 'SkillBridgeError';
        this.code = code;
        this.diagnostics = diagnostics ?? [];
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            diagnostics: this.diagnostics,
        };
    }
}
export class ValidationError extends SkillBridgeError {
    fieldErrors;
    constructor(code, message, fieldErrors, diagnostics) {
        super(code, message, diagnostics);
        this.name = 'ValidationError';
        this.fieldErrors = fieldErrors ?? {};
    }
    toJSON() {
        return {
            ...super.toJSON(),
            fieldErrors: this.fieldErrors,
        };
    }
}
//# sourceMappingURL=index.js.map