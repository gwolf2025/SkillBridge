import { describe, it, expect } from 'vitest';
import type { OutputManifest } from './manifest.js';
import { generateReport } from './report.js';

function makeTestManifest(): OutputManifest {
  return {
    files: ['a.txt', 'b.txt'],
    checksums: {
      'a.txt': 'abc123',
      'b.txt': 'def456',
    },
    metadata: {},
    compiledAt: '2026-01-01T00:00:00.000Z',
    compiledBy: 'test',
    source: 'test-source',
  };
}

describe('generateReport', () => {
  it('contains all fields', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, [], [], 'start', 'end');

    expect(report).toHaveProperty('manifest');
    expect(report).toHaveProperty('fileCount');
    expect(report).toHaveProperty('totalBytes');
    expect(report).toHaveProperty('warnings');
    expect(report).toHaveProperty('errors');
    expect(report).toHaveProperty('startedAt');
    expect(report).toHaveProperty('completedAt');
    expect(report).toHaveProperty('reproducible');
  });

  it('reflects reproducible=true when no errors or warnings', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, [], [], 'start', 'end');
    expect(report.reproducible).toBe(true);
  });

  it('reflects reproducible=false when errors present', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, [], ['error1'], 'start', 'end');
    expect(report.reproducible).toBe(false);
  });

  it('reflects reproducible=true when warnings present but no errors', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, ['warn1'], [], 'start', 'end');
    expect(report.reproducible).toBe(true);
  });

  it('sets fileCount from manifest files length', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, [], [], 'start', 'end');
    expect(report.fileCount).toBe(2);
  });

  it('preserves startedAt and completedAt', () => {
    const manifest = makeTestManifest();
    const report = generateReport(
      manifest,
      [],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T01:00:00.000Z',
    );
    expect(report.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(report.completedAt).toBe('2026-01-01T01:00:00.000Z');
  });

  it('preserves warnings and errors arrays', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, ['w1'], ['e1', 'e2'], 'start', 'end');
    expect(report.warnings).toEqual(['w1']);
    expect(report.errors).toEqual(['e1', 'e2']);
  });

  it('accepts optional totalBytes parameter', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, [], [], 'start', 'end', 1024);
    expect(report.totalBytes).toBe(1024);
  });

  it('defaults totalBytes to 0 when not provided', () => {
    const manifest = makeTestManifest();
    const report = generateReport(manifest, [], [], 'start', 'end');
    expect(report.totalBytes).toBe(0);
  });
});
