import type { Result, Diagnostic } from '../../core/src/index.js';
import type { Capability, CapabilityRequirement, Permission } from '../../ir/src/index.js';

export type { Capability, Permission, CapabilityRequirement };

export { categorizePermission, summarizePermissions, inspectPermissions } from './inspection.js';
export type {
  PermissionCategory,
  PermissionSummary,
  PermissionComparison,
  ComparisonKind,
  PolicyDecision,
  PolicyHook,
  PermissionInspectionReport,
} from './inspection.js';

export type CompatibilityLevel =
  'native' | 'emulated' | 'missing' | 'degraded' | 'partial' | 'unknown';

export type CompatErrorCode = `COMPAT-${number}`;

export interface CapabilityComparison {
  capability: Capability;
  required: boolean;
  level: CompatibilityLevel;
  diagnostics?: Diagnostic[];
}

export interface CompatibilityReport {
  comparisons: CapabilityComparison[];
  overall: CompatibilityLevel;
  nativeCount: number;
  emulatedCount: number;
  missingCount: number;
  degradedCount: number;
  partialCount: number;
  unknownCount: number;
  semanticDegradations: SemanticDegradation[];
  missingResources: MissingResource[];
  assumptions: Assumption[];
  securityImpact?: SecurityImpactReport;
}

export interface SemanticDegradation {
  capability: Capability;
  originalBehavior: string;
  emulatedBehavior: string;
  impact: 'behavioral-change' | 'restricted' | 'approximated';
  diagnostics: Diagnostic[];
}

export interface MissingResource {
  capability: Capability;
  resource: string;
  requiredValue?: unknown;
  constraintValue?: unknown;
}

export interface Assumption {
  capability: Capability;
  assumption: string;
  justification?: string;
  risk: 'low' | 'medium' | 'high';
}

export interface SecurityImpactReport {
  preservedPermissions: Permission[];
  weakenedPermissions: WeakenedPermission[];
  addedPermissions: Permission[];
  removedPermissions: RemovedPermission[];
  diagnostics: Diagnostic[];
}

export interface WeakenedPermission {
  resource: string;
  requiredActions: string[];
  declaredActions: string[];
  missingActions: string[];
}

export interface RemovedPermission {
  resource: string;
  requiredActions: string[];
}

export interface TargetCapabilitySupport {
  capability: Capability;
  level: CompatibilityLevel;
  constraints?: Record<string, unknown>;
  description?: string;
  extensions?: Record<string, unknown>;
}

export interface TargetProfile {
  name: string;
  version: string;
  vendor: string;
  capabilities: TargetCapabilitySupport[];
  extensions?: Record<string, unknown>;
}

function matchPattern(value: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*') && value.startsWith(pattern.slice(0, -1))) return true;
  if (pattern.startsWith('*') && value.endsWith(pattern.slice(1))) return true;
  return value === pattern;
}

function checkParameterCompatibility(
  requirement: CapabilityRequirement,
  support: TargetCapabilitySupport,
): { compatible: boolean; diagnostics?: Diagnostic[] } {
  if (!requirement.parameters || Object.keys(requirement.parameters).length === 0) {
    return { compatible: true };
  }
  if (!support.constraints || Object.keys(support.constraints).length === 0) {
    return { compatible: true };
  }

  const diagnostics: Diagnostic[] = [];
  let allMatch = true;

  for (const [key, value] of Object.entries(requirement.parameters)) {
    if (!(key in support.constraints)) {
      diagnostics.push({
        severity: 'info',
        message: `parameter '${key}' is not constrained by target — allowed`,
        code: 'COMPAT-009',
        source: key,
      });
      continue;
    }
    const constraint = support.constraints[key];
    const stringVal = String(value);
    const stringConstraint = String(constraint);

    if (typeof value === 'string' && typeof constraint === 'string') {
      if (!matchPattern(stringVal, stringConstraint)) {
        diagnostics.push({
          severity: 'warning',
          message: `parameter '${key}' value '${stringVal}' exceeds target constraint '${stringConstraint}'`,
          code: 'COMPAT-008',
          source: key,
        });
        allMatch = false;
      }
    } else if (value !== constraint) {
      diagnostics.push({
        severity: 'warning',
        message: `parameter '${key}' value mismatch: required '${stringVal}', target supports '${stringConstraint}'`,
        code: 'COMPAT-007',
        source: key,
      });
      allMatch = false;
    }
  }

  return { compatible: allMatch, diagnostics: allMatch ? undefined : diagnostics };
}

