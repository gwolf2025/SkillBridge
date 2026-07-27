import { describe, it, expect } from 'vitest';
import { ok, fail, SkillBridgeError } from './index.js';

describe('@skillbridge/core', () => {
  describe('ok', () => {
    it('should create a success result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('fail', () => {
    it('should create a failure result', () => {
      const error = new Error('test error');
      const result = fail(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('SkillBridgeError', () => {
    it('should create an error with code and message', () => {
      const err = new SkillBridgeError('TEST_ERR', 'Something went wrong');
      expect(err.code).toBe('TEST_ERR');
      expect(err.message).toBe('Something went wrong');
      expect(err.diagnostics).toEqual([]);
    });

    it('should accept diagnostics', () => {
      const diag = { severity: 'error' as const, message: 'detail' };
      const err = new SkillBridgeError('TEST', 'msg', [diag]);
      expect(err.diagnostics).toHaveLength(1);
      expect(err.diagnostics[0].message).toBe('detail');
    });
  });
});
