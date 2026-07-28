import type {
  Adapter,
  AdapterSelector,
  Result,
  Diagnostic,
  NormalizedSkill,
} from '../../adapter-sdk/src/index.js';
import { createConversionContext } from '../../adapter-sdk/src/index.js';

export interface ConversionStep {
  step: string;
  adapter: string;
  timestamp: string;
}

export interface ConversionProvenance {
  sourceFormat: string;
  targetFormat: string;
  sourceAdapter: string;
  targetAdapter: string;
  steps: ConversionStep[];
  startedAt: string;
}

export interface ConversionResult {
  output: unknown;
  diagnostics: Diagnostic[];
  provenance: ConversionProvenance;
}

export class ConversionPipeline {
  private selector: AdapterSelector;

  constructor(selector: AdapterSelector) {
    this.selector = selector;
  }

  run(
    source: unknown,
    sourceFormat: string,
    targetFormat: string,
    options?: {
      sourceAdapterName?: string;
      targetAdapterName?: string;
      options?: Record<string, unknown>;
    },
  ): Result<ConversionResult, Diagnostic[]> {
    const startedAt = new Date().toISOString();
    const diagnostics: Diagnostic[] = [];

    const sourceResult = this.selector.selectSourceAdapter(
      source,
      sourceFormat,
      options?.sourceAdapterName,
    );
    if (!sourceResult.ok) {
      return sourceResult;
    }
    const sourceAdapter = sourceResult.value;

    const targetResult = this.selector.selectTargetAdapter(
      targetFormat,
      options?.targetAdapterName,
    );
    if (!targetResult.ok) {
      return targetResult;
    }
    const targetAdapter = targetResult.value;

    const steps: ConversionStep[] = [];
    const step = (name: string, adapter: Adapter): void => {
      steps.push({
        step: name,
        adapter: adapter.manifest.name,
        timestamp: new Date().toISOString(),
      });
    };

    let parsed: unknown;
    try {
      parsed = sourceAdapter.parse(source);
      step('parse', sourceAdapter);
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `parse failed: ${e instanceof Error ? e.message : String(e)}`,
        code: 'ADAPTER-002',
        source: `adapter:${sourceAdapter.manifest.name}`,
      });
      return { ok: false, error: diagnostics };
    }

    let normalized: NormalizedSkill | undefined;
    if (sourceAdapter.normalize) {
      try {
        normalized = sourceAdapter.normalize(source, parsed);
        step('normalize', sourceAdapter);
      } catch (e) {
        diagnostics.push({
          severity: 'error',
          message: `normalize failed: ${e instanceof Error ? e.message : String(e)}`,
          code: 'ADAPTER-002',
          source: `adapter:${sourceAdapter.manifest.name}`,
        });
        return { ok: false, error: diagnostics };
      }
    }

    createConversionContext(source, parsed, sourceAdapter.manifest, {
      irPackage: normalized,
      extra: options?.options,
    });

    let compiled: unknown;
    try {
      compiled = targetAdapter.compile(parsed);
      step('compile', targetAdapter);
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `compile failed: ${e instanceof Error ? e.message : String(e)}`,
        code: 'ADAPTER-002',
        source: `adapter:${targetAdapter.manifest.name}`,
      });
      return { ok: false, error: diagnostics };
    }

    return {
      ok: true,
      value: {
        output: compiled,
        diagnostics,
        provenance: {
          sourceFormat,
          targetFormat,
          sourceAdapter: sourceAdapter.manifest.name,
          targetAdapter: targetAdapter.manifest.name,
          steps,
          startedAt,
        },
      },
    };
  }
}
