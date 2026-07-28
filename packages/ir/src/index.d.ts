import type { Result, Diagnostic } from '../../core/src/index.js';
import type { Schema } from '../../schema/src/index.js';
export type IRVersion = '0.1.0';
export type Capability =
  | 'file-read'
  | 'file-write'
  | 'command-exec'
  | 'network-access'
  | 'env-read'
  | 'search-files'
  | 'search-web'
  | 'read-sensors'
  | 'http-get'
  | 'http-post'
  | 'process-spawn'
  | 'read-registry'
  | 'write-registry'
  | 'list-directory'
  | 'read-file-system-meta'
  | 'secrets'
  | 'subagent'
  | 'hooks'
  | 'mcp'
  | 'template'
  | 'user-prompt'
  | 'installation-scope'
  | 'execution-mode';
export type SourceFormat = 'markdown' | 'yaml' | 'json' | 'package';
export type CapabilityVocabularyVersion = '0.1.0';
export type CapabilityCategory =
  | 'execution'
  | 'filesystem'
  | 'network'
  | 'environment'
  | 'secrets'
  | 'integration'
  | 'prompting'
  | 'installation';
export interface ParameterInfo {
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  required?: boolean;
  enumValues?: readonly string[];
}
export interface CapabilityDefinition {
  id: Capability;
  category: CapabilityCategory;
  description: string;
  parameters?: Record<string, ParameterInfo>;
  since: CapabilityVocabularyVersion;
  deprecated?: CapabilityVocabularyVersion;
}
export interface CapabilityRequirement {
  id: Capability;
  required: boolean;
  parameters?: Record<string, unknown>;
}
export declare const CAPABILITY_VOCABULARY_VERSION: CapabilityVocabularyVersion;
export declare const CAPABILITY_VOCABULARY: Record<Capability, CapabilityDefinition>;
export declare function getCapabilityDefinition(
  id: string,
): Result<CapabilityDefinition, Diagnostic[]>;
export declare function isValidCapability(id: string): boolean;
export interface SkillIdentity {
  name: string;
  version: string;
  description?: string;
}
export interface InvocationGuidance {
  instructions: string;
  example?: string;
}
export interface SkillIO {
  name: string;
  description?: string;
  type: string;
  required?: boolean;
}
export interface SkillResource {
  pattern: string;
  description?: string;
}
export interface SkillScript {
  name: string;
  command: string;
  args?: string[];
}
export interface SkillTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}
export interface Permission {
  resource: string;
  actions: string[];
}
export interface EnvironmentRequirement {
  key: string;
  description?: string;
  required?: boolean;
}
export interface ExecutionRequirement {
  runtime?: string;
  timeout?: number;
  memory?: string;
}
export interface ConversionStep {
  adapter: string;
  timestamp: string;
  version?: string;
}
export interface Provenance {
  convertedAt?: string;
  convertedBy?: string;
  sourcePackage?: string;
  history?: ConversionStep[];
}
export interface LicenseMetadata {
  license?: string;
  notice?: string;
}
export interface SourceMetadata {
  format: SourceFormat;
  version?: string;
  path?: string;
}
export interface CompilationManifest {
  files: string[];
  checksums: Record<string, string>;
  metadata: Record<string, unknown>;
  compiledAt: string;
  compiledBy: string;
}
export interface NormalizedSkill {
  irVersion: IRVersion;
  identity: SkillIdentity;
  invocation?: InvocationGuidance;
  inputs?: SkillIO[];
  outputs?: SkillIO[];
  resources?: SkillResource[];
  scripts?: SkillScript[];
  capabilities: Capability[];
  tools?: SkillTool[];
  permissions: Permission[];
  environment?: EnvironmentRequirement[];
  execution?: ExecutionRequirement;
  provenance?: Provenance;
  license?: LicenseMetadata;
  source: SourceMetadata;
  extensions?: Record<string, unknown>;
}
export interface ResolvedIR {
  normalized: NormalizedSkill;
  dependencies?: Record<string, NormalizedSkill>;
  diagnostics?: Diagnostic[];
}
export interface CompiledIR {
  resolved: ResolvedIR;
  manifest: CompilationManifest;
}
export declare const normalizedSkillSchema: Schema<{
  irVersion: '0.1.0';
  identity: {
    name: string;
    version: string;
    description: string | undefined;
  };
  invocation:
    | {
        instructions: string;
        example: string | undefined;
      }
    | undefined;
  inputs:
    | {
        name: string;
        description: string | undefined;
        type: string;
        required: boolean | undefined;
      }[]
    | undefined;
  outputs:
    | {
        name: string;
        description: string | undefined;
        type: string;
        required: boolean | undefined;
      }[]
    | undefined;
  resources:
    | {
        pattern: string;
        description: string | undefined;
      }[]
    | undefined;
  scripts:
    | {
        name: string;
        command: string;
        args: string[] | undefined;
      }[]
    | undefined;
  capabilities: (
    | 'file-read'
    | 'file-write'
    | 'command-exec'
    | 'network-access'
    | 'env-read'
    | 'search-files'
    | 'search-web'
    | 'read-sensors'
    | 'http-get'
    | 'http-post'
    | 'process-spawn'
    | 'read-registry'
    | 'write-registry'
    | 'list-directory'
    | 'read-file-system-meta'
    | 'secrets'
    | 'subagent'
    | 'hooks'
    | 'mcp'
    | 'template'
    | 'user-prompt'
    | 'installation-scope'
    | 'execution-mode'
  )[];
  tools:
    | {
        name: string;
        description: string | undefined;
        inputSchema: Record<string, unknown> | undefined;
      }[]
    | undefined;
  permissions: {
    resource: string;
    actions: string[];
  }[];
  environment:
    | {
        key: string;
        description: string | undefined;
        required: boolean | undefined;
      }[]
    | undefined;
  execution:
    | {
        runtime: string | undefined;
        timeout: number | undefined;
        memory: string | undefined;
      }
    | undefined;
  provenance:
    | {
        convertedAt: string | undefined;
        convertedBy: string | undefined;
        sourcePackage: string | undefined;
        history:
          | {
              adapter: string;
              timestamp: string;
              version: string | undefined;
            }[]
          | undefined;
      }
    | undefined;
  license:
    | {
        license: string | undefined;
        notice: string | undefined;
      }
    | undefined;
  source: {
    format: 'markdown' | 'yaml' | 'json' | 'package';
    version: string | undefined;
    path: string | undefined;
  };
  extensions: Record<string, unknown> | undefined;
}>;
export declare function validateNormalizedSkill(
  value: unknown,
): Result<NormalizedSkill, Diagnostic[]>;
export declare function validateCapabilityRequirement(
  value: unknown,
): Result<CapabilityRequirement, Diagnostic[]>;
export interface PackageManifest {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
}
export interface SkillPackageResourceDirs {
  scripts: string[];
  references: string[];
  templates: string[];
  examples: string[];
  assets: string[];
  tests: string[];
}
export interface SkillPackageMeta {
  path: string;
  manifest?: PackageManifest;
  hasSkillMd: boolean;
  hasLicense: boolean;
  hasNotice: boolean;
  resourceDirs: SkillPackageResourceDirs;
  diagnostics: Diagnostic[];
}
export declare function validatePackageManifest(
  value: unknown,
): Result<PackageManifest, Diagnostic[]>;
export declare function migrateIRPackage(
  pkg: NormalizedSkill,
  targetVersion: IRVersion,
): Result<NormalizedSkill, Diagnostic[]>;
//# sourceMappingURL=index.d.ts.map
