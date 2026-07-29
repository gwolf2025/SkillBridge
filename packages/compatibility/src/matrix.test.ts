import { describe, it, expect } from 'vitest';
import { CompatibilityMatrix } from './matrix.js';
import type { CompatibilityReport } from './index.js';

function makeReport(overall: CompatibilityReport['overall']): CompatibilityReport {
  return {
    comparisons: [{ capability: 'file-read', required: true, level: overall }],
    overall,
    nativeCount: overall === 'native' ? 1 : 0,
    emulatedCount: overall === 'emulated' ? 1 : 0,
    missingCount: overall === 'missing' ? 1 : 0,
    degradedCount: overall === 'degraded' ? 1 : 0,
    partialCount: overall === 'partial' ? 1 : 0,
    unknownCount: overall === 'unknown' ? 1 : 0,
    semanticDegradations: [],
    missingResources: [],
    assumptions: [],
  };
}

describe('CompatibilityMatrix', () => {
  const matrix = new CompatibilityMatrix();

  it('formatJson produces valid JSON with rows, columns, and results', () => {
    const results = new Map<string, CompatibilityReport>();
    results.set('adapter-a->adapter-b', makeReport('native'));
    results.set('adapter-b->adapter-a', makeReport('emulated'));

    const json = matrix.formatJson(results);
    const parsed = JSON.parse(json);
    expect(parsed.matrix).toBeDefined();
    expect(parsed.matrix.rows).toContain('adapter-a');
    expect(parsed.matrix.columns).toContain('adapter-b');
    expect(parsed.matrix.results['adapter-a->adapter-b']).toBeDefined();
    expect(parsed.matrix.results['adapter-a->adapter-b'].overall).toBe('native');
  });

  it('formatMarkdown produces a table with headers and rows', () => {
    const results = new Map<string, CompatibilityReport>();
    results.set('src->tgt', makeReport('native'));

    const md = matrix.formatMarkdown(results);
    expect(md).toContain('| Source \\ Target');
    expect(md).toContain('tgt');
    expect(md).toContain('native');
    expect(md).toContain('---');
  });

  it('formatJson handles empty results', () => {
    const results = new Map<string, CompatibilityReport>();
    const json = matrix.formatJson(results);
    const parsed = JSON.parse(json);
    expect(parsed.matrix.rows).toEqual([]);
    expect(parsed.matrix.columns).toEqual([]);
    expect(parsed.matrix.results).toEqual({});
  });

  it('formatMarkdown handles empty results', () => {
    const results = new Map<string, CompatibilityReport>();
    const md = matrix.formatMarkdown(results);
    expect(md).toBeTruthy();
    expect(md).toContain('Source \\ Target');
  });
});
