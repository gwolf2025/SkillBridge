/**
 * @skillbridge/adapter-sdk
 *
 * Public interfaces for first-party and third-party adapters.
 *
 * Adapter manifests, detection, parsing, normalization, capability declaration,
 * compilation, installation, invocation, verification, and diagnostics.
 */

export type AdapterCapability =
  'detect' | 'parse' | 'normalize' | 'compile' | 'install' | 'invoke' | 'verify';

export interface AdapterManifest {
  name: string;
  version: string;
  vendor: string;
  supportedSourceFormats: string[];
  supportedTargetFormats: string[];
  capabilities: AdapterCapability[];
}

export interface Adapter<TSource = unknown, TTarget = unknown, TNormalized = unknown> {
  manifest: AdapterManifest;

  detect(source: TSource): boolean;
  parse(source: TSource): TNormalized;
  compile(normalized: TNormalized): TTarget;
}
