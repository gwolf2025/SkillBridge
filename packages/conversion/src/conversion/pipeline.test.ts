import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversionPipeline } from '@skillbridge/conversion';
import type {
  AdapterSelector,
  Adapter,
  NormalizedSkill,
  Result,
  Diagnostic,
} from '@skillbridge/adapter-sdk';
import type { CompatibilityReport, SecurityImpactReport } from '@skillbridge/compatibility';

vi.mock('@skillbridge/compatibility', () => ({
  analyzeCompatibility: vi.fn(),
  assessSecurityImpact: vi.fn(),
}));

import { analyzeCompatibility, assessSecurityImpact } from '@skillbridge/compatibility';

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

const nativeCompatReport: CompatibilityReport = {
  comparisons: [{ capability: 'file-read', required: true, level: 'native' }],
  overall: 'native',
  nativeCount: 1,
  emulatedCount: 0,
  missingCount: 0,
  degradedCount: 0,
  partialCount: 0,
  unknownCount: 0,
  semanticDegradations: [],
  missingResources: [],
  assumptions: [],
};

const emptySecurity: SecurityImpactReport = {
  preservedPermissions: [],
  weakenedPermissions: [],
  addedPermissions: [],
  removedPermissions: [],
  diagnostics: [],
};

function adapterWithNormalize(overrides?: Partial<Adapter>): Adapter {
  return {
    manifest: {
      name: 'norm-adapter',
      version: '1.0.0',
      vendor: 'test',
      adapterVersion: '0.1.0',
      supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
      capabilities: ['detect', 'parse', 'normalize', 'compile'],
    },
    detect: () => true,
    parse: () => ({}),
    normalize: () =>
      ({
        irVersion: '0.1.0',
        identity: { name: 'test-skill', version: '1.0.0' },
        capabilities: ['file-read'],
        permissions: [],
        source: { format: 'markdown' },
      }) as NormalizedSkill,
    compile: () => ({}),
    ...overrides,
  };
}

function selectorWithAdapter(adapter: Adapter, targetAdapter?: Adapter): AdapterSelector {
  return {
    selectSourceAdapter: () => ({ ok: true, value: adapter }),
    selectTargetAdapter: () => ({ ok: true, value: targetAdapter ?? adapter }),
    findSourceAdapters: () => [{ adapter, confidence: 1 }],
    listAdapters: () => [adapter.manifest],
  };
}

function makeCompatReport(
  overrides: Partial<CompatibilityReport> & { comparisons: CompatibilityReport['comparisons'] },
): CompatibilityReport {
  const comparisons = overrides.comparisons;
  const nativeCount = comparisons.filter((c) => c.level === 'native').length;
  const emulatedCount = comparisons.filter((c) => c.level === 'emulated').length;
  const missingCount = comparisons.filter((c) => c.level === 'missing').length;
  const degradedCount = comparisons.filter((c) => c.level === 'degraded').length;
  const partialCount = comparisons.filter((c) => c.level === 'partial').length;
  const unknownCount = comparisons.filter((c) => c.level === 'unknown').length;
  return {
    overall: 'degraded',
    nativeCount,
    emulatedCount,
    missingCount,
    degradedCount,
    partialCount,
    unknownCount,
    semanticDegradations: [],
    missingResources: [],
    assumptions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(analyzeCompatibility).mockReset();
  vi.mocked(assessSecurityImpact).mockReset();
  vi.mocked(analyzeCompatibility).mockReturnValue({
    ok: true,
    value: nativeCompatReport,
  } as Result<CompatibilityReport, Diagnostic[]>);
  vi.mocked(assessSecurityImpact).mockReturnValue({
    ok: true,
    value: emptySecurity,
  } as Result<SecurityImpactReport, Diagnostic[]>);
});

