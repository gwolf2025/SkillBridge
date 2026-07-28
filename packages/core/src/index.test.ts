import { describe, it, expect } from 'vitest';
import {
  ok,
  fail,
  SkillBridgeError,
  DiagnosticCollector,
  ValidationError,
  SourceLocation,
  Diagnostic,
  CoreErrorCodes,
} from './index.js';

describe('@skillbridge/core', () => {
  describe('ok', () => {
    it('creates a success result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('infers never error type', () => {
      const result = ok('hello');
      expect(result.ok).toBe(true);
    });
  });

  describe('fail', () => {
    it('creates a failure result', () => {
      const error = new Error('test error');
      const result = fail(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('works with string errors', () => {
      const result = fail('something went wrong');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('something went wrong');
      }
    });
  });

  describe('SourceLocation', () => {
    it('accepts line and column', () => {
      const loc: SourceLocation = { line: 1, column: 5 };
      expect(loc.line).toBe(1);
      expect(loc.column).toBe(5);
    });

    it('accepts optional file', () => {
      const loc: SourceLocation = { line: 10, column: 3, file: 'SKILL.md' };
      expect(loc.file).toBe('SKILL.md');
    });
  });

  describe('DiagnosticCollector', () => {
    it('starts empty', () => {
      const collector = new DiagnosticCollector();
      expect(collector.isEmpty()).toBe(true);
      expect(collector.toArray()).toHaveLength(0);
    });

    it('adds a diagnostic', () => {
      const collector = new DiagnosticCollector();
      collector.add({ severity: 'error', message: 'test error' });
      expect(collector.isEmpty()).toBe(false);
      expect(collector.toArray()).toHaveLength(1);
      expect(collector.toArray()[0].message).toBe('test error');
    });

    it('addAll appends multiple diagnostics', () => {
      const collector = new DiagnosticCollector();
      collector.addAll([
        { severity: 'warning', message: 'warn 1' },
        { severity: 'warning', message: 'warn 2' },
      ]);
      expect(collector.toArray()).toHaveLength(2);
    });

    it('hasErrors returns true when errors exist', () => {
      const collector = new DiagnosticCollector();
      expect(collector.hasErrors()).toBe(false);
      collector.add({ severity: 'warning', message: 'warn' });
      expect(collector.hasErrors()).toBe(false);
      collector.add({ severity: 'error', message: 'err' });
      expect(collector.hasErrors()).toBe(true);
    });

    it('hasWarnings returns true when warnings exist', () => {
      const collector = new DiagnosticCollector();
      expect(collector.hasWarnings()).toBe(false);
      collector.add({ severity: 'error', message: 'err' });
      expect(collector.hasWarnings()).toBe(false);
      collector.add({ severity: 'warning', message: 'warn' });
      expect(collector.hasWarnings()).toBe(true);
    });

    it('clear removes all diagnostics', () => {
      const collector = new DiagnosticCollector();
      collector.add({ severity: 'error', message: 'err' });
      collector.add({ severity: 'info', message: 'info' });
      expect(collector.isEmpty()).toBe(false);
      collector.clear();
      expect(collector.isEmpty()).toBe(true);
      expect(collector.toArray()).toHaveLength(0);
    });

    it('returns a readonly snapshot from toArray', () => {
      const collector = new DiagnosticCollector();
      collector.add({ severity: 'debug', message: 'd' });
      const snapshot = collector.toArray();
      collector.clear();
      expect(snapshot).toHaveLength(1);
    });
  });

  describe('SkillBridgeError', () => {
    it('creates an error with code and message', () => {
      const err = new SkillBridgeError('TEST_ERR', 'Something went wrong');
      expect(err.code).toBe('TEST_ERR');
      expect(err.message).toBe('Something went wrong');
      expect(err.diagnostics).toEqual([]);
      expect(err.name).toBe('SkillBridgeError');
    });

    it('accepts diagnostics', () => {
      const diag: Diagnostic = { severity: 'error', message: 'detail' };
      const err = new SkillBridgeError('TEST', 'msg', [diag]);
      expect(err.diagnostics).toHaveLength(1);
      expect(err.diagnostics[0].message).toBe('detail');
    });

    it('toJSON returns a plain serializable object', () => {
      const diag: Diagnostic = { severity: 'warning', message: 'warn' };
      const err = new SkillBridgeError('CODE', 'msg', [diag]);
      const json = err.toJSON();
      expect(json).toEqual({
        name: 'SkillBridgeError',
        code: 'CODE',
        message: 'msg',
        diagnostics: [{ severity: 'warning', message: 'warn' }],
      });
    });

    it('toJSON round-trips through JSON.stringify', () => {
      const err = new SkillBridgeError('ROUNDTRIP', 'test', [
        { severity: 'error', message: 'diag' },
      ]);
      const roundtrip = JSON.parse(JSON.stringify(err));
      expect(roundtrip).toEqual({
        name: 'SkillBridgeError',
        code: 'ROUNDTRIP',
        message: 'test',
        diagnostics: [{ severity: 'error', message: 'diag' }],
      });
    });
  });

  describe('ValidationError', () => {
    it('extends SkillBridgeError', () => {
      const err = new ValidationError('VALID-001', 'validation failed');
      expect(err).toBeInstanceOf(SkillBridgeError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ValidationError');
      expect(err.code).toBe('VALID-001');
      expect(err.message).toBe('validation failed');
    });

    it('accepts field errors', () => {
      const err = new ValidationError('VALID-002', 'invalid', {
        name: ['must not be empty'],
        age: ['must be positive', 'must be a number'],
      });
      expect(err.fieldErrors.name).toEqual(['must not be empty']);
      expect(err.fieldErrors.age).toHaveLength(2);
    });

    it('defaults fieldErrors to empty object', () => {
      const err = new ValidationError('VALID-003', 'msg');
      expect(err.fieldErrors).toEqual({});
    });

    it('toJSON includes fieldErrors', () => {
      const err = new ValidationError('VALID-004', 'fail', { email: ['invalid format'] });
      const json = err.toJSON();
      expect(json).toHaveProperty('fieldErrors');
      expect(json.fieldErrors).toEqual({ email: ['invalid format'] });
    });

    it('toJSON round-trips through JSON.stringify', () => {
      const err = new ValidationError('VALID-005', 'fail', {
        field: ['error 1', 'error 2'],
      });
      const roundtrip = JSON.parse(JSON.stringify(err));
      expect(roundtrip.name).toBe('ValidationError');
      expect(roundtrip.code).toBe('VALID-005');
      expect(roundtrip.fieldErrors).toEqual({ field: ['error 1', 'error 2'] });
    });
  });

  describe('CoreErrorCodes', () => {
    it('has expected error codes', () => {
      expect(CoreErrorCodes.INTERNAL_ERROR).toBe('CORE-001');
      expect(CoreErrorCodes.INVALID_ARGUMENT).toBe('CORE-002');
      expect(CoreErrorCodes.NOT_FOUND).toBe('CORE-003');
      expect(CoreErrorCodes.ALREADY_EXISTS).toBe('CORE-004');
      expect(CoreErrorCodes.UNEXPECTED_STATE).toBe('CORE-005');
      expect(CoreErrorCodes.NOT_IMPLEMENTED).toBe('CORE-006');
    });

    it('all codes match ErrorCode type pattern', () => {
      for (const code of Object.values(CoreErrorCodes)) {
        expect(code).toMatch(/^CORE-\d{3}$/);
      }
    });
  });
});
