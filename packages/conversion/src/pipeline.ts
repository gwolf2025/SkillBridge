import type {
  Adapter,
  AdapterSelector,
  Result,
  Diagnostic,
  NormalizedSkill,
} from '../../adapter-sdk/src/index.js';
import { createConversionContext } from '../../adapter-sdk/src/index.js';
import type { CompilationManifest, CapabilityRequirement, Permission } from '../../ir/src/index.js';
import { analyzeCompatibility, assessSecurityImpact } from '../../compatibility/src/index.js';
import type {
  CompatibilityReport,
  SecurityImpactReport,
  TargetProfile,
  TargetCapabilitySupport,
  CompatibilityLevel,
} from '../../compatibility/src/index.js';
import { normalizePackageToIR } from './normalize.js';
import type { FieldProvenance } from './normalize.js';

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

export type PolicyMode = 'strict' | 'safe' | 'permissive';

export interface PolicyDecision {
  type:
    'degradation' | 'missing-resource' | 'assumption' | 'security-impact' | 'unknown-capability';
  action: 'allow' | 'warn' | 'block';
  detail: string;
  diagnostic?: Diagnostic;
}

export interface PolicyResult {
  policy: PolicyMode;
  blocked: boolean;
  decisions: PolicyDecision[];
}

export interface ConversionResult {
  output: unknown;
  diagnostics: Diagnostic[];
  compatibility: CompatibilityReport | null;
  securityImpact: SecurityImpactReport | null;
  provenance: ConversionProvenance;
  manifest: CompilationManifest | null;
  policyResult: PolicyResult | null;
  fieldProvenances: FieldProvenance[];
}

export interface ConversionOptions {
  sourceAdapterName?: string;
  targetAdapterName?: string;
  policy?: PolicyMode;
  options?: Record<string, unknown>;
}

function policyDecision(
  type: PolicyDecision['type'],
  action: PolicyDecision['action'],
  detail: string,
  diagnostic?: Diagnostic,
): PolicyDecision {
  return { type, action, detail, diagnostic };
}

function capabilityAction(
  level: CompatibilityLevel,
  policy: PolicyMode,
): 'allow' | 'warn' | 'block' {
  if (policy === 'strict') {
    return level === 'native' ? 'allow' : 'block';
  }
  if (policy === 'safe') {
    if (level === 'native' || level === 'emulated') return 'allow';
    return 'warn';
  }
  return 'allow';
}

function securityAction(policy: PolicyMode): 'allow' | 'warn' | 'block' {
  if (policy === 'strict' || policy === 'safe') return 'block';
  return 'warn';
}

function resourceAction(policy: PolicyMode): 'allow' | 'warn' | 'block' {
  if (policy === 'strict') return 'block';
  return 'warn';
}

function applyPolicy(
  report: CompatibilityReport | null,
  securityImpact: SecurityImpactReport | null,
  policy: PolicyMode,
): PolicyResult {
  const decisions: PolicyDecision[] = [];
  let blocked = false;

  if (report) {
    for (const c of report.comparisons) {
      const action = capabilityAction(c.level, policy);
      const type = c.level === 'unknown' ? 'unknown-capability' : 'degradation';
      const detail =
        c.level === 'emulated'
          ? `capability '${c.capability}' is emulated by target`
          : c.level === 'missing'
            ? `capability '${c.capability}' is missing in target`
            : c.level === 'degraded'
              ? `capability '${c.capability}' is degraded in target`
              : c.level === 'partial'
                ? `capability '${c.capability}' is partially supported by target`
                : c.level === 'unknown'
                  ? `capability '${c.capability}' has unknown support level in target`
                  : `capability '${c.capability}' is ${c.level}`;

      if (action !== 'allow' || c.level !== 'native') {
        decisions.push(policyDecision(type, action, detail, c.diagnostics?.[0]));
        if (action === 'block') blocked = true;
      }
    }

    for (const r of report.missingResources) {
      const action = resourceAction(policy);
      decisions.push(
        policyDecision(
          'missing-resource',
          action,
          `resource '${r.resource}' for capability '${r.capability}' is missing in target`,
        ),
      );
      if (action === 'block') blocked = true;
    }
  }

  if (securityImpact) {
    for (const w of securityImpact.weakenedPermissions) {
      const action = securityAction(policy);
      decisions.push(
        policyDecision(
          'security-impact',
          action,
          `permission for resource '${w.resource}' is weakened: missing actions ${w.missingActions.join(', ')}`,
        ),
      );
      if (action === 'block') blocked = true;
    }
    for (const r of securityImpact.removedPermissions) {
      const action = securityAction(policy);
      decisions.push(
        policyDecision(
          'security-impact',
          action,
          `permission for resource '${r.resource}' is required but not declared`,
        ),
      );
      if (action === 'block') blocked = true;
    }
  }

  return { policy, blocked, decisions };
}

