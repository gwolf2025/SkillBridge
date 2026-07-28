export function stringSchema(opts) {
    return {
        validate(value) {
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
export function numberSchema(opts) {
    return {
        validate(value) {
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
export function booleanSchema() {
    return {
        validate(value) {
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
export function enumSchema(values) {
    return {
        validate(value) {
            if (!values.includes(value)) {
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
            return { ok: true, value: value };
        },
    };
}
export function arraySchema(itemSchema) {
    return {
        validate(value) {
            if (!Array.isArray(value)) {
                return {
                    ok: false,
                    error: [{ severity: 'error', message: 'expected an array', code: 'SCHEMA-011' }],
                };
            }
            const errors = [];
            const items = [];
            for (let i = 0; i < value.length; i++) {
                const result = itemSchema.validate(value[i]);
                if (!result.ok) {
                    errors.push(...result.error.map((d) => ({ ...d, message: `[${i}] ${d.message}` })));
                }
                else {
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
export function objectSchema(shape) {
    return {
        validate(value) {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                return {
                    ok: false,
                    error: [{ severity: 'error', message: 'expected a plain object', code: 'SCHEMA-012' }],
                };
            }
            const record = value;
            const errors = [];
            const result = {};
            for (const key of Object.keys(shape)) {
                const fieldResult = shape[key].validate(record[key]);
                if (!fieldResult.ok) {
                    errors.push(...fieldResult.error.map((d) => ({
                        ...d,
                        message: `${key}: ${d.message}`,
                        source: key,
                    })));
                }
                else {
                    result[key] = fieldResult.value;
                }
            }
            if (errors.length > 0) {
                return { ok: false, error: errors };
            }
            return {
                ok: true,
                value: result,
            };
        },
    };
}
export function optionalSchema(schema) {
    return {
        validate(value) {
            if (value === undefined || value === null) {
                return { ok: true, value: undefined };
            }
            return schema.validate(value);
        },
    };
}
export function validate(schema, value) {
    return schema.validate(value);
}
//# sourceMappingURL=index.js.map