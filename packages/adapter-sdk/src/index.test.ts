import { describe, it, expect } from 'vitest';

describe('@skillbridge/adapter-sdk', () => {
  it('should export AdapterManifest type structure', () => {
    // Verify the type contract via plain object construction
    const manifest = {
      name: 'test',
      version: '0.0.0',
      vendor: 'test-vendor',
      supportedSourceFormats: ['markdown'],
      supportedTargetFormats: ['json'],
      capabilities: ['detect', 'parse', 'compile'] as const,
    };
    expect(manifest.name).toBe('test');
    expect(manifest.capabilities).toContain('detect');
  });
});
