/**
 * @skillbridge/registry-local
 *
 * Local adapter registry with detection ranking, confidence scoring,
 * duplicate-ID detection, and ambiguity resolution.
 * Implements the AdapterSelector interface from @skillbridge/adapter-sdk.
 */

import type {
  Adapter,
  AdapterManifest,
  DetectionResult,
  Result,
  Diagnostic,
  AdapterSelector,
} from '../../adapter-sdk/src/index.js';

export type { AdapterSelector, DetectionResult, Adapter, AdapterManifest, Result, Diagnostic };

export interface LocalAdapterRegistryOptions {
  defaultConfidence?: number;
  ambiguityThreshold?: number;
  confidenceFn?: (adapter: Adapter, source: unknown) => number;
}

const DEFAULT_CONFIDENCE = 0.5;
const AMBIGUITY_THRESHOLD = 0.7;

export class LocalAdapterRegistry implements AdapterSelector {
  private adapters: Map<string, Adapter[]> = new Map();
  private defaultConfidence: number;
  private ambiguityThreshold: number;
  private confidenceFn?: (adapter: Adapter, source: unknown) => number;

  constructor(options?: LocalAdapterRegistryOptions) {
    this.defaultConfidence = options?.defaultConfidence ?? DEFAULT_CONFIDENCE;
    this.ambiguityThreshold = options?.ambiguityThreshold ?? AMBIGUITY_THRESHOLD;
    this.confidenceFn = options?.confidenceFn;
  }

  register(adapter: Adapter): Result<void, Diagnostic[]> {
    const name = adapter.manifest.name;
    const version = adapter.manifest.version;
    const existing = this.adapters.get(name) ?? [];

    const dup = existing.find((a) => a.manifest.version === version);
    if (dup) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `adapter '${name}@${version}' is already registered`,
            code: 'ADAPTER-006',
            source: `registry:${name}`,
          },
        ],
      };
    }

    existing.push(adapter);
    this.adapters.set(name, existing);
    return { ok: true, value: undefined };
  }

  get(name: string, version?: string): Adapter | undefined {
    const byName = this.adapters.get(name);
    if (!byName) return undefined;
    if (version) {
      return byName.find((a) => a.manifest.version === version);
    }
    return byName[byName.length - 1];
  }

  listAdapters(): AdapterManifest[] {
    const result: AdapterManifest[] = [];
    for (const adapters of this.adapters.values()) {
      for (const adapter of adapters) {
        result.push(adapter.manifest);
      }
    }
    return result;
  }

  hasAdapter(name: string, version?: string): boolean {
    return this.get(name, version) !== undefined;
  }

  remove(name: string, version?: string): boolean {
    if (version) {
      const byName = this.adapters.get(name);
      if (!byName) return false;
      const idx = byName.findIndex((a) => a.manifest.version === version);
      if (idx === -1) return false;
      byName.splice(idx, 1);
      if (byName.length === 0) this.adapters.delete(name);
      return true;
    }
    return this.adapters.delete(name);
  }

  clear(): void {
    this.adapters.clear();
  }

  count(): number {
    let total = 0;
    for (const adapters of this.adapters.values()) {
      total += adapters.length;
    }
    return total;
  }

  findSourceAdapters(sourceFormat: string): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (const adapters of this.adapters.values()) {
      for (const adapter of adapters) {
        if (adapter.manifest.supports.sourceFormats.includes(sourceFormat)) {
          results.push({
            adapter,
            confidence: this.defaultConfidence,
          });
        }
      }
    }

    return results;
  }

  detectAll(source: unknown, sourceFormat: string): DetectionResult[] {
    const candidates = this.findSourceAdapters(sourceFormat);
    const results: DetectionResult[] = [];

    for (const candidate of candidates) {
      try {
        const detected = candidate.adapter.detect(source);
        if (!detected) continue;

        const confidence = this.confidenceFn
          ? this.confidenceFn(candidate.adapter, source)
          : this.defaultConfidence;

        results.push({ adapter: candidate.adapter, confidence });
      } catch {
        results.push({
          adapter: candidate.adapter,
          confidence: 0,
          diagnostics: [
            {
              severity: 'warning',
              message: `adapter '${candidate.adapter.manifest.name}' threw during detect()`,
              code: 'ADAPTER-002',
              source: `adapter:${candidate.adapter.manifest.name}`,
            },
          ],
        });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  selectSourceAdapter(
    source: unknown,
    sourceFormat: string,
    preferredName?: string,
  ): Result<Adapter, Diagnostic[]> {
    if (source === null || source === undefined) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `no adapter found: source is ${String(source)}`,
            code: 'ADAPTER-008',
            source: 'registry',
          },
        ],
      };
    }

    if (preferredName) {
      const adapter = this.get(preferredName);
      if (!adapter) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `preferred adapter '${preferredName}' is not registered`,
              code: 'ADAPTER-001',
              source: 'registry',
            },
          ],
        };
      }
      if (!adapter.manifest.supports.sourceFormats.includes(sourceFormat)) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `preferred adapter '${preferredName}' does not support source format '${sourceFormat}'`,
              code: 'ADAPTER-002',
              source: 'registry',
            },
          ],
        };
      }
      return { ok: true, value: adapter };
    }

    const detected = this.detectAll(source, sourceFormat);

    if (detected.length === 0) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `no adapter found for source format '${sourceFormat}'`,
            code: 'ADAPTER-008',
            source: 'registry',
          },
        ],
      };
    }

    const topConfidence = detected[0].confidence;
    const ambiguous = detected.filter(
      (d) => d.confidence >= this.ambiguityThreshold && d.confidence === topConfidence,
    );

    if (ambiguous.length > 1) {
      const names = ambiguous.map((d) => d.adapter.manifest.name).join(', ');
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `ambiguous detection: multiple adapters match with confidence ${topConfidence}: ${names}`,
            code: 'ADAPTER-007',
            source: 'registry',
          },
        ],
      };
    }

    return { ok: true, value: detected[0].adapter };
  }

  selectTargetAdapter(targetFormat: string, preferredName?: string): Result<Adapter, Diagnostic[]> {
    if (preferredName) {
      const adapter = this.get(preferredName);
      if (!adapter) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `preferred adapter '${preferredName}' is not registered`,
              code: 'ADAPTER-001',
              source: 'registry',
            },
          ],
        };
      }
      if (!adapter.manifest.supports.targetFormats.includes(targetFormat)) {
        return {
          ok: false,
          error: [
            {
              severity: 'error',
              message: `preferred adapter '${preferredName}' does not support target format '${targetFormat}'`,
              code: 'ADAPTER-002',
              source: 'registry',
            },
          ],
        };
      }
      return { ok: true, value: adapter };
    }

    const candidates: Adapter[] = [];
    for (const adapters of this.adapters.values()) {
      for (const adapter of adapters) {
        if (adapter.manifest.supports.targetFormats.includes(targetFormat)) {
          candidates.push(adapter);
        }
      }
    }

    if (candidates.length === 0) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `no adapter found for target format '${targetFormat}'`,
            code: 'ADAPTER-008',
            source: 'registry',
          },
        ],
      };
    }

    return { ok: true, value: candidates[0] };
  }
}
