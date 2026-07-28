import * as yaml from 'js-yaml';
import type { Diagnostic, SourceLocation } from '../../core/src/index.js';
import type {
  NormalizedSkill,
  PackageManifest,
  SkillPackageResourceDirs,
  InvocationGuidance,
  SkillIO,
  SkillResource,
  SkillScript,
  SkillTool,
  Permission,
  EnvironmentRequirement,
  ExecutionRequirement,
  LicenseMetadata,
  Capability,
} from '../../ir/src/index.js';
import type { SkillMdResult, SkillMdSection } from '../../parser/src/index.js';

export type FieldSource = 'frontmatter' | 'body-section' | 'skillbridge-yaml' | 'default';

export interface FieldProvenance {
  field: string;
  source: FieldSource;
  location?: SourceLocation;
}

export interface NormalizationInput {
  skillMd: SkillMdResult;
  manifest?: PackageManifest;
  rawYamlRecord?: Record<string, unknown>;
  resourceDirs: SkillPackageResourceDirs;
  packagePath: string;
}

export interface NormalizationResult {
  normalized: NormalizedSkill;
  provenances: FieldProvenance[];
  diagnostics: Diagnostic[];
}

type ConvCode = `CONV-${number}`;

const CODES = {
  CONFLICT: 'CONV-001' as ConvCode,
  OVERWRITE: 'CONV-002' as ConvCode,
  UNRECOGNIZED_SECTION: 'CONV-003' as ConvCode,
  MALFORMED_BODY_YAML: 'CONV-004' as ConvCode,
  UNKNOWN_SB_FIELD: 'CONV-005' as ConvCode,
  MISSING_REQUIRED: 'CONV-006' as ConvCode,
} as const;

const TEXT_SECTION_HEADINGS = new Set(['Description', 'Usage']);

const SB_YAML_IDENTITY_FIELDS = new Set(['name', 'version', 'description']);

const SB_YAML_META_FIELDS = new Set(['author', 'license', 'scripts', 'dependencies']);

function buildProvenance(
  field: string,
  source: FieldSource,
  section?: SkillMdSection,
): FieldProvenance {
  const entry: FieldProvenance = { field, source };
  if (section?.location) {
    entry.location = section.location;
  }
  return entry;
}