function generateManifest(compiled: unknown, compiledBy: string): CompilationManifest {
  const checksums: Record<string, string> = {};
  const files: string[] = [];
  const metadata: Record<string, unknown> = {};

  if (compiled && typeof compiled === 'object' && !Array.isArray(compiled)) {
    const obj = compiled as Record<string, unknown>;
    if (Array.isArray(obj.files)) {
      for (const f of obj.files) {
        if (typeof f === 'string') {
          files.push(f);
          checksums[f] = '';
        }
      }
    }
    if (obj.metadata && typeof obj.metadata === 'object') {
      Object.assign(metadata, obj.metadata as Record<string, unknown>);
    }
  }

  return { files, checksums, metadata, compiledAt: new Date().toISOString(), compiledBy };
}

function buildTargetProfile(adapter: Adapter): TargetProfile {
  const extensions = adapter.manifest.extensions ?? {};
  const capabilitySupport: TargetCapabilitySupport[] = Array.isArray(extensions.capabilitySupport)
    ? (extensions.capabilitySupport as TargetCapabilitySupport[])
    : [];

  return {
    name: adapter.manifest.name,
    version: adapter.manifest.version,
    vendor: adapter.manifest.vendor,
    capabilities: capabilitySupport,
  };
}

function buildRequirements(skill: NormalizedSkill): CapabilityRequirement[] {
  return (skill.capabilities ?? []).map((id) => ({ id, required: true }));
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
    options?: ConversionOptions,
  ): Result<ConversionResult, Diagnostic[]> {
    const startedAt = new Date().toISOString();
    const diagnostics: Diagnostic[] = [];
    const fieldProvenances: FieldProvenance[] = [];
    const rawPolicy: string | undefined = options?.policy;
    let policy: PolicyMode = 'safe';

    if (rawPolicy === 'relaxed') {
      diagnostics.push({
        severity: 'error',
        message: `'relaxed' policy is no longer supported — use 'safe' (default) or 'permissive'`,
        code: 'CONV-012',
        source: 'policy',
      });
    } else if (rawPolicy === 'strict' || rawPolicy === 'safe' || rawPolicy === 'permissive') {
      policy = rawPolicy;
    }

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
    const recordStep = (name: string, adapter: Adapter): void => {
      steps.push({
        step: name,
        adapter: adapter.manifest.name,
        timestamp: new Date().toISOString(),
      });
    };

    let parsed: unknown;
    try {
      parsed = sourceAdapter.parse(source);
      recordStep('parse', sourceAdapter);
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `parse failed: ${e instanceof Error ? e.message : String(e)}`,
        code: 'ADAPTER-002',
        source: `adapter:${sourceAdapter.manifest.name}`,
      });
      return { ok: false, error: diagnostics };
    }

    let normalizedSkill: NormalizedSkill | undefined;
    if (sourceAdapter.normalize) {
      try {
        normalizedSkill = sourceAdapter.normalize(source, parsed);
        recordStep('normalize', sourceAdapter);
        diagnostics.push({
          severity: 'info',
          message: `adapter normalize completed`,
          code: 'CONV-007',
          source: `adapter:${sourceAdapter.manifest.name}`,
        });
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

    if (
      parsed &&
      typeof parsed === 'object' &&
      'frontmatter' in (parsed as Record<string, unknown>)
    ) {
      try {
        const fmParsed = parsed as {
          frontmatter: Record<string, unknown>;
          sections: Array<{ heading: string; body: string }>;
        };
        const normResult = normalizePackageToIR({
          skillMd: fmParsed,
          packagePath: '',
          resourceDirs: {
            scripts: [],
            references: [],
            templates: [],
            examples: [],
            assets: [],
            tests: [],
          },
        });
        fieldProvenances.push(...normResult.provenances);
        for (const d of normResult.diagnostics) {
          if (!diagnostics.some((existing) => existing.message === d.message)) {
            diagnostics.push(d);
          }
        }
        if (!normalizedSkill) {
          normalizedSkill = normResult.normalized;
        }
      } catch {
        // best-effort provenance extraction
      }
    }

    const skill: NormalizedSkill | undefined = normalizedSkill;

    let compatibility: CompatibilityReport | null = null;
    let securityImpact: SecurityImpactReport | null = null;

    if (skill) {
      const targetProfile = buildTargetProfile(targetAdapter);
      const requirements = buildRequirements(skill);

      if (requirements.length > 0) {
        const compatResult = analyzeCompatibility(requirements, targetProfile);
        if (compatResult.ok) {
          compatibility = compatResult.value;
          for (const c of compatibility.comparisons) {
            if (c.diagnostics) {
              diagnostics.push(...c.diagnostics);
            }
          }
        } else {
          diagnostics.push(...compatResult.error);
        }
        recordStep('analyze', sourceAdapter);
      }

      const requiredPermissions = skill.permissions ?? [];
      const declaredPermissions: Permission[] = Array.isArray(
        targetAdapter.manifest.extensions?.declaredPermissions,
      )
        ? (targetAdapter.manifest.extensions.declaredPermissions as Permission[])
        : [];

      if (requiredPermissions.length > 0 || declaredPermissions.length > 0) {
        const securityResult = assessSecurityImpact(requiredPermissions, declaredPermissions);
        if (securityResult.ok) {
          securityImpact = securityResult.value;
          diagnostics.push(...securityImpact.diagnostics);
        } else {
          diagnostics.push(...securityResult.error);
        }
      }
    }

    const policyResult = applyPolicy(compatibility, securityImpact, policy);

    for (const d of policyResult.decisions) {
      if (d.diagnostic && d.action !== 'block') {
        diagnostics.push(d.diagnostic);
      }
    }

    if (policyResult.blocked) {
      diagnostics.push({
        severity: 'error',
        message: 'conversion blocked by policy',
        code: 'CONV-010',
        source: 'policy',
      });
      for (const d of policyResult.decisions) {
        if (d.action === 'block' && d.diagnostic) {
          diagnostics.push(d.diagnostic);
        }
      }
      return { ok: false, error: diagnostics };
    }

    createConversionContext(source, parsed, sourceAdapter.manifest, {
      irPackage: skill,
      extra: options?.options,
    });

    let compiled: unknown;
    try {
      compiled = targetAdapter.compile(parsed);
      recordStep('compile', targetAdapter);
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `compile failed: ${e instanceof Error ? e.message : String(e)}`,
        code: 'ADAPTER-002',
        source: `adapter:${targetAdapter.manifest.name}`,
      });
      return { ok: false, error: diagnostics };
    }

    const manifest = generateManifest(compiled, targetAdapter.manifest.name);

    if (targetAdapter.verify) {
      try {
        const verifyContext = createConversionContext(source, parsed, targetAdapter.manifest, {
          irPackage: skill,
          extra: options?.options,
        });
        const verifyResult = targetAdapter.verify(verifyContext);
        if (verifyResult.ok) {
          recordStep('verify', targetAdapter);
          if (!verifyResult.value) {
            diagnostics.push({
              severity: 'warning',
              message: 'output verification failed',
              code: 'CONV-011',
              source: `adapter:${targetAdapter.manifest.name}`,
            });
          }
        } else {
          diagnostics.push(...verifyResult.error);
        }
      } catch (e) {
        diagnostics.push({
          severity: 'warning',
          message: `verify failed: ${e instanceof Error ? e.message : String(e)}`,
          code: 'ADAPTER-002',
          source: `adapter:${targetAdapter.manifest.name}`,
        });
      }
    }

    return {
      ok: true,
      value: {
        output: compiled,
        diagnostics,
        compatibility,
        securityImpact,
        provenance: {
          sourceFormat,
          targetFormat,
          sourceAdapter: sourceAdapter.manifest.name,
          targetAdapter: targetAdapter.manifest.name,
          steps,
          startedAt,
        },
        manifest,
        policyResult,
        fieldProvenances,
      },
    };
  }
}
