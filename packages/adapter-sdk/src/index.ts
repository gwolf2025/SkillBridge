/**
 * @skillbridge/adapter-sdk
 *
 * Public interfaces for first-party and third-party adapters.
 *
 * Adapter manifests, detection, parsing, normalization, capability declaration,
 * compilation, installation, invocation, verification, and diagnostics.
 */

import type { Result, Diagnostic } from '../../core/src/index.js';
import { SkillBridgeError } from '../../core/src/index.js';
import type { NormalizedSkill, Permission } from '../../ir/src/index.js';

export type { Result, Diagnostic, NormalizedSkill, Permission };
export { SkillBridgeError };

export type AdapterCapability =
  | 'detect'
  | 'parse'
  | 'normalize'
  | 'compile'
  | 'install-plan'
  | 'install'
  | 'uninstall'
  | 'invoke'
  | 'verify';

export interface AdapterManifest {
  name: string;
  version: string;
  vendor: string;
  adapterVersion: string;
  /** @deprecated Use `supports.sourceFormats` instead. */
  supportedSourceFormats?: string[];
  /** @deprecated Use `supports.targetFormats` instead. */
  supportedTargetFormats?: string[];
  supports: {
    sourceFormats: string[];
    targetFormats: string[];
  };
  capabilities: AdapterCapability[];
  minAgentVersion?: string;
  homepage?: string;
  description?: string;
  extensions?: Record<string, unknown>;
}

export interface ConversionContext<TSource = unknown, TNormalized = unknown> {
  source: TSource;
  normalized: TNormalized;
  manifest: AdapterManifest;
  irPackage?: NormalizedSkill;
  targetProfile?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface InstallPlan {
  steps: string[];
  estimatedDuration?: number;
  warnings?: Diagnostic[];
  requires?: string[];
  permissions?: Permission[];
}

export interface Adapter<TSource = unknown, TTarget = unknown, TNormalized = unknown> {
  manifest: AdapterManifest;

  detect(source: TSource): boolean;
  parse(source: TSource): TNormalized;
  normalize?(source: TSource, parsed: TNormalized): NormalizedSkill;
  compile(normalized: TNormalized): TTarget;
  installPlan?(context: ConversionContext<TSource, TNormalized>): InstallPlan;
  install?(context: ConversionContext<TSource, TNormalized>): Result<void, Diagnostic[]>;
  uninstall?(context: ConversionContext<TSource, TNormalized>): Result<void, Diagnostic[]>;
  verify?(context: ConversionContext<TSource, TNormalized>): Result<boolean, Diagnostic[]>;
  invoke?(context: ConversionContext<TSource, TNormalized>): Result<TTarget, Diagnostic[]>;
}

export type AdapterErrorCode =
  'ADAPTER-001' | 'ADAPTER-002' | 'ADAPTER-003' | 'ADAPTER-004' | 'ADAPTER-005' | 'ADAPTER-006';

export class AdapterError extends SkillBridgeError {
  declare readonly code: AdapterErrorCode;

  constructor(code: AdapterErrorCode, message: string) {
    super(code, message);
    this.name = 'AdapterError';
  }
}

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: Map<string, Adapter> = new Map();

  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  register(adapter: Adapter): Result<void, Diagnostic[]> {
    const name = adapter.manifest.name;
    if (this.adapters.has(name)) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `adapter '${name}' is already registered`,
            code: 'ADAPTER-006',
            source: `adapter:${name}`,
          },
        ],
      };
    }
    this.adapters.set(name, adapter);
    return { ok: true, value: undefined };
  }

  get(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }

  list(): AdapterManifest[] {
    const result: AdapterManifest[] = [];
    for (const adapter of this.adapters.values()) {
      result.push(adapter.manifest);
    }
    return result;
  }

  findBySourceFormat(format: string): Adapter[] {
    const result: Adapter[] = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.manifest.supports.sourceFormats.includes(format)) {
        result.push(adapter);
      }
    }
    return result;
  }

  findByTargetFormat(format: string): Adapter[] {
    const result: Adapter[] = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.manifest.supports.targetFormats.includes(format)) {
        result.push(adapter);
      }
    }
    return result;
  }

  clear(): void {
    this.adapters.clear();
  }
}

export function adapterSupports(adapter: Adapter, capability: AdapterCapability): boolean {
  return adapter.manifest.capabilities.includes(capability);
}

export function createConversionContext<TSource, TNormalized>(
  source: TSource,
  normalized: TNormalized,
  manifest: AdapterManifest,
  options?: {
    irPackage?: NormalizedSkill;
    targetProfile?: Record<string, unknown>;
    extra?: Record<string, unknown>;
  },
): ConversionContext<TSource, TNormalized> {
  return {
    source,
    normalized,
    manifest,
    irPackage: options?.irPackage,
    targetProfile: options?.targetProfile,
    options: options?.extra,
  };
}
