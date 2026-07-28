import { describe, it, expect } from 'vitest';
import {
  stringSchema,
  numberSchema,
  booleanSchema,
  enumSchema,
  arraySchema,
  objectSchema,
  optionalSchema,
  validate,
} from './index.js';

describe('@skillbridge/schema', () => {
  describe('stringSchema', () => {
    const schema = stringSchema();

    it('accepts strings', () => {
      const result = validate(schema, 'hello');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('hello');
    });

    it('rejects non-strings', () => {
      const result = validate(schema, 42);
      expect(result.ok).toBe(false);
    });

    it('enforces minLength', () => {
      const s = stringSchema({ minLength: 3 });
      expect(validate(s, 'ab').ok).toBe(false);
      expect(validate(s, 'abc').ok).toBe(true);
    });

    it('enforces maxLength', () => {
      const s = stringSchema({ maxLength: 3 });
      expect(validate(s, 'abcd').ok).toBe(false);
      expect(validate(s, 'abc').ok).toBe(true);
    });

    it('enforces pattern', () => {
      const s = stringSchema({ pattern: /^[a-z]+$/ });
      expect(validate(s, 'ABC').ok).toBe(false);
      expect(validate(s, 'abc').ok).toBe(true);
    });
  });

  describe('numberSchema', () => {
    const schema = numberSchema();

    it('accepts numbers', () => {
      const result = validate(schema, 42);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });

    it('rejects NaN', () => {
      expect(validate(schema, NaN).ok).toBe(false);
    });

    it('rejects non-numbers', () => {
      expect(validate(schema, '42').ok).toBe(false);
    });

    it('enforces integer', () => {
      const s = numberSchema({ integer: true });
      expect(validate(s, 3.14).ok).toBe(false);
      expect(validate(s, 3).ok).toBe(true);
    });

    it('enforces min/max', () => {
      const s = numberSchema({ min: 0, max: 100 });
      expect(validate(s, -1).ok).toBe(false);
      expect(validate(s, 50).ok).toBe(true);
      expect(validate(s, 101).ok).toBe(false);
    });
  });

  describe('booleanSchema', () => {
    it('accepts booleans', () => {
      expect(validate(booleanSchema(), true).ok).toBe(true);
      expect(validate(booleanSchema(), false).ok).toBe(true);
    });

    it('rejects non-booleans', () => {
      expect(validate(booleanSchema(), 0).ok).toBe(false);
      expect(validate(booleanSchema(), 'true').ok).toBe(false);
    });
  });

  describe('enumSchema', () => {
    const schema = enumSchema(['red', 'green', 'blue'] as const);

    it('accepts valid enum values', () => {
      const result = validate(schema, 'red');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('red');
    });

    it('rejects invalid enum values', () => {
      expect(validate(schema, 'yellow').ok).toBe(false);
    });
  });

  describe('arraySchema', () => {
    const schema = arraySchema(stringSchema());

    it('accepts arrays of strings', () => {
      const result = validate(schema, ['a', 'b']);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(['a', 'b']);
    });

    it('rejects non-arrays', () => {
      expect(validate(schema, 'not array').ok).toBe(false);
    });

    it('reports per-item errors', () => {
      const result = validate(schema, ['a', 42, 'c']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBe(1);
        expect(result.error[0].message).toContain('[1]');
      }
    });
  });

  describe('objectSchema', () => {
    const schema = objectSchema({
      name: stringSchema(),
      age: numberSchema({ integer: true, min: 0 }),
    });

    it('accepts valid objects', () => {
      const result = validate(schema, { name: 'Alice', age: 30 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Alice');
        expect(result.value.age).toBe(30);
      }
    });

    it('rejects non-objects', () => {
      expect(validate(schema, 'not object').ok).toBe(false);
    });

    it('reports field-level errors', () => {
      const result = validate(schema, { name: 'Alice', age: -1 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.some((d) => d.message.includes('age'))).toBe(true);
      }
    });

    it('rejects null', () => {
      expect(validate(schema, null).ok).toBe(false);
    });

    it('rejects arrays', () => {
      expect(validate(schema, []).ok).toBe(false);
    });

    it('validates partial objects', () => {
      const result = validate(schema, { name: 'Bob' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.some((d) => d.message.includes('age'))).toBe(true);
      }
    });
  });

  describe('optionalSchema', () => {
    const schema = optionalSchema(stringSchema());

    it('accepts undefined', () => {
      const result = validate(schema, undefined);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeUndefined();
    });

    it('accepts null as undefined', () => {
      const result = validate(schema, null);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeUndefined();
    });

    it('validates present values', () => {
      const result = validate(schema, 'hello');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('hello');
    });

    it('rejects invalid present values', () => {
      expect(validate(schema, 42).ok).toBe(false);
    });
  });
});
