import { describe, it, expect } from 'vitest';
import { ConversionPipeline } from '../pipeline.js';
import type { AdapterSelector, Adapter, NormalizedSkill } from '../../../adapter-sdk/src/index.js';

function makeSelector(overrides?: Partial<AdapterSelector>): AdapterSelector {
  const adapter: Adapter = {
    manifest: {
      name: 'test-adapter',
      version: '1.0.0',
      vendor: 'test',
      adapterVersion: '0.1.0',
      supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
      capabilities: ['detect', 'parse', 'compile'],
    },
    detect: () => true,
    parse: (s: unknown) => s,
    compile: (n: unknown) => n,
  };

  return {
    selectSourceAdapter: () => ({ ok: true, value: adapter }),
    selectTargetAdapter: () => ({ ok: true, value: adapter }),
    findSourceAdapters: () => [{ adapter, confidence: 1 }],
    listAdapters: () => [adapter.manifest],
    ...overrides,
  };
}

describe('ConversionPipeline', () => {
  it('rejects null source via selector', () => {
    const selector = makeSelector({
      selectSourceAdapter: () => ({
        ok: false,
        error: [
          {
            severity: 'error',
            message: 'no adapter found: source is null',
            code: 'ADAPTER-008',
            source: 'registry',
          },
        ],
      }),
    });
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run(null, 'markdown', 'json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('ADAPTER-008');
    }
  });

  it('rejects unknown source format via selector', () => {
    const selector = makeSelector({
      selectSourceAdapter: () => ({
        ok: false,
        error: [
          {
            severity: 'error',
            message: 'no adapter found for source format',
            code: 'ADAPTER-008',
            source: 'registry',
          },
        ],
      }),
    });
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run('src', 'unknown', 'json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('ADAPTER-008');
    }
  });

  it('rejects unknown target format via selector', () => {
    const selector = makeSelector({
      selectTargetAdapter: () => ({
        ok: false,
        error: [
          {
            severity: 'error',
            message: 'no adapter found for target format',
            code: 'ADAPTER-008',
            source: 'registry',
          },
        ],
      }),
    });
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run('src', 'markdown', 'unknown');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('ADAPTER-008');
    }
  });

  it('runs parse + compile and returns ConversionResult', () => {
    const pipeline = new ConversionPipeline(makeSelector());
    const result = pipeline.run('# Hello', 'markdown', 'json');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.output).toBe('# Hello');
      expect(result.value.provenance.sourceFormat).toBe('markdown');
      expect(result.value.provenance.targetFormat).toBe('json');
      expect(result.value.provenance.sourceAdapter).toBe('test-adapter');
      expect(result.value.provenance.steps).toHaveLength(2);
      expect(result.value.provenance.steps[0].step).toBe('parse');
      expect(result.value.provenance.steps[1].step).toBe('compile');
    }
  });

  it('supports preferred adapter names', () => {
    const selector = makeSelector();
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run('src', 'markdown', 'json', {
      sourceAdapterName: 'test-adapter',
      targetAdapterName: 'test-adapter',
    });
    expect(result.ok).toBe(true);
  });

  it('handles parse failure', () => {
    const badAdapter: Adapter = {
      manifest: {
        name: 'bad',
        version: '1.0.0',
        vendor: 'test',
        adapterVersion: '0.1.0',
        supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
        capabilities: ['detect', 'parse', 'compile'],
      },
      detect: () => true,
      parse: () => {
        throw new Error('parse error');
      },
      compile: () => ({}),
    };

    const selector = makeSelector({
      selectSourceAdapter: () => ({ ok: true, value: badAdapter }),
    });
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run('src', 'markdown', 'json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].message).toContain('parse failed');
    }
  });

  it('handles compile failure', () => {
    const badAdapter: Adapter = {
      manifest: {
        name: 'bad',
        version: '1.0.0',
        vendor: 'test',
        adapterVersion: '0.1.0',
        supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
        capabilities: ['detect', 'parse', 'compile'],
      },
      detect: () => true,
      parse: () => ({}),
      compile: () => {
        throw new Error('compile error');
      },
    };

    const selector = makeSelector({
      selectTargetAdapter: () => ({ ok: true, value: badAdapter }),
    });
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run('src', 'markdown', 'json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].message).toContain('compile failed');
    }
  });

  it('runs optional normalize step when present', () => {
    let normalizeCalled = false;
    const adapting: Adapter = {
      manifest: {
        name: 'norm',
        version: '1.0.0',
        vendor: 'test',
        adapterVersion: '0.1.0',
        supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
        capabilities: ['detect', 'parse', 'normalize', 'compile'],
      },
      detect: () => true,
      parse: () => ({}),
      normalize: () => {
        normalizeCalled = true;
        return {} as NormalizedSkill;
      },
      compile: () => ({}),
    };

    const selector = makeSelector({
      selectSourceAdapter: () => ({ ok: true, value: adapting }),
    });
    const pipeline = new ConversionPipeline(selector);
    const result = pipeline.run('src', 'markdown', 'json');
    expect(result.ok).toBe(true);
    expect(normalizeCalled).toBe(true);
  });
});
