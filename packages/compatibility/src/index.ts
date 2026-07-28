import type { Result, Diagnostic } from '../../core/src/index.js';
import type { Capability, Permission } from '../../ir/src/index.js';

export type { Capability, Permission };

export type CompatibilityLevel = 'native' | 'emulated' | 'missing' | 'degraded';

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

export function compareCapabilities(
  required: Capability[],
  declared: Capability[],
): Result<CompatibilityReport, Diagnostic[]> {
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

  for (const cap of required) {
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
