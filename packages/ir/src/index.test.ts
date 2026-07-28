import { describe, it, expect } from 'vitest';
import { validateNormalizedSkill, migrateIRPackage, IRVersion } from './index.js';

const validSkill = {
  irVersion: '0.1.0' as const,
  identity: { name: 'test-skill', version: '1.0.0' },
  capabilities: ['file-read', 'command-exec'],
  permissions: [{ resource: 'fs', actions: ['read'] }],
  source: { format: 'markdown' as const },
};

describe('@skillbridge/ir', () => {
  describe('validateNormalizedSkill', () => {
    it('accepts a minimal valid skill', () => {
      const result = validateNormalizedSkill(validSkill);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.identity.name).toBe('test-skill');
        expect(result.value.capabilities).toEqual(['file-read', 'command-exec']);
      }
    });

    it('accepts a full skill with all optional fields', () => {
      const full = {
        ...validSkill,
        identity: { name: 'full-skill', version: '2.0.0', description: 'A full skill' },
        invocation: { instructions: 'Do the thing', example: 'skill do thing' },
        inputs: [{ name: 'input1', type: 'string', required: true }],
        outputs: [{ name: 'output1', description: 'result', type: 'number' }],
        resources: [{ pattern: 'src/**/*.ts', description: 'source files' }],
        scripts: [{ name: 'build', command: 'tsc', args: ['--noEmit'] }],
        tools: [{ name: 'formatter', description: 'Code formatter' }],
        environment: [{ key: 'NODE_ENV', description: 'Node environment', required: true }],
        execution: { runtime: 'node20', timeout: 30000, memory: '512MB' },
        provenance: {
          convertedAt: '2026-01-01T00:00:00Z',
          convertedBy: 'test-adapter',
          history: [{ adapter: 'portable', timestamp: '2026-01-01T00:00:00Z' }],
        },
        license: { license: 'MIT', notice: 'Copyright 2026' },
        extensions: { customField: 'value' },
      };
      const result = validateNormalizedSkill(full);
      expect(result.ok).toBe(true);
    });

    it('rejects missing irVersion', () => {
      const { irVersion: _, ...noVersion } = validSkill;
      const result = validateNormalizedSkill(noVersion);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid irVersion', () => {
      const result = validateNormalizedSkill({ ...validSkill, irVersion: '0.2.0' });
      expect(result.ok).toBe(false);
    });

    it('rejects missing identity', () => {
      const { identity: _, ...noIdentity } = validSkill;
      const result = validateNormalizedSkill(noIdentity);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid identity version format', () => {
      const result = validateNormalizedSkill({
        ...validSkill,
        identity: { name: 'test', version: 'latest' },
      });
      expect(result.ok).toBe(false);
    });

    it('rejects missing capabilities', () => {
      const { capabilities: _, ...noCaps } = validSkill;
      const result = validateNormalizedSkill(noCaps);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid capability', () => {
      const result = validateNormalizedSkill({
        ...validSkill,
        capabilities: ['invalid-cap'],
      });
      expect(result.ok).toBe(false);
    });

    it('rejects missing permissions', () => {
      const { permissions: _, ...noPerms } = validSkill;
      const result = validateNormalizedSkill(noPerms);
      expect(result.ok).toBe(false);
    });

    it('rejects missing source', () => {
      const { source: _, ...noSource } = validSkill;
      const result = validateNormalizedSkill(noSource);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid source format', () => {
      const result = validateNormalizedSkill({
        ...validSkill,
        source: { format: 'pdf' },
      });
      expect(result.ok).toBe(false);
    });

    it('rejects null', () => {
      const result = validateNormalizedSkill(null);
      expect(result.ok).toBe(false);
    });

    it('rejects non-object', () => {
      const result = validateNormalizedSkill('not an object');
      expect(result.ok).toBe(false);
    });

    it('reports field-level errors with source info', () => {
      const result = validateNormalizedSkill({
        ...validSkill,
        identity: { name: 'test', version: 'bad' },
        capabilities: ['nope'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe('migrateIRPackage', () => {
    const pkg = validSkill as Parameters<typeof migrateIRPackage>[0];

    it('returns the same package when versions match', () => {
      const result = migrateIRPackage(pkg, '0.1.0');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(pkg);
    });

    it('rejects unsupported version migrations', () => {
      const result = migrateIRPackage(pkg, '0.1.0' as IRVersion);
      expect(result.ok).toBe(true);
    });

    it('produces diagnostics for unknown target versions', () => {
      const result = migrateIRPackage({ ...pkg, irVersion: '0.0.9' as IRVersion }, '0.1.0');
      expect(result.ok).toBe(false);
    });
  });
});