function computeOverallLevel(comparisons: CapabilityComparison[]): CompatibilityLevel {
  if (comparisons.length === 0) return 'native';
  let hasMissing = false;
  let hasEmulated = false;
  let hasDegraded = false;
  let hasUnknown = false;
  let hasPartial = false;
  for (const c of comparisons) {
    if (c.level === 'missing') hasMissing = true;
    else if (c.level === 'emulated') hasEmulated = true;
    else if (c.level === 'degraded') hasDegraded = true;
    else if (c.level === 'unknown') hasUnknown = true;
    else if (c.level === 'partial') hasPartial = true;
  }
  if (hasMissing || hasDegraded || hasUnknown) {
    const allMissingOrUnknown = comparisons.every(
      (c) => c.level === 'missing' || c.level === 'unknown',
    );
    const allMissing = comparisons.every((c) => c.level === 'missing');
    if (allMissing) return 'missing';
    if (allMissingOrUnknown) return 'degraded';
    return 'degraded';
  }
  if (hasEmulated || hasPartial) return 'emulated';
  return 'native';
}

export function analyzeCompatibility(
  requirements: CapabilityRequirement[],
  target: TargetProfile,
): Result<CompatibilityReport, Diagnostic[]> {
  if (!Array.isArray(requirements)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'requirements must be an array',
          code: 'COMPAT-005',
        },
      ],
    };
  }
  if (!target || typeof target !== 'object') {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'target must be a valid TargetProfile',
          code: 'COMPAT-005',
        },
      ],
    };
  }

  if (!Array.isArray(target.capabilities)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'target.capabilities must be an array',
          code: 'COMPAT-005',
        },
      ],
    };
  }

  const supportMap = new Map<Capability, TargetCapabilitySupport>();
  for (const s of target.capabilities) {
    supportMap.set(s.capability, s);
  }

  const seen = new Set<Capability>();
  const comparisons: CapabilityComparison[] = [];
  const semanticDegradations: SemanticDegradation[] = [];
  const missingResources: MissingResource[] = [];
  const assumptions: Assumption[] = [];
  let nativeCount = 0;
  let emulatedCount = 0;
  let missingCount = 0;
  let degradedCount = 0;
  let partialCount = 0;
  let unknownCount = 0;

  for (const req of requirements) {
    if (seen.has(req.id)) continue;
    seen.add(req.id);

    const support = supportMap.get(req.id);

    if (!support) {
      missingCount++;
      comparisons.push({
        capability: req.id,
        required: req.required,
        level: 'missing',
        diagnostics: [
          {
            severity: 'warning',
            message: `capability '${req.id}' is required but not supported by target '${target.name}'`,
            code: 'COMPAT-011',
            source: req.id,
          },
        ],
      });
      continue;
    }

    if (support.level === 'missing') {
      missingCount++;
      comparisons.push({
        capability: req.id,
        required: req.required,
        level: 'missing',
        diagnostics: [
          {
            severity: 'warning',
            message: `capability '${req.id}' is explicitly unsupported by target '${target.name}'`,
            code: 'COMPAT-011',
            source: req.id,
          },
        ],
      });
      continue;
    }

    const paramCheck = checkParameterCompatibility(req, support);
    let level: CompatibilityLevel;
    const diags: Diagnostic[] = [...(paramCheck.diagnostics ?? [])];

    const isEmulated = support.level === 'emulated';
    const isPartial = support.level === 'partial';
    const isUnknown = support.level === 'unknown';

    if (isEmulated) {
      diags.push({
        severity: 'info',
        message: `capability '${req.id}' is emulated by target '${target.name}'`,
        code: 'COMPAT-010',
        source: req.id,
      });
    } else if (isPartial) {
      diags.push({
        severity: 'info',
        message: `capability '${req.id}' is partially supported by target '${target.name}'`,
        code: 'COMPAT-013',
        source: req.id,
      });
    }

    if (isUnknown) {
      unknownCount++;
      level = 'unknown';
      diags.push({
        severity: 'warning',
        message: `capability '${req.id}' has unknown support level in target '${target.name}'`,
        code: 'COMPAT-012',
        source: req.id,
      });
    } else if (!paramCheck.compatible) {
      degradedCount++;
      level = 'degraded';
    } else if (isEmulated) {
      emulatedCount++;
      level = 'emulated';
    } else if (isPartial) {
      partialCount++;
      level = 'partial';
    } else {
      nativeCount++;
      level = 'native';
    }

    comparisons.push({
      capability: req.id,
      required: req.required,
      level,
      diagnostics: diags.length > 0 ? diags : undefined,
    });

    if (isEmulated && level !== 'degraded') {
      semanticDegradations.push({
        capability: req.id,
        originalBehavior: `native ${req.id}`,
        emulatedBehavior: `emulated ${req.id} via target '${target.name}'`,
        impact: 'restricted',
        diagnostics: diags.filter((d) => d.code === 'COMPAT-010'),
      });
    }

    if (!paramCheck.compatible && req.parameters) {
      for (const [key, value] of Object.entries(req.parameters)) {
        if (support.constraints && key in support.constraints) {
          missingResources.push({
            capability: req.id,
            resource: key,
            requiredValue: value,
            constraintValue: support.constraints[key],
          });
        }
      }
    }

    if (support.constraints) {
      const reqParams = req.parameters ?? {};
      for (const [key] of Object.entries(support.constraints)) {
        if (!(key in reqParams)) {
          assumptions.push({
            capability: req.id,
            assumption: `parameter '${key}' defaults to '${String(support.constraints[key])}'`,
            justification: `target constrains '${key}' but requirement does not specify it`,
            risk: 'low',
          });
        }
      }
    }
  }

  const overall = computeOverallLevel(comparisons);

  return {
    ok: true,
    value: {
      comparisons,
      overall,
      nativeCount,
      emulatedCount,
      missingCount,
      degradedCount,
      partialCount,
      unknownCount,
      semanticDegradations,
      missingResources,
      assumptions,
    },
  };
}

