import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdapterRegistry,
  AdapterError,
  SkillBridgeError,
  adapterSupports,
  createConversionContext,
  type Adapter,
  type AdapterManifest,
} from './index.js';

const testManifest: AdapterManifest = {
  name: 'test-adapter',
  version: '1.0.0',
  vendor: 'test-vendor',
  adapterVersion: '0.1.0',
  supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
  capabilities: ['detect', 'parse', 'compile', 'install'],
};

const testAdapter: Adapter = {
  manifest: testManifest,
  detect: () => true,
  parse: (s: unknown) => s,
  compile: (n: unknown) => n,
  install: () => ({ ok: true, value: undefined }),
};

describe('AdapterManifest', () => {
  it('supports expanded manifest shape with new fields', () => {
    const manifest: AdapterManifest = {
      name: 'full-test',
      version: '0.1.0',
      vendor: 'test',
      adapterVersion: '0.1.0',
      supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
      capabilities: ['detect', 'parse', 'compile'],
      minAgentVersion: '1.0.0',
      homepage: 'https://example.com',
      description: 'A test adapter',
      extensions: { custom: true },
    };
    expect(manifest.name).toBe('full-test');
    expect(manifest.adapterVersion).toBe('0.1.0');
    expect(manifest.minAgentVersion).toBe('1.0.0');
    expect(manifest.extensions?.custom).toBe(true);
  });

  it('accepts old deprecated supportedSourceFormats/supportedTargetFormats (MEDIUM-001 regression)', () => {
    const manifest: AdapterManifest = {
      name: 'legacy-test',
      version: '1.0.0',
      vendor: 'legacy',
      adapterVersion: '0.1.0',
      supportedSourceFormats: ['markdown'],
      supportedTargetFormats: ['json'],
      supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
      capabilities: ['detect'],
    };
    expect(manifest.supportedSourceFormats).toEqual(['markdown']);
    expect(manifest.supportedTargetFormats).toEqual(['json']);
    expect(manifest.supports.sourceFormats).toEqual(['markdown']);
  });
});

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
    registry.clear();
  });

  it('registers and retrieves an adapter', () => {
    const result = registry.register(testAdapter);
    expect(result.ok).toBe(true);
    const retrieved = registry.get('test-adapter');
    expect(retrieved).toBeDefined();
    expect(retrieved?.manifest.name).toBe('test-adapter');
  });

  it('rejects duplicate registration', () => {
    registry.register(testAdapter);
    const result = registry.register(testAdapter);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('ADAPTER-006');
    }
  });

  it('returns undefined for unknown adapter', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('lists all registered manifests', () => {
    registry.register(testAdapter);
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('test-adapter');
  });

  it('finds by source format', () => {
    registry.register(testAdapter);
    const found = registry.findBySourceFormat('markdown');
    expect(found).toHaveLength(1);
    expect(found[0].manifest.name).toBe('test-adapter');
  });

  it('finds by target format', () => {
    registry.register(testAdapter);
    const found = registry.findByTargetFormat('json');
    expect(found).toHaveLength(1);
    expect(found[0].manifest.name).toBe('test-adapter');
  });

  it('clears all adapters', () => {
    registry.register(testAdapter);
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});

describe('AdapterError', () => {
  it('creates error with code and message', () => {
    const err = new AdapterError('ADAPTER-001', 'adapter not found');
    expect(err.code).toBe('ADAPTER-001');
    expect(err.message).toBe('adapter not found');
    expect(err.name).toBe('AdapterError');
  });

  it('extends SkillBridgeError (HIGH-001 regression)', () => {
    const err = new AdapterError('ADAPTER-001', 'test');
    expect(err).toBeInstanceOf(SkillBridgeError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has toJSON from SkillBridgeError', () => {
    const err = new AdapterError('ADAPTER-002', 'json test');
    const json = err.toJSON();
    expect(json.code).toBe('ADAPTER-002');
    expect(json.message).toBe('json test');
    expect(json.name).toBe('AdapterError');
  });
});

describe('adapterSupports', () => {
  it('returns true for declared capability', () => {
    expect(adapterSupports(testAdapter, 'detect')).toBe(true);
  });

  it('returns false for undeclared capability', () => {
    expect(adapterSupports(testAdapter, 'verify')).toBe(false);
  });
});

describe('createConversionContext', () => {
  it('creates context with source, normalized, manifest', () => {
    const ctx = createConversionContext('src', 'norm', testManifest);
    expect(ctx.source).toBe('src');
    expect(ctx.normalized).toBe('norm');
    expect(ctx.manifest.name).toBe('test-adapter');
  });

  it('includes optional fields when provided', () => {
    const ctx = createConversionContext('src', 'norm', testManifest, {
      extra: { debug: true },
    });
    expect(ctx.options?.debug).toBe(true);
  });
});

describe('singleton AdapterRegistry', () => {
  it('getInstance returns the same instance', () => {
    const a = AdapterRegistry.getInstance();
    const b = AdapterRegistry.getInstance();
    expect(a).toBe(b);
  });
});

describe('new error codes', () => {
  it('ADAPTER-007 is for ambiguous detection', () => {
    const err = new AdapterError('ADAPTER-007', 'ambiguous detection');
    expect(err.code).toBe('ADAPTER-007');
  });

  it('ADAPTER-008 is for no adapter found', () => {
    const err = new AdapterError('ADAPTER-008', 'no adapter found');
    expect(err.code).toBe('ADAPTER-008');
  });
});

describe('DetectionResult', () => {
  it('holds adapter, confidence, and optional diagnostics', () => {
    const result: import('./index.js').DetectionResult = {
      adapter: testAdapter,
      confidence: 0.8,
      diagnostics: [
        { severity: 'warning', message: 'low confidence', code: 'ADAPTER-002', source: 'test' },
      ],
    };
    expect(result.adapter.manifest.name).toBe('test-adapter');
    expect(result.confidence).toBe(0.8);
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe('AdapterSelector', () => {
  it('defines the expected method signatures', () => {
    const selector: import('./index.js').AdapterSelector = {
      selectSourceAdapter: () => ({ ok: true, value: testAdapter }),
      selectTargetAdapter: () => ({ ok: true, value: testAdapter }),
      findSourceAdapters: () => [{ adapter: testAdapter, confidence: 1 }],
      listAdapters: () => [testManifest],
    };
    expect(selector.listAdapters()).toHaveLength(1);
  });
});