describe('ConversionPipeline', () => {
  // -------- existing tests (preserved unchanged) --------

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

  // -------- new tests for enhanced pipeline --------

  describe('compatibility analysis', () => {
    it('includes compatibility report when normalize produces capabilities', () => {
      const adapter = adapterWithNormalize();
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.compatibility).not.toBeNull();
        expect(result.value.compatibility?.overall).toBe('native');
        expect(result.value.compatibility?.comparisons[0].capability).toBe('file-read');
      }
    });

    it('calls analyzeCompatibility with target profile from adapter manifest', () => {
      const adapter = adapterWithNormalize();
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      pipeline.run('src', 'markdown', 'json');
      expect(analyzeCompatibility).toHaveBeenCalledTimes(1);
      const args = vi.mocked(analyzeCompatibility).mock.calls[0];
      expect(args[0]).toEqual([{ id: 'file-read', required: true }]);
      expect(args[1]).toMatchObject({
        name: 'norm-adapter',
        vendor: 'test',
      });
    });

    it('records analyze step in provenance', () => {
      const adapter = adapterWithNormalize();
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const stepNames = result.value.provenance.steps.map((s) => s.step);
        expect(stepNames).toContain('analyze');
      }
    });
  });

  describe('security impact assessment', () => {
    it('includes security impact report when permissions are present', () => {
      const adapter = adapterWithNormalize({
        normalize: () =>
          ({
            irVersion: '0.1.0',
            identity: { name: 'test-skill', version: '1.0.0' },
            capabilities: ['file-read'],
            permissions: [{ resource: 'fs', actions: ['read'] }],
            source: { format: 'markdown' },
          }) as NormalizedSkill,
      });
      vi.mocked(assessSecurityImpact).mockReturnValue({
        ok: true,
        value: {
          preservedPermissions: [{ resource: 'fs', actions: ['read'] }],
          weakenedPermissions: [],
          addedPermissions: [],
          removedPermissions: [],
          diagnostics: [],
        },
      } as Result<SecurityImpactReport, Diagnostic[]>);

      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.securityImpact).not.toBeNull();
        expect(result.value.securityImpact?.preservedPermissions).toHaveLength(1);
      }
    });

    it('calls assessSecurityImpact with required and declared permissions', () => {
      const adapter = adapterWithNormalize({
        normalize: () =>
          ({
            irVersion: '0.1.0',
            identity: { name: 'test-skill', version: '1.0.0' },
            capabilities: ['file-read'],
            permissions: [{ resource: 'fs', actions: ['read'] }],
            source: { format: 'markdown' },
          }) as NormalizedSkill,
      });
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      pipeline.run('src', 'markdown', 'json');
      expect(assessSecurityImpact).toHaveBeenCalled();
    });
  });

  // -------- policy enforcement tests --------

  describe('policy enforcement', () => {
    describe('strict mode', () => {
      it('blocks on missing capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'missing' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });

      it('blocks on degraded capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'degraded' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });

      it('blocks on unknown capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'unknown' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });

      it('blocks on partial capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'partial' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });

      it('blocks on emulated capability (all emulation is lossy)', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'emulated' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });

      it('allows native capability', () => {
        const adapter = adapterWithNormalize();
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(true);
      });

      it('blocks on weakened permission', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read', 'write'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [
              {
                resource: 'fs',
                requiredActions: ['read', 'write'],
                declaredActions: ['read'],
                missingActions: ['write'],
              },
            ],
            addedPermissions: [],
            removedPermissions: [],
            diagnostics: [
              { severity: 'warning', message: 'weakened', code: 'COMPAT-003', source: 'fs' },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });

      it('blocks on removed permission', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [],
            addedPermissions: [],
            removedPermissions: [{ resource: 'fs', requiredActions: ['read'] }],
            diagnostics: [
              { severity: 'warning', message: 'removed', code: 'COMPAT-002', source: 'fs' },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(false);
      });
    });

    describe('safe mode', () => {
      it('allows native capability', () => {
        const adapter = adapterWithNormalize();
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(true);
      });

      it('allows emulated capability (declared safe emulation)', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'emulated' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(true);
      });

      it('warns on missing capability but continues', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'missing' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.policyResult?.blocked).toBe(false);
          const warnDecisions = result.value.policyResult?.decisions.filter(
            (d) => d.action === 'warn',
          );
          expect(warnDecisions?.length).toBeGreaterThan(0);
        }
      });

      it('warns on degraded capability but continues', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'degraded' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(true);
      });

      it('warns on unknown capability but continues', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'unknown' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(true);
      });

      it('warns on partial capability but continues', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'partial' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(true);
      });

      it('blocks on weakened permission', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read', 'write'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [
              {
                resource: 'fs',
                requiredActions: ['read', 'write'],
                declaredActions: ['read'],
                missingActions: ['write'],
              },
            ],
            addedPermissions: [],
            removedPermissions: [],
            diagnostics: [
              { severity: 'warning', message: 'weakened', code: 'COMPAT-003', source: 'fs' },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(false);
      });

      it('blocks on removed permission', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [],
            addedPermissions: [],
            removedPermissions: [{ resource: 'fs', requiredActions: ['read'] }],
            diagnostics: [
              { severity: 'warning', message: 'removed', code: 'COMPAT-002', source: 'fs' },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(false);
      });
    });

    describe('permissive mode', () => {
      it('allows missing capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'missing' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
      });

      it('allows degraded capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'degraded' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
      });

      it('allows emulated capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'emulated' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
      });

      it('allows unknown capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'unknown' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
      });

      it('allows partial capability', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'partial' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
      });

      it('allows weakened permission with explicit diagnostics', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read', 'write'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [
              {
                resource: 'fs',
                requiredActions: ['read', 'write'],
                declaredActions: ['read'],
                missingActions: ['write'],
              },
            ],
            addedPermissions: [],
            removedPermissions: [],
            diagnostics: [
              {
                severity: 'warning',
                message: 'permission weakened',
                code: 'COMPAT-003',
                source: 'fs',
              },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
        if (result.ok) {
          const diagCodes = result.value.diagnostics.map((d) => d.code);
          expect(diagCodes).toContain('COMPAT-003');
        }
      });

      it('allows removed permission with explicit diagnostics', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [],
            addedPermissions: [],
            removedPermissions: [{ resource: 'fs', requiredActions: ['read'] }],
            diagnostics: [
              {
                severity: 'warning',
                message: 'permission removed',
                code: 'COMPAT-002',
                source: 'fs',
              },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'permissive' });
        expect(result.ok).toBe(true);
        if (result.ok) {
          const diagCodes = result.value.diagnostics.map((d) => d.code);
          expect(diagCodes).toContain('COMPAT-002');
        }
      });
    });

    describe('default and edge cases', () => {
      it('defaults to safe policy', () => {
        const adapter = adapterWithNormalize();
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.policyResult?.policy).toBe('safe');
        }
      });

      it('reports policy decisions in results', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({
            comparisons: [{ capability: 'file-read', required: true, level: 'missing' }],
          }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.policyResult?.decisions.length).toBeGreaterThan(0);
          expect(result.value.policyResult?.decisions[0].type).toBe('degradation');
          expect(result.value.policyResult?.decisions[0].action).toBe('warn');
        }
      });

      it('rejects deprecated relaxed policy with CONV-012 diagnostic', () => {
        const adapter = adapterWithNormalize();
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', {
          policy: 'relaxed' as 'safe',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          const codes = result.value.diagnostics.map((d) => d.code);
          expect(codes).toContain('CONV-012');
          expect(result.value.policyResult?.policy).toBe('safe');
        }
      });

      it('handles empty comparison report', () => {
        const adapter = adapterWithNormalize();
        vi.mocked(analyzeCompatibility).mockReturnValue({
          ok: true,
          value: makeCompatReport({ comparisons: [] }),
        } as Result<CompatibilityReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(true);
      });

      it('produces no policy decisions for pure native', () => {
        const adapter = adapterWithNormalize();
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'strict' });
        expect(result.ok).toBe(true);
        if (result.ok) {
          const blockOrWarn = result.value.policyResult?.decisions.filter(
            (d) => d.action !== 'allow',
          );
          expect(blockOrWarn?.length).toBe(0);
        }
      });

      it('surfaces security diagnostics in pipeline diagnostics', () => {
        const adapter = adapterWithNormalize({
          normalize: () =>
            ({
              irVersion: '0.1.0',
              identity: { name: 'test-skill', version: '1.0.0' },
              capabilities: ['file-read'],
              permissions: [{ resource: 'fs', actions: ['read'] }],
              source: { format: 'markdown' },
            }) as NormalizedSkill,
        });
        vi.mocked(assessSecurityImpact).mockReturnValue({
          ok: true,
          value: {
            preservedPermissions: [],
            weakenedPermissions: [
              {
                resource: 'fs',
                requiredActions: ['read'],
                declaredActions: [],
                missingActions: ['read'],
              },
            ],
            addedPermissions: [],
            removedPermissions: [],
            diagnostics: [
              { severity: 'warning', message: 'weakened', code: 'COMPAT-003', source: 'fs' },
            ],
          },
        } as Result<SecurityImpactReport, Diagnostic[]>);
        const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
        const result = pipeline.run('src', 'markdown', 'json', { policy: 'safe' });
        expect(result.ok).toBe(false);
        const codes = result.ok
          ? result.value.diagnostics.map((d) => d.code)
          : result.error.map((d) => d.code);
        expect(codes).toContain('COMPAT-003');
      });
    });
  });

  describe('file manifest', () => {
    it('generates manifest in result', () => {
      const adapter = adapterWithNormalize();
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.manifest).not.toBeNull();
        expect(result.value.manifest?.compiledBy).toBe('norm-adapter');
        expect(result.value.manifest?.compiledAt).toBeDefined();
        expect(typeof result.value.manifest?.metadata).toBe('object');
      }
    });

    it('extracts files from compiled output', () => {
      const adapter = adapterWithNormalize({
        compile: () => ({
          files: ['output.md', 'manifest.json'],
          metadata: { format: 'markdown' },
        }),
      });
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.manifest?.files).toContain('output.md');
        expect(result.value.manifest?.files).toContain('manifest.json');
        expect(result.value.manifest?.metadata).toMatchObject({ format: 'markdown' });
      }
    });
  });

  describe('output verification', () => {
    it('records verify step when adapter has verify method', () => {
      const adapter = adapterWithNormalize({
        manifest: {
          name: 'verify-adapter',
          version: '1.0.0',
          vendor: 'test',
          adapterVersion: '0.1.0',
          supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
          capabilities: ['detect', 'parse', 'normalize', 'compile', 'verify'],
        },
        verify: () => ({ ok: true, value: true }),
      });
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const stepNames = result.value.provenance.steps.map((s) => s.step);
        expect(stepNames).toContain('verify');
      }
    });

    it('adds warning diagnostic when verify returns false', () => {
      const adapter = adapterWithNormalize({
        manifest: {
          name: 'verify-adapter',
          version: '1.0.0',
          vendor: 'test',
          adapterVersion: '0.1.0',
          supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
          capabilities: ['detect', 'parse', 'normalize', 'compile', 'verify'],
        },
        verify: () => ({ ok: true, value: false }),
      });
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const codes = result.value.diagnostics.map((d) => d.code);
        expect(codes).toContain('CONV-011');
      }
    });

    it('handles verify method absence gracefully', () => {
      const adapter = adapterWithNormalize();
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const stepNames = result.value.provenance.steps.map((s) => s.step);
        expect(stepNames).not.toContain('verify');
      }
    });
  });

  describe('field provenances', () => {
    it('includes fieldProvenances in result', () => {
      const adapter = adapterWithNormalize();
      const pipeline = new ConversionPipeline(selectorWithAdapter(adapter));
      const result = pipeline.run('src', 'markdown', 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.value.fieldProvenances)).toBe(true);
      }
    });
  });

  describe('full integration', () => {
    it('runs full pipeline with all optional steps', () => {
      const adapter: Adapter = {
        manifest: {
          name: 'full-adapter',
          version: '1.0.0',
          vendor: 'test',
          adapterVersion: '0.1.0',
          supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
          capabilities: ['detect', 'parse', 'normalize', 'compile', 'verify'],
        },
        detect: () => true,
        parse: () => ({}),
        normalize: () =>
          ({
            irVersion: '0.1.0',
            identity: { name: 'full-skill', version: '1.0.0' },
            capabilities: ['file-read', 'file-write'],
            permissions: [{ resource: 'fs', actions: ['read'] }],
            source: { format: 'markdown' },
          }) as NormalizedSkill,
        compile: () => ({ files: ['out.json'], metadata: { format: 'json' } }),
        verify: () => ({ ok: true, value: true }),
      };

      vi.mocked(analyzeCompatibility).mockReturnValue({
        ok: true,
        value: {
          comparisons: [
            { capability: 'file-read', required: true, level: 'native' },
            { capability: 'file-write', required: true, level: 'native' },
          ],
          overall: 'native',
          nativeCount: 2,
          emulatedCount: 0,
          missingCount: 0,
          degradedCount: 0,
          partialCount: 0,
          unknownCount: 0,
          semanticDegradations: [],
          missingResources: [],
          assumptions: [],
        },
      } as Result<CompatibilityReport, Diagnostic[]>);

      vi.mocked(assessSecurityImpact).mockReturnValue({
        ok: true,
        value: {
          preservedPermissions: [{ resource: 'fs', actions: ['read'] }],
          weakenedPermissions: [],
          addedPermissions: [],
          removedPermissions: [],
          diagnostics: [],
        },
      } as Result<SecurityImpactReport, Diagnostic[]>);

      const selector = selectorWithAdapter(adapter);
      const pipeline = new ConversionPipeline(selector);
      const result = pipeline.run('src', 'markdown', 'json');

      expect(result.ok).toBe(true);
      if (result.ok) {
        const v = result.value;
        expect(v.provenance.steps.map((s) => s.step)).toEqual([
          'parse',
          'normalize',
          'analyze',
          'compile',
          'verify',
        ]);
        expect(v.compatibility).not.toBeNull();
        expect(v.compatibility?.overall).toBe('native');
        expect(v.securityImpact).not.toBeNull();
        expect(v.manifest?.files).toContain('out.json');
        expect(v.policyResult).not.toBeNull();
        expect(v.policyResult?.blocked).toBe(false);
        expect(Array.isArray(v.fieldProvenances)).toBe(true);
      }
    });
  });
});