export function compareCapabilities(
  required: Capability[],
  declared: Capability[],
): Result<CompatibilityReport, Diagnostic[]>;
export function compareCapabilities(
  required: CapabilityRequirement[],
  target: TargetProfile,
): Result<CompatibilityReport, Diagnostic[]>;
export function compareCapabilities(
  required: Capability[] | CapabilityRequirement[],
  declaredOrTarget: Capability[] | TargetProfile,
): Result<CompatibilityReport, Diagnostic[]> {
  if (Array.isArray(required) && required.length > 0 && typeof required[0] === 'object') {
    return analyzeCompatibility(
      required as CapabilityRequirement[],
      declaredOrTarget as TargetProfile,
    );
  }

  const declared = declaredOrTarget as Capability[];
  if (!Array.isArray(required) || !Array.isArray(declared)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'required and declared must be arrays',
          code: 'COMPAT-005',
        },
      ],
    };
  }

  const declaredSet = new Set(declared);
  const seen = new Set<Capability>();
  const comparisons: CapabilityComparison[] = [];

  for (const cap of required as Capability[]) {
    if (seen.has(cap)) continue;
    seen.add(cap);

    const level: CompatibilityLevel = declaredSet.has(cap) ? 'native' : 'missing';
    const diagnostics: Diagnostic[] | undefined =
      level === 'missing'
        ? [
            {
              severity: 'warning',
              message: `capability '${cap}' is required but not declared`,
              code: 'COMPAT-001',
            },
          ]
        : undefined;

    comparisons.push({ capability: cap, required: true, level, diagnostics });
  }

  const nativeCount = comparisons.filter((c) => c.level === 'native').length;
  const missingCount = comparisons.filter((c) => c.level === 'missing').length;

  let overall: CompatibilityLevel;
  if (missingCount === 0) {
    overall = 'native';
  } else if (missingCount === comparisons.length) {
    overall = 'missing';
  } else {
    overall = 'degraded';
  }

  return {
    ok: true,
    value: {
      comparisons,
      overall,
      nativeCount,
      emulatedCount: 0,
      missingCount,
      degradedCount: 0,
      partialCount: 0,
      unknownCount: 0,
      semanticDegradations: [],
      missingResources: [],
      assumptions: [],
    },
  };
}

