import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateAssertion } from './assertion-evaluator.js';
import {
  createMockEnvironment,
  appendOutput,
  recordToolCall,
  recordPermissionRequest,
} from './mock-environment.js';

describe('evaluateAssertion', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-assert-test-'));
    writeFileSync(join(tmpDir, 'existing.txt'), 'hello world', 'utf-8');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('expectText', () => {
    it('passes when expected text is found in stdout', () => {
      const env = createMockEnvironment({});
      appendOutput(env, 'stdout', 'Hello, world!');
      const result = evaluateAssertion({ type: 'expectText', expected: 'Hello' }, env, tmpDir);
      expect(result.status).toBe('pass');
    });

    it('fails when expected text is not found', () => {
      const env = createMockEnvironment({});
      appendOutput(env, 'stdout', 'Goodbye');
      const result = evaluateAssertion({ type: 'expectText', expected: 'Hello' }, env, tmpDir);
      expect(result.status).toBe('fail');
    });
  });

  describe('expectJson', () => {
    it('passes when JSON output matches', () => {
      const env = createMockEnvironment({});
      appendOutput(env, 'stdout', '{"status":"ok"}');
      const result = evaluateAssertion(
        { type: 'expectJson', expected: { status: 'ok' } },
        env,
        tmpDir,
      );
      expect(result.status).toBe('pass');
    });

    it('fails when JSON output does not match', () => {
      const env = createMockEnvironment({});
      appendOutput(env, 'stdout', '{"status":"error"}');
      const result = evaluateAssertion(
        { type: 'expectJson', expected: { status: 'ok' } },
        env,
        tmpDir,
      );
      expect(result.status).toBe('fail');
    });
  });

  describe('prohibitText', () => {
    it('passes when prohibited text is absent', () => {
      const env = createMockEnvironment({});
      appendOutput(env, 'stdout', 'safe content');
      const result = evaluateAssertion({ type: 'prohibitText', pattern: 'danger' }, env, tmpDir);
      expect(result.status).toBe('pass');
    });

    it('fails when prohibited text is found', () => {
      const env = createMockEnvironment({});
      appendOutput(env, 'stdout', 'contains danger');
      const result = evaluateAssertion({ type: 'prohibitText', pattern: 'danger' }, env, tmpDir);
      expect(result.status).toBe('fail');
    });
  });

  describe('fileAssert', () => {
    it('passes for existing file', () => {
      const result = evaluateAssertion(
        { type: 'fileAssert', path: 'existing.txt' },
        createMockEnvironment({}),
        tmpDir,
      );
      expect(result.status).toBe('pass');
    });

    it('fails for non-existent file', () => {
      const result = evaluateAssertion(
        { type: 'fileAssert', path: 'nonexistent.txt' },
        createMockEnvironment({}),
        tmpDir,
      );
      expect(result.status).toBe('fail');
    });

    it('passes when file content matches', () => {
      const result = evaluateAssertion(
        { type: 'fileAssert', path: 'existing.txt', content: 'hello world' },
        createMockEnvironment({}),
        tmpDir,
      );
      expect(result.status).toBe('pass');
    });

    it('rejects path traversal', () => {
      const result = evaluateAssertion(
        { type: 'fileAssert', path: '../../etc/passwd' },
        createMockEnvironment({}),
        tmpDir,
      );
      expect(result.status).toBe('fail');
    });
  });

  describe('toolCallAssert', () => {
    it('passes when tool was called', () => {
      const env = createMockEnvironment({});
      recordToolCall(env, 'readFile', { path: '/tmp' });
      const result = evaluateAssertion({ type: 'toolCallAssert', tool: 'readFile' }, env, tmpDir);
      expect(result.status).toBe('pass');
    });

    it('fails when tool was not called', () => {
      const env = createMockEnvironment({});
      const result = evaluateAssertion({ type: 'toolCallAssert', tool: 'writeFile' }, env, tmpDir);
      expect(result.status).toBe('fail');
    });
  });

  describe('permissionAssert', () => {
    it('passes when permission was requested', () => {
      const env = createMockEnvironment({});
      recordPermissionRequest(env, 'fs:read', ['read']);
      const result = evaluateAssertion(
        { type: 'permissionAssert', resource: 'fs:read', actions: ['read'] },
        env,
        tmpDir,
      );
      expect(result.status).toBe('pass');
    });

    it('fails when permission was not requested', () => {
      const env = createMockEnvironment({});
      const result = evaluateAssertion(
        { type: 'permissionAssert', resource: 'fs:write', actions: ['write'] },
        env,
        tmpDir,
      );
      expect(result.status).toBe('fail');
    });
  });

  describe('humanReview', () => {
    it('returns requiresReview status', () => {
      const env = createMockEnvironment({});
      const result = evaluateAssertion(
        { type: 'humanReview', reason: 'needs manual check' },
        env,
        tmpDir,
      );
      expect(result.status).toBe('requiresReview');
    });
  });
});
