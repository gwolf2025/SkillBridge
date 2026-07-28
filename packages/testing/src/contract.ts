import { describe, it, expect } from 'vitest';
import type { Adapter, ConversionContext, InstallPlan } from '../../adapter-sdk/src/index.js';
import { createConversionContext } from '../../adapter-sdk/src/index.js';

export interface AdapterContractOptions {
  source?: unknown;
  normalized?: unknown;
  detectRejectInput?: unknown;
}

const defaultSource = 'test-source';
const defaultNormalized = { data: 'normalized' };

function buildContext(adapter: Adapter, source: unknown, normalized: unknown): ConversionContext {
  return createConversionContext(source, normalized, adapter.manifest);
}

export function describeAdapterContract(adapter: Adapter, options: AdapterContractOptions): void {
  const source = options.source ?? defaultSource;
  const normalized = options.normalized ?? defaultNormalized;
  const rejectInput = options.detectRejectInput ?? '';

  describe(`AdapterContract: ${adapter.manifest.name}`, () => {
    it('has a valid manifest with required fields', () => {
      expect(adapter.manifest.name).toBeDefined();
      expect(adapter.manifest.version).toBeDefined();
      expect(adapter.manifest.vendor).toBeDefined();
      expect(adapter.manifest.adapterVersion).toBeDefined();
      expect(adapter.manifest.supports).toBeDefined();
      expect(Array.isArray(adapter.manifest.supports.sourceFormats)).toBe(true);
      expect(Array.isArray(adapter.manifest.supports.targetFormats)).toBe(true);
      expect(Array.isArray(adapter.manifest.capabilities)).toBe(true);
    });

    it('detect returns true for supported input', () => {
      expect(adapter.detect(source)).toBe(true);
    });

    it('detect returns false for unsupported input', () => {
      expect(adapter.detect(rejectInput)).toBe(false);
    });

    it('parses source to normalized form', () => {
      const result = adapter.parse(source);
      expect(result).toBeDefined();
    });

    it('compiles normalized to target form', () => {
      const result = adapter.compile(normalized);
      expect(result).toBeDefined();
    });

    it('installPlan returns a valid plan when capability declared', () => {
      if (adapter.manifest.capabilities.includes('install-plan') && adapter.installPlan) {
        const ctx = buildContext(adapter, source, normalized);
        const plan: InstallPlan = adapter.installPlan(ctx);
        expect(Array.isArray(plan.steps)).toBe(true);
        expect(plan.steps.length).toBeGreaterThan(0);
      }
    });

    it('install/verify/uninstall cycle works when capabilities declared', () => {
      const ctx = buildContext(adapter, source, normalized);
      if (adapter.manifest.capabilities.includes('install') && adapter.install) {
        const installResult = adapter.install(ctx);
        expect(installResult.ok).toBe(true);
      }
      if (adapter.manifest.capabilities.includes('verify') && adapter.verify) {
        const verifyResult = adapter.verify(ctx);
        expect(verifyResult.ok).toBe(true);
        if (verifyResult.ok) {
          expect(typeof verifyResult.value).toBe('boolean');
        }
      }
      if (adapter.manifest.capabilities.includes('uninstall') && adapter.uninstall) {
        const uninstallResult = adapter.uninstall(ctx);
        expect(uninstallResult.ok).toBe(true);
      }
    });

    it('capabilities match implemented methods', () => {
      const caps = adapter.manifest.capabilities;
      if (caps.includes('parse')) expect(typeof adapter.parse).toBe('function');
      if (caps.includes('compile')) expect(typeof adapter.compile).toBe('function');
      if (caps.includes('detect')) expect(typeof adapter.detect).toBe('function');
      if (caps.includes('install')) expect(typeof adapter.install).toBe('function');
      if (caps.includes('install-plan')) expect(typeof adapter.installPlan).toBe('function');
      if (caps.includes('uninstall')) expect(typeof adapter.uninstall).toBe('function');
      if (caps.includes('verify')) expect(typeof adapter.verify).toBe('function');
      if (caps.includes('invoke')) expect(typeof adapter.invoke).toBe('function');
    });

    it('conversion context has expected shape', () => {
      const ctx = buildContext(adapter, source, normalized);
      expect(ctx).toHaveProperty('source');
      expect(ctx).toHaveProperty('normalized');
      expect(ctx).toHaveProperty('manifest');
      expect(ctx.manifest).toBe(adapter.manifest);
    });

    it('diagnostics from adapter include source field', () => {
      if (adapter.manifest.capabilities.includes('install') && adapter.install) {
        const ctx = buildContext(adapter, source, normalized);
        const result = adapter.install(ctx);
        if (!result.ok) {
          for (const d of result.error) {
            expect(d.source).toMatch(/^adapter:/);
          }
        }
      }
    });
  });
}
