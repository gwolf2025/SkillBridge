import type { Result, Diagnostic } from '../../core/src/index.js';
import type { Schema } from '../../schema/src/index.js';
import {
  stringSchema,
  numberSchema,
  booleanSchema,
  enumSchema,
  arraySchema,
  objectSchema,
  optionalSchema,
  validate,
} from '../../schema/src/index.js';

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
  | 'read-file-system-meta';

export type SourceFormat = 'markdown' | 'yaml' | 'json' | 'package';

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

// Schemas

const irVersionSchema = enumSchema(['0.1.0'] as const);

const capabilitySchema = enumSchema([
  'file-read',
  'file-write',
  'command-exec',
  'network-access',
  'env-read',
  'search-files',
  'search-web',
  'read-sensors',
  'http-get',
  'http-post',
  'process-spawn',
  'read-registry',
  'write-registry',
  'list-directory',
  'read-file-system-meta',
] as const);

const sourceFormatSchema = enumSchema(['markdown', 'yaml', 'json', 'package'] as const);

const skillIdentitySchema = objectSchema({
  name: stringSchema(),
  version: stringSchema({ pattern: /^\d+\.\d+\.\d+$/ }),
  description: optionalSchema(stringSchema()),
});

const invocationGuidanceSchema = objectSchema({
  instructions: stringSchema(),
  example: optionalSchema(stringSchema()),
});

const skillIOSchema = objectSchema({
  name: stringSchema(),
  description: optionalSchema(stringSchema()),
  type: stringSchema(),
  required: optionalSchema(booleanSchema()),
});

const skillResourceSchema = objectSchema({
  pattern: stringSchema(),
  description: optionalSchema(stringSchema()),
});

const skillScriptSchema = objectSchema({
  name: stringSchema(),
  command: stringSchema(),
  args: optionalSchema(arraySchema(stringSchema())),
});

const skillToolSchema = objectSchema({
  name: stringSchema(),
  description: optionalSchema(stringSchema()),
  inputSchema: optionalSchema(objectSchema({}) as Schema<Record<string, unknown>>),
});

const permissionSchema = objectSchema({
  resource: stringSchema(),
  actions: arraySchema(stringSchema()),
});

const environmentRequirementSchema = objectSchema({
  key: stringSchema(),
  description: optionalSchema(stringSchema()),
  required: optionalSchema(booleanSchema()),
});

const executionRequirementSchema = objectSchema({
  runtime: optionalSchema(stringSchema()),
  timeout: optionalSchema(numberSchema({ integer: true })),
  memory: optionalSchema(stringSchema({ pattern: /^\d+(MB|GB)$/ })),
});

const conversionStepSchema = objectSchema({
  adapter: stringSchema(),
  timestamp: stringSchema(),
  version: optionalSchema(stringSchema()),
});

const provenanceSchema = objectSchema({
  convertedAt: optionalSchema(stringSchema()),
  convertedBy: optionalSchema(stringSchema()),
  sourcePackage: optionalSchema(stringSchema()),
  history: optionalSchema(arraySchema(conversionStepSchema)),
});

const licenseMetadataSchema = objectSchema({
  license: optionalSchema(stringSchema()),
  notice: optionalSchema(stringSchema()),
});

const sourceMetadataSchema = objectSchema({
  format: sourceFormatSchema,
  version: optionalSchema(stringSchema()),
  path: optionalSchema(stringSchema()),
});

export const normalizedSkillSchema = objectSchema({
  irVersion: irVersionSchema,
  identity: skillIdentitySchema,
  invocation: optionalSchema(invocationGuidanceSchema),
  inputs: optionalSchema(arraySchema(skillIOSchema)),
  outputs: optionalSchema(arraySchema(skillIOSchema)),
  resources: optionalSchema(arraySchema(skillResourceSchema)),
  scripts: optionalSchema(arraySchema(skillScriptSchema)),
  capabilities: arraySchema(capabilitySchema),
  tools: optionalSchema(arraySchema(skillToolSchema)),
  permissions: arraySchema(permissionSchema),
  environment: optionalSchema(arraySchema(environmentRequirementSchema)),
  execution: optionalSchema(executionRequirementSchema),
  provenance: optionalSchema(provenanceSchema),
  license: optionalSchema(licenseMetadataSchema),
  source: sourceMetadataSchema,
  extensions: optionalSchema(objectSchema({}) as Schema<Record<string, unknown>>),
});

export function validateNormalizedSkill(value: unknown): Result<NormalizedSkill, Diagnostic[]> {
  return validate(normalizedSkillSchema, value);
}

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

const packageManifestSchema = objectSchema({
  name: optionalSchema(stringSchema()),
  version: optionalSchema(stringSchema()),
  description: optionalSchema(stringSchema()),
  author: optionalSchema(stringSchema()),
  license: optionalSchema(stringSchema()),
  scripts: optionalSchema(objectSchema({}) as Schema<Record<string, string>>),
  dependencies: optionalSchema(objectSchema({}) as Schema<Record<string, string>>),
});

export function validatePackageManifest(value: unknown): Result<PackageManifest, Diagnostic[]> {
  return validate(packageManifestSchema, value);
}

export function migrateIRPackage(
  pkg: NormalizedSkill,
  targetVersion: IRVersion,
): Result<NormalizedSkill, Diagnostic[]> {
  if (pkg.irVersion === targetVersion) {
    return { ok: true, value: pkg };
  }

  if (pkg.irVersion === '0.1.0' && targetVersion === '0.1.0') {
    return { ok: true, value: pkg };
  }

  return {
    ok: false,
    error: [
      {
        severity: 'error',
        message: `Migration from ${pkg.irVersion} to ${targetVersion} is not supported`,
        code: 'IR-001',
      },
    ],
  };
}
