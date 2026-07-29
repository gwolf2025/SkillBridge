import { describe, it, expect } from 'vitest';
import { validateSkillTest, validateSkillTestSuite } from './index.js';

const VALID_TEST = {
  name: 'basic-test',
  description: 'A valid test',
  input: { prompt: 'Hello', fixtures: ['file.txt'], args: ['--verbose'] },
  assertions: [
    { type: 'expectText', expected: 'Hello!', location: 'stdout' },
    { type: 'expectJson', expected: { status: 'ok' }, location: 'output' },
    { type: 'prohibitText', pattern: 'error', location: 'stdout' },
    { type: 'fileAssert', path: '/tmp/out.txt', exists: true, content: 'data', checksum: 'abc' },
    { type: 'toolCallAssert', tool: 'read', args: { path: '/tmp' }, count: 1, ordered: true },
    { type: 'permissionAssert', resource: 'fs:read', actions: ['read'], count: 2 },
    { type: 'jsonSchemaAssert', schema: { type: 'object' }, location: 'output' },
    { type: 'snapshot', name: 'snap-1', location: 'stdout' },
    {
      type: 'expectDiagnostics',
      diagnostics: [{ severity: 'info', message: 'ok', code: 'SKILL-001' }],
    },
  ],
  humanReview: { reason: 'Manual check needed', instructions: 'Review output' },
};

const VALID_CONVERSION = {
  ...VALID_TEST,
  assertions: [
    {
      type: 'conversionAssert',
      fromFormat: 'markdown',
      toFormat: 'json',
      assertions: [{ type: 'expectText', expected: 'converted' }],
    },
  ],
};

describe('validateSkillTest', () => {
  it('passes for a valid test definition', () => {
    const result = validateSkillTest(VALID_TEST);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('basic-test');
      expect(result.value.assertions).toHaveLength(9);
    }
  });

  it('rejects non-object input', () => {
    expect(validateSkillTest(null).ok).toBe(false);
    expect(validateSkillTest('string').ok).toBe(false);
    expect(validateSkillTest(42).ok).toBe(false);
    expect(validateSkillTest([1, 2]).ok).toBe(false);
  });

  it('rejects test without name', () => {
    const result = validateSkillTest({ assertions: [{ type: 'expectText', expected: 'x' }] });
    expect(result.ok).toBe(false);
  });

  it('rejects test with empty name', () => {
    const result = validateSkillTest({
      name: '',
      assertions: [{ type: 'expectText', expected: 'x' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects test without assertions', () => {
    const result = validateSkillTest({ name: 'test' });
    expect(result.ok).toBe(false);
  });

  it('rejects test with empty assertions', () => {
    const result = validateSkillTest({ name: 'test', assertions: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid assertion type', () => {
    const result = validateSkillTest({ name: 'test', assertions: [{ type: 'unknownType' }] });
    expect(result.ok).toBe(false);
  });

  it('rejects humanReview with empty reason', () => {
    const result = validateSkillTest({
      name: 'test',
      assertions: [{ type: 'expectText', expected: 'x' }],
      humanReview: { type: 'humanReview', reason: '' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects snapshot with empty name', () => {
    const result = validateSkillTest({
      name: 'test',
      assertions: [{ type: 'snapshot', name: '' }],
    });
    expect(result.ok).toBe(false);
  });

  it('validates conversion assertion with sub-assertions', () => {
    const result = validateSkillTest(VALID_CONVERSION);
    expect(result.ok).toBe(true);
  });

  it('rejects expectText with non-string expected', () => {
    const result = validateSkillTest({
      name: 'test',
      assertions: [{ type: 'expectText', expected: 123 }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects prohibitText with non-string pattern', () => {
    const result = validateSkillTest({
      name: 'test',
      assertions: [{ type: 'prohibitText', pattern: 42 }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects fileAssert with non-string path', () => {
    const result = validateSkillTest({
      name: 'test',
      assertions: [{ type: 'fileAssert', path: 42 }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects permissionAssert with non-array actions', () => {
    const result = validateSkillTest({
      name: 'test',
      assertions: [{ type: 'permissionAssert', resource: 'fs', actions: 'not-array' }],
    });
    expect(result.ok).toBe(false);
  });

  it('handles input with optional fields', () => {
    const result = validateSkillTest({
      name: 'minimal',
      assertions: [{ type: 'expectText', expected: 'x' }],
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateSkillTestSuite', () => {
  it('passes for a valid suite', () => {
    const result = validateSkillTestSuite({ name: 'Suite', tests: [VALID_TEST] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Suite');
      expect(result.value.tests).toHaveLength(1);
    }
  });

  it('rejects non-object', () => {
    expect(validateSkillTestSuite(null).ok).toBe(false);
  });

  it('rejects suite without name', () => {
    const result = validateSkillTestSuite({ tests: [VALID_TEST] });
    expect(result.ok).toBe(false);
  });

  it('rejects suite with zero tests', () => {
    const result = validateSkillTestSuite({ name: 'Suite', tests: [] });
    expect(result.ok).toBe(false);
  });
});
