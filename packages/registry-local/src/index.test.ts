import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAdapterRegistry } from './index.js';
import type { Adapter } from './index.js';

function makeAdapter(name: string, version: string, overrides?: Partial<Adapter>): Adapter {
  return {
    manifest: {
      name,
      version,
      vendor: 'test',
      adapterVersion: '0.1.0',
      supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
      capabilities: ['detect', 'parse', 'compile'],
    },
    detect: () => true,
    parse: (s: unknown) => s,
    compile: (n: unknown) => n,
    ...overrides,
  };
}

describe('LocalAdapterRegistry', () => {
  let registry: LocalAdapterRegistry;

  beforeEach(() => {
    registry = new LocalAdapterRegistry();
  });

  describe('register', () => {
    it('registers a new adapter', () => {
      const result = registry.register(makeAdapter('test-a', '1.0.0'));
      expect(result.ok).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('rejects duplicate name + version', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      const result = registry.register(makeAdapter('test-a', '1.0.0'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('ADAPTER-006');
      }
    });

    it('allows same name with different version', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      const result = registry.register(makeAdapter('test-a', '2.0.0'));
      expect(result.ok).toBe(true);
      expect(registry.count()).toBe(2);
    });
  });

  describe('get', () => {
    it('returns latest version when no version specified', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      registry.register(makeAdapter('test-a', '2.0.0'));
      const adapter = registry.get('test-a');
      expect(adapter?.manifest.version).toBe('2.0.0');
    });

    it('returns specific version when specified', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      registry.register(makeAdapter('test-a', '2.0.0'));
      const adapter = registry.get('test-a', '1.0.0');
      expect(adapter?.manifest.version).toBe('1.0.0');
    });

    it('returns undefined for unknown name', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('returns undefined for unknown version', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      expect(registry.get('test-a', '9.9.9')).toBeUndefined();
    });
  });

  describe('hasAdapter / remove', () => {
    it('hasAdapter returns true for registered adapter', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      expect(registry.hasAdapter('test-a')).toBe(true);
    });

    it('remove deletes specific version', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      registry.register(makeAdapter('test-a', '2.0.0'));
      expect(registry.remove('test-a', '1.0.0')).toBe(true);
      expect(registry.get('test-a', '1.0.0')).toBeUndefined();
      expect(registry.get('test-a')).toBeDefined();
    });

    it('remove deletes all versions when version unspecified', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      expect(registry.remove('test-a')).toBe(true);
      expect(registry.hasAdapter('test-a')).toBe(false);
    });
  });

  describe('findSourceAdapters', () => {
    it('returns adapters that support the given source format', () => {
      const md = makeAdapter('md', '1.0.0');
      const rst = makeAdapter('rst', '1.0.0', {
        manifest: {
          name: 'rst',
          version: '1.0.0',
          vendor: 'test',
          adapterVersion: '0.1.0',
          supports: { sourceFormats: ['rst'], targetFormats: ['html'] },
          capabilities: ['detect', 'parse', 'compile'],
        },
      });
      registry.register(md);
      registry.register(rst);
      const results = registry.findSourceAdapters('markdown');
      expect(results).toHaveLength(1);
      expect(results[0].adapter.manifest.name).toBe('md');
    });

    it('returns empty array when no adapters match', () => {
      expect(registry.findSourceAdapters('unknown')).toEqual([]);
    });
  });

  describe('detectAll', () => {
    it('filters by detect() result', () => {
      const accepts = makeAdapter('accept', '1.0.0');
      const rejects = makeAdapter('reject', '1.0.0', { detect: () => false });
      registry.register(accepts);
      registry.register(rejects);
      const results = registry.detectAll('some source', 'markdown');
      expect(results).toHaveLength(1);
      expect(results[0].adapter.manifest.name).toBe('accept');
    });

    it('handles adapter that throws during detect', () => {
      const throws = makeAdapter('throws', '1.0.0', {
        detect: () => {
          throw new Error('oops');
        },
      });
      registry.register(throws);
      const results = registry.detectAll('source', 'markdown');
      expect(results).toHaveLength(1);
      expect(results[0].confidence).toBe(0);
      expect(results[0].diagnostics).toBeDefined();
    });

    it('sorts results by confidence descending', () => {
      const low = makeAdapter('low', '1.0.0');
      const high = makeAdapter('high', '1.0.0');
      registry.register(low);
      registry.register(high);
      const results = registry.detectAll('source', 'markdown');
      expect(results).toHaveLength(2);
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    });
  });

  describe('selectSourceAdapter', () => {
    it('returns adapter for detected source', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      const result = registry.selectSourceAdapter('hello', 'markdown');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.manifest.name).toBe('test-a');
      }
    });

    it('returns ADAPTER-008 for null source', () => {
      const result = registry.selectSourceAdapter(null, 'markdown');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('ADAPTER-008');
      }
    });

    it('returns ADAPTER-008 for no matching adapters', () => {
      const result = registry.selectSourceAdapter('hello', 'unknown');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('ADAPTER-008');
      }
    });

    it('uses preferredName when provided', () => {
      registry.register(makeAdapter('a', '1.0.0'));
      registry.register(makeAdapter('b', '1.0.0'));
      const result = registry.selectSourceAdapter('src', 'markdown', 'a');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.manifest.name).toBe('a');
      }
    });

    it('returns ADAPTER-001 for unknown preferredName', () => {
      const result = registry.selectSourceAdapter('src', 'markdown', 'missing');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('ADAPTER-001');
      }
    });

    it('returns ADAPTER-007 for ambiguous detection', () => {
      const adapterA = makeAdapter('a', '1.0.0');
      const adapterB = makeAdapter('b', '1.0.0');
      registry = new LocalAdapterRegistry({ defaultConfidence: 0.8 });
      registry.register(adapterA);
      registry.register(adapterB);
      const result = registry.selectSourceAdapter('src', 'markdown');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('ADAPTER-007');
      }
    });
  });

  describe('selectTargetAdapter', () => {
    it('returns adapter for target format', () => {
      registry.register(makeAdapter('test-a', '1.0.0'));
      const result = registry.selectTargetAdapter('json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.manifest.name).toBe('test-a');
      }
    });

    it('returns ADAPTER-008 for no matching target format', () => {
      const result = registry.selectTargetAdapter('unknown');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error[0].code).toBe('ADAPTER-008');
      }
    });

    it('uses preferredName when provided', () => {
      registry.register(makeAdapter('a', '1.0.0'));
      const result = registry.selectTargetAdapter('json', 'a');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.manifest.name).toBe('a');
      }
    });
  });

  describe('listAdapters / clear / count', () => {
    it('listAdapters returns all manifests', () => {
      registry.register(makeAdapter('a', '1.0.0'));
      registry.register(makeAdapter('b', '1.0.0'));
      expect(registry.listAdapters()).toHaveLength(2);
    });

    it('clear removes all adapters', () => {
      registry.register(makeAdapter('a', '1.0.0'));
      registry.clear();
      expect(registry.count()).toBe(0);
    });
  });
});
