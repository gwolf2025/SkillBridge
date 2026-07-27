import { describe, it, expect } from 'vitest';

describe('@skillbridge/ir', () => {
  it('should define IR package structure', () => {
    const pkg = {
      irVersion: '0.1.0' as const,
      source: { format: 'markdown' as const },
      name: 'test-skill',
      version: '1.0.0',
      capabilities: ['file-read'],
      permissions: [],
      provenance: {},
    };
    expect(pkg.irVersion).toBe('0.1.0');
    expect(pkg.name).toBe('test-skill');
  });
});