function actionsMatch(
  required: string[],
  declared: string[],
): {
  allPresent: boolean;
  missing: string[];
} {
  if (declared.includes('*')) return { allPresent: true, missing: [] };
  if (required.includes('*')) {
    const missing = declared.length === 0 ? ['*'] : [];
    return { allPresent: missing.length === 0, missing };
  }
  const missing = required.filter((a) => !declared.includes(a));
  return { allPresent: missing.length === 0, missing };
}

export function assessSecurityImpact(
  requiredPermissions: Permission[],
  declaredPermissions: Permission[],
): Result<SecurityImpactReport, Diagnostic[]> {
  if (!Array.isArray(requiredPermissions) || !Array.isArray(declaredPermissions)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'requiredPermissions and declaredPermissions must be arrays',
          code: 'COMPAT-005',
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const preservedPermissions: Permission[] = [];
  const weakenedPermissions: WeakenedPermission[] = [];
  const addedPermissions: Permission[] = [];
  const removedPermissions: RemovedPermission[] = [];

  const declaredMap = new Map<string, string[]>();
  for (const perm of declaredPermissions) {
    declaredMap.set(perm.resource, perm.actions);
  }

  const requiredMap = new Map<string, string[]>();
  for (const perm of requiredPermissions) {
    requiredMap.set(perm.resource, perm.actions);
  }

  for (const req of requiredPermissions) {
    const declaredActions = declaredMap.get(req.resource);

    if (declaredActions === undefined) {
      removedPermissions.push({
        resource: req.resource,
        requiredActions: [...req.actions],
      });
      diagnostics.push({
        severity: 'warning',
        message: `permission for resource '${req.resource}' is required but not declared`,
        code: 'COMPAT-002',
      });
      continue;
    }

    const { allPresent, missing } = actionsMatch(req.actions, declaredActions);

    if (allPresent) {
      preservedPermissions.push({ resource: req.resource, actions: [...declaredActions] });
      const extra = declaredActions.filter((a) => !req.actions.includes(a) && a !== '*');
      if (extra.length > 0) {
        diagnostics.push({
          severity: 'info',
          message: `permission for resource '${req.resource}' has extra declared actions: ${extra.join(', ')}`,
          code: 'COMPAT-006',
        });
      }
    } else {
      weakenedPermissions.push({
        resource: req.resource,
        requiredActions: [...req.actions],
        declaredActions: [...declaredActions],
        missingActions: missing,
      });
      diagnostics.push({
        severity: 'warning',
        message: `permission for resource '${req.resource}' is weakened: missing actions ${missing.join(', ')}`,
        code: 'COMPAT-003',
      });
    }
  }

  for (const decl of declaredPermissions) {
    if (!requiredMap.has(decl.resource)) {
      addedPermissions.push({ resource: decl.resource, actions: [...decl.actions] });
      diagnostics.push({
        severity: 'info',
        message: `permission for resource '${decl.resource}' is declared but not required`,
        code: 'COMPAT-004',
      });
    }
  }

  return {
    ok: true,
    value: {
      preservedPermissions,
      weakenedPermissions,
      addedPermissions,
      removedPermissions,
      diagnostics,
    },
  };
}

export class CompatibilityReportFormatter {
  toJSON(report: CompatibilityReport): object {
    return {
      overall: report.overall,
      counts: {
        native: report.nativeCount,
        emulated: report.emulatedCount,
        missing: report.missingCount,
        degraded: report.degradedCount,
        partial: report.partialCount,
        unknown: report.unknownCount,
      },
      comparisons: report.comparisons.map((c) => ({
        capability: c.capability,
        required: c.required,
        level: c.level,
        diagnostics: c.diagnostics ?? [],
      })),
      semanticDegradations: report.semanticDegradations.map((d) => ({
        capability: d.capability,
        originalBehavior: d.originalBehavior,
        emulatedBehavior: d.emulatedBehavior,
        impact: d.impact,
        diagnostics: d.diagnostics,
      })),
      missingResources: report.missingResources.map((r) => ({
        capability: r.capability,
        resource: r.resource,
        requiredValue: r.requiredValue,
        constraintValue: r.constraintValue,
      })),
      assumptions: report.assumptions.map((a) => ({
        capability: a.capability,
        assumption: a.assumption,
        justification: a.justification,
        risk: a.risk,
      })),
      securityImpact: report.securityImpact
        ? {
            preservedPermissions: report.securityImpact.preservedPermissions,
            weakenedPermissions: report.securityImpact.weakenedPermissions,
            addedPermissions: report.securityImpact.addedPermissions,
            removedPermissions: report.securityImpact.removedPermissions,
            diagnostics: report.securityImpact.diagnostics,
          }
        : undefined,
    };
  }

  toText(report: CompatibilityReport): string {
    const lines: string[] = [];
    lines.push(`Compatibility Report — Overall: ${report.overall}`);
    lines.push('');

    const header =
      'Capability'.padEnd(24) + 'Required'.padEnd(10) + 'Level'.padEnd(12) + 'Diagnostics';
    lines.push(header);
    lines.push('-'.repeat(header.length));

    for (const c of report.comparisons) {
      const diags = c.diagnostics ?? [];
      lines.push(
        `${c.capability.padEnd(24)}${String(c.required).padEnd(10)}${c.level.padEnd(12)}${diags.length > 0 ? `${diags.length} diagnostic(s)` : ''}`,
      );
      for (const d of diags) {
        lines.push(`  ${' '.repeat(34)}[${d.code}] ${d.message}`);
      }
    }

    lines.push('');
    lines.push(
      `Counts: ${report.nativeCount} native, ${report.emulatedCount} emulated, ${report.missingCount} missing, ${report.degradedCount} degraded, ${report.partialCount} partial, ${report.unknownCount} unknown`,
    );

    if (report.semanticDegradations.length > 0) {
      lines.push('');
      lines.push('Semantic Degradations:');
      for (const d of report.semanticDegradations) {
        lines.push(
          `  - ${d.capability}: ${d.originalBehavior} → ${d.emulatedBehavior} (${d.impact})`,
        );
      }
    }

    if (report.missingResources.length > 0) {
      lines.push('');
      lines.push('Missing Resources:');
      for (const r of report.missingResources) {
        lines.push(
          `  - ${r.capability}/${r.resource}: required ${JSON.stringify(r.requiredValue)}, target ${JSON.stringify(r.constraintValue)}`,
        );
      }
    }

    if (report.assumptions.length > 0) {
      lines.push('');
      lines.push('Assumptions:');
      for (const a of report.assumptions) {
        lines.push(
          `  - ${a.capability}: ${a.assumption} (risk: ${a.risk})${a.justification ? ` — ${a.justification}` : ''}`,
        );
      }
    }

    if (report.securityImpact) {
      lines.push('');
      lines.push('Security Impact:');
      for (const p of report.securityImpact.preservedPermissions) {
        lines.push(`  + preserved: ${p.resource} [${p.actions.join(', ')}]`);
      }
      for (const p of report.securityImpact.weakenedPermissions) {
        lines.push(`  - weakened: ${p.resource} (missing: ${p.missingActions.join(', ')})`);
      }
      for (const p of report.securityImpact.addedPermissions) {
        lines.push(`  + added: ${p.resource} [${p.actions.join(', ')}]`);
      }
      for (const p of report.securityImpact.removedPermissions) {
        lines.push(`  - removed: ${p.resource}`);
      }
    }

    return lines.join('\n');
  }
}

export function generateCompatibilityReport(
  requirements: CapabilityRequirement[],
  target: TargetProfile,
  requiredPermissions?: Permission[],
  declaredPermissions?: Permission[],
): Result<CompatibilityReport, Diagnostic[]> {
  const compatResult = analyzeCompatibility(requirements, target);
  if (!compatResult.ok) {
    return { ok: false, error: compatResult.error };
  }

  const report: CompatibilityReport = compatResult.value;

  if (requiredPermissions && declaredPermissions) {
    const securityResult = assessSecurityImpact(requiredPermissions, declaredPermissions);
    if (securityResult.ok) {
      report.securityImpact = securityResult.value;
    } else {
      return { ok: false, error: securityResult.error };
    }
  }

  return { ok: true, value: report };
}