export function normalizePackageToIR(input: NormalizationInput): NormalizationResult {
  const diagnostics: Diagnostic[] = [];
  const provenances: FieldProvenance[] = [];
  const fm = input.skillMd.frontmatter;
  const sections = input.skillMd.sections;
  const skillMdExtensions = input.skillMd.extensions;
  const ext: Record<string, unknown> = {};
  const manifest = input.manifest;
  const rawYamlRecord = input.rawYamlRecord;

  const identity: { name: string; version: string; description?: string } = {
    name: '',
    version: '',
  };

  if (typeof fm.name === 'string' && fm.name) {
    identity.name = fm.name;
    provenances.push(buildProvenance('identity.name', 'frontmatter'));
  }
  if (typeof fm.version === 'string' && fm.version) {
    identity.version = fm.version;
    provenances.push(buildProvenance('identity.version', 'frontmatter'));
  }
  if (typeof fm.description === 'string' && fm.description) {
    identity.description = fm.description;
    provenances.push(buildProvenance('identity.description', 'frontmatter'));
  }

  if (manifest) {
    for (const f of SB_YAML_IDENTITY_FIELDS) {
      const val = (manifest as Record<string, unknown>)[f];
      if (val !== undefined) {
        const identityField = f === 'description' ? 'description' : f;
        const irField = `identity.${identityField}`;
        const existing = (identity as Record<string, unknown>)[identityField];
        if (existing !== undefined && existing !== '' && existing !== val) {
          diagnostics.push({
            severity: 'warning',
            message: `'${f}' from skillbridge.yaml (${String(val)}) overwritten by frontmatter value (${String(existing)})`,
            code: CODES.OVERWRITE,
            source: f,
          });
        }
        if (!existing || existing === '') {
          (identity as Record<string, unknown>)[identityField] = val;
          provenances.push(buildProvenance(irField, 'skillbridge-yaml'));
        }
      }
    }
  }

  if (!identity.name) {
    diagnostics.push({
      severity: 'error',
      message: 'missing required field: identity.name',
      code: CODES.MISSING_REQUIRED,
      source: 'name',
    });
  }
  if (!identity.version) {
    diagnostics.push({
      severity: 'error',
      message: 'missing required field: identity.version',
      code: CODES.MISSING_REQUIRED,
      source: 'version',
    });
  }

  let invocation: InvocationGuidance | undefined;

  let inputs: SkillIO[] | undefined;
  let outputs: SkillIO[] | undefined;
  let resources: SkillResource[] | undefined;
  let environment: EnvironmentRequirement[] | undefined;
  let execution: ExecutionRequirement | undefined;

  for (const section of sections) {
    const heading = section.heading;
    const body = section.body;

    if (heading === 'Description') {
      if (body) {
        invocation = { ...(invocation ?? {}), instructions: body } as InvocationGuidance;
        provenances.push(buildProvenance('invocation.instructions', 'body-section', section));
      }
    } else if (heading === 'Usage') {
      if (body) {
        invocation = { ...(invocation ?? {}), example: body } as InvocationGuidance;
        provenances.push(buildProvenance('invocation.example', 'body-section', section));
      }
    } else if (TEXT_SECTION_HEADINGS.has(heading)) {
      continue;
    } else if (
      heading === 'Inputs' ||
      heading === 'Outputs' ||
      heading === 'Resources' ||
      heading === 'Environment'
    ) {
      if (body) {
        try {
          const parsed = yaml.load(body);
          if (Array.isArray(parsed)) {
            if (heading === 'Inputs') {
              inputs = parsed as SkillIO[];
            } else if (heading === 'Outputs') {
              outputs = parsed as SkillIO[];
            } else if (heading === 'Resources') {
              resources = parsed as SkillResource[];
            } else if (heading === 'Environment') {
              environment = parsed as EnvironmentRequirement[];
            }
            provenances.push(
              buildProvenance(
                heading === 'Inputs'
                  ? 'inputs'
                  : heading === 'Outputs'
                    ? 'outputs'
                    : heading === 'Resources'
                      ? 'resources'
                      : 'environment',
                'body-section',
                section,
              ),
            );
          } else {
            diagnostics.push({
              severity: 'warning',
              message: `'${heading}' section body must be a YAML list`,
              code: CODES.MALFORMED_BODY_YAML,
              source: heading,
              location: section.location,
            });
          }
        } catch (err: unknown) {
          diagnostics.push({
            severity: 'warning',
            message: `malformed YAML in '${heading}' section: ${err instanceof Error ? err.message : String(err)}`,
            code: CODES.MALFORMED_BODY_YAML,
            source: heading,
            location: section.location,
          });
        }
      }
    } else if (heading === 'Execution') {
      if (body) {
        try {
          const parsed = yaml.load(body);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            execution = parsed as ExecutionRequirement;
            provenances.push(buildProvenance('execution', 'body-section', section));
          } else {
            diagnostics.push({
              severity: 'warning',
              message: `'${heading}' section body must be a YAML mapping`,
              code: CODES.MALFORMED_BODY_YAML,
              source: heading,
              location: section.location,
            });
          }
        } catch (err: unknown) {
          diagnostics.push({
            severity: 'warning',
            message: `malformed YAML in '${heading}' section: ${err instanceof Error ? err.message : String(err)}`,
            code: CODES.MALFORMED_BODY_YAML,
            source: heading,
            location: section.location,
          });
        }
      }
    } else {
      diagnostics.push({
        severity: 'info',
        message: `unrecognized section '${heading}' — stored in extensions`,
        code: CODES.UNRECOGNIZED_SECTION,
        source: heading,
        location: section.location,
      });
      try {
        const parsed = yaml.load(body);
        ext[heading] = parsed;
      } catch {
        ext[heading] = body;
      }
      provenances.push(buildProvenance(`extensions.${heading}`, 'body-section', section));
    }
  }

  if (skillMdExtensions) {
    for (const [key, value] of Object.entries(skillMdExtensions)) {
      ext[key] = value;
      provenances.push(buildProvenance(`extensions.${key}`, 'frontmatter'));
    }
  }

  if (manifest) {
    // manifest only contains known fields; unknown-field detection uses rawYamlRecord below
  }

  if (rawYamlRecord) {
    for (const key of Object.keys(rawYamlRecord)) {
      if (!SB_YAML_IDENTITY_FIELDS.has(key) && !SB_YAML_META_FIELDS.has(key)) {
        diagnostics.push({
          severity: 'info',
          message: `unrecognized skillbridge.yaml field '${key}' — stored in extensions`,
          code: CODES.UNKNOWN_SB_FIELD,
          source: key,
        });
        const sbExt = (ext.skillbridge as Record<string, unknown>) ?? {};
        sbExt[key] = rawYamlRecord[key];
        ext.skillbridge = sbExt;
        provenances.push(buildProvenance(`extensions.skillbridge.${key}`, 'skillbridge-yaml'));
      }
    }
  }

  const fmCapabilities = fm.capabilities;
  const capabilities: Capability[] = Array.isArray(fmCapabilities)
    ? (fmCapabilities as Capability[])
    : [];
  if (capabilities.length > 0) {
    provenances.push(buildProvenance('capabilities', 'frontmatter'));
  }

  const fmPermissions = fm.permissions;
  const permissions: Permission[] = Array.isArray(fmPermissions)
    ? (fmPermissions as Permission[])
    : [];
  if (permissions.length > 0) {
    provenances.push(buildProvenance('permissions', 'frontmatter'));
  }

  const fmTools = fm.tools;
  const tools: SkillTool[] | undefined = Array.isArray(fmTools)
    ? (fmTools as SkillTool[])
    : undefined;
  if (tools) {
    provenances.push(buildProvenance('tools', 'frontmatter'));
  }

  const fmScripts = fm.scripts;
  let scripts: SkillScript[] | undefined = Array.isArray(fmScripts)
    ? (fmScripts as SkillScript[])
    : undefined;
  if (scripts) {
    provenances.push(buildProvenance('scripts', 'frontmatter'));
  }

  if (manifest?.scripts) {
    const sbScripts = convertScripts(manifest.scripts);
    if (scripts) {
      if (JSON.stringify(scripts) !== JSON.stringify(sbScripts)) {
        diagnostics.push({
          severity: 'warning',
          message: 'scripts from skillbridge.yaml overwritten by frontmatter value',
          code: CODES.OVERWRITE,
          source: 'scripts',
        });
      }
    } else {
      scripts = sbScripts;
      provenances.push(buildProvenance('scripts', 'skillbridge-yaml'));
    }
  }

  if (!scripts) {
    scripts = undefined;
  }

  if (manifest?.dependencies) {
    ext.dependencies = manifest.dependencies;
    provenances.push(buildProvenance('extensions.dependencies', 'skillbridge-yaml'));
  }

  if (manifest?.author) {
    ext.author = manifest.author;
    provenances.push(buildProvenance('extensions.author', 'skillbridge-yaml'));
  }

  let license: LicenseMetadata | undefined;
  if (manifest?.license) {
    license = { license: manifest.license };
    provenances.push(buildProvenance('license.license', 'skillbridge-yaml'));
  }

  if (Object.keys(ext).length === 0) {
    delete (ext as Record<string, unknown>).extensions;
  }

  const normalized: NormalizedSkill = {
    irVersion: '0.1.0',
    identity: {
      name: identity.name || '',
      version: identity.version || '',
      ...(identity.description ? { description: identity.description } : {}),
    },
    capabilities: capabilities.length > 0 ? capabilities : [],
    permissions: permissions.length > 0 ? permissions : [],
    ...(tools ? { tools } : {}),
    ...(scripts ? { scripts } : {}),
    ...(inputs ? { inputs } : {}),
    ...(outputs ? { outputs } : {}),
    ...(resources ? { resources } : {}),
    ...(environment ? { environment } : {}),
    ...(execution ? { execution } : {}),
    ...(invocation ? { invocation } : {}),
    ...(license ? { license } : {}),
    ...(Object.keys(ext).length > 0 ? { extensions: ext } : {}),
    source: {
      format: 'markdown',
      path: input.packagePath,
    },
  };

  return {
    normalized,
    provenances,
    diagnostics,
  };
}

function convertScripts(sbScripts: Record<string, string>): SkillScript[] {
  return Object.entries(sbScripts).map(([name, command]) => ({
    name,
    command,
  }));
}
