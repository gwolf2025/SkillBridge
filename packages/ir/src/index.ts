/**
 * @skillbridge/ir
 *
 * Vendor-neutral SkillBridge Intermediate Representation.
 *
 * This package defines the normalized representation through which all
 * skill conversions pass. No dependency on concrete adapters.
 */

export type IRVersion = '0.1.0';

export type CapabilityRequirement =
  | 'file-read'
  | 'file-write'
  | 'command-exec'
  | 'network-access'
  | 'env-read'
  | 'search-files'
  | 'search-web'
  | 'read-sensors';

export type SourceFormat = 'markdown' | 'yaml' | 'json' | 'package';

export interface SourceMetadata {
  format: SourceFormat;
  version?: string;
  path?: string;
}

export interface IRPackage {
  irVersion: IRVersion;
  source: SourceMetadata;
  name: string;
  version: string;
  description?: string;
  capabilities: CapabilityRequirement[];
  permissions: string[];
  provenance: Record<string, unknown>;
}
