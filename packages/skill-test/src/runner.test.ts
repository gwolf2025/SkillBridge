import { describe, it, expect } from 'vitest';
import { runSuite } from './runner.js';
import type { SkillTestSuite } from './index.js';

describe('runSuite', () => {
  it('returns failure for invalid suite (no name)', () => {
    const suite = { tests: [] } as unknown as SkillTestSuite;
    const result = runSuite(suite);
    expect(result.total).toBe(0);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('returns pass for a simple valid test', () => {
    const suite: SkillTestSuite = {
      name: 'simple',
      tests: [
        {
          name: 'test-1',
          assertions: [{ type: 'expectText', expected: 'processed prompt' }],
        },
      ],
    };
    const result = runSuite(suite);
    expect(result.suiteName).toBe('simple');
    expect(result.total).toBe(1);
    expect(result.passed).toBe(1);
  });

  it('counts requiresReview separately from pass/fail', () => {
    const suite: SkillTestSuite = {
      name: 'review-test',
      tests: [
        {
          name: 'needs-review',
          assertions: [{ type: 'humanReview', reason: 'verify manually' }],
        },
      ],
    };
    const result = runSuite(suite);
    expect(result.total).toBe(1);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.requiresReview).toBe(1);
  });
});
