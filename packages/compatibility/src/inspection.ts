import type { Diagnostic } from '@skillbridge/core';
import type { NormalizedSkill, Permission, Provenance } from '@skillbridge/ir';

export type PermissionCategory =
  | 'filesystem'
  | 'shell'
  | 'network'
  | 'secrets'
  | 'script'
  | 'subprocess'
  | 'external-tool'
  | 'mcp'
  | 'model'
  | 'other';

const CATEGORY_RULES: Array<{ pattern: RegExp; category: PermissionCategory }> = [
  { pattern: /^fs\b/i, category: 'filesystem' },
  { pattern: /^bash\b/i, category: 'shell' },
  { pattern: /^net/i, category: 'network' },
  { pattern: /^http/i, category: 'network' },
  { pattern: /secret/i, category: 'secrets' },
  { pattern: /script/i, category: 'script' },
  { pattern: /subprocess|process|spawn/i, category: 'subprocess' },
  { pattern: /tool/i, category: 'external-tool' },
  { pattern: /\bmcp\b/i, category: 'mcp' },
  { pattern: /model/i, category: 'model' },
];

export function categorizePermission(permission: Permission): PermissionCategory {
  const resource = permission.resource;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(resource)) {
      return rule.category;
    }
  }
  return 'other';
}

interface CategoryEntry {
  count: number;
  permissions: Permission[];
}

export interface PermissionSummary {
  total: number;
  categories: Record<PermissionCategory, CategoryEntry>;
}

export function summarizePermissions(permissions: Permission[]): PermissionSummary {
  const categories = createEmptyCategories();
  for (const p of permissions) {
    const cat = categorizePermission(p);
    categories[cat].count++;
    categories[cat].permissions.push(p);
  }
  return { total: permissions.length, categories };
}

function createEmptyCategories(): Record<PermissionCategory, CategoryEntry> {
  const all: PermissionCategory[] = [
    'filesystem',
    'shell',
    'network',
    'secrets',
    'script',
    'subprocess',
    'external-tool',
    'mcp',
    'model',
    'other',
  ];
  const result = {} as Record<PermissionCategory, CategoryEntry>;
  for (const cat of all) {
    result[cat] = { count: 0, permissions: [] };
  }
  return result;
}

export type ComparisonKind = 'preserved' | 'weakened' | 'expanded' | 'new' | 'removed';

export interface PermissionComparison {
  kind: ComparisonKind;
  resource: string;
  sourceActions?: string[];
  compiledActions?: string[];
  diagnostic?: Diagnostic;
}

export interface PolicyDecision {
  allowed: boolean;
  reasons: string[];
  diagnostics: Diagnostic[];
}

export type PolicyHook = (report: PermissionInspectionReport) => PolicyDecision;

export interface PermissionInspectionReport {
  sourceSummary: PermissionSummary;
  compiledSummary: PermissionSummary;
  comparisons: PermissionComparison[];
  provenance: {
    source?: Provenance;
    compiled?: Provenance;
  };
  policyDecisions: PolicyDecision[];
  toText(): string;
  toJSON(): Record<string, unknown>;
}

function comparePermissions(source: Permission[], compiled: Permission[]): PermissionComparison[] {
  const comparisons: PermissionComparison[] = [];
  const sourceMap = new Map<string, Permission>();
  const compiledMap = new Map<string, Permission>();

  for (const p of source) {
    const key = p.resource;
    if (!sourceMap.has(key) || p.actions.length > (sourceMap.get(key)?.actions.length ?? 0)) {
      sourceMap.set(key, p);
    }
  }
  for (const p of compiled) {
    const key = p.resource;
    if (!compiledMap.has(key) || p.actions.length > (compiledMap.get(key)?.actions.length ?? 0)) {
      compiledMap.set(key, p);
    }
  }

  const allResources = new Set([...sourceMap.keys(), ...compiledMap.keys()]);

  for (const resource of allResources) {
    const src = sourceMap.get(resource);
    const comp = compiledMap.get(resource);

    if (src && comp) {
      const srcActions = new Set(src.actions);
      const compActions = new Set(comp.actions);
      const added = [...compActions].filter((a) => !srcActions.has(a));
      const removed = [...srcActions].filter((a) => !compActions.has(a));

      if (added.length === 0 && removed.length === 0) {
        comparisons.push({
          kind: 'preserved',
          resource,
          sourceActions: src.actions,
          compiledActions: comp.actions,
        });
      } else if (added.length > 0 && removed.length === 0) {
        comparisons.push({
          kind: 'expanded',
          resource,
          sourceActions: src.actions,
          compiledActions: comp.actions,
        });
      } else if (removed.length > 0 && added.length === 0) {
        comparisons.push({
          kind: 'weakened',
          resource,
          sourceActions: src.actions,
          compiledActions: comp.actions,
        });
      } else {
        comparisons.push({
          kind: 'weakened',
          resource,
          sourceActions: src.actions,
          compiledActions: comp.actions,
        });
      }
    } else if (src && !comp) {
      comparisons.push({ kind: 'removed', resource, sourceActions: src.actions });
    } else if (!src && comp) {
      comparisons.push({ kind: 'new', resource, compiledActions: comp.actions });
    }
  }

  return comparisons;
}

const DISCLAIMER = 'Static inspection does not prove a skill is safe';

function formatCategorySummary(prefix: string, summary: PermissionSummary): string {
  const lines: string[] = [`${prefix} — ${summary.total} permissions`];
  for (const [cat, entry] of Object.entries(summary.categories)) {
    if (entry.count > 0) {
      lines.push(`  ${cat}: ${entry.count}`);
    }
  }
  return lines.join('\n');
}

function formatComparison(comparison: PermissionComparison): string {
  const icon =
    comparison.kind === 'preserved'
      ? '  ='
      : comparison.kind === 'expanded'
        ? '  +'
        : comparison.kind === 'weakened'
          ? '  -'
          : comparison.kind === 'new'
            ? ' [+]'
            : ' [-]';
  const src = comparison.sourceActions ? `[${comparison.sourceActions.join(', ')}]` : '';
  const comp = comparison.compiledActions ? `[${comparison.compiledActions.join(', ')}]` : '';
  return `${icon} ${comparison.resource} ${src} → ${comp}`;
}

export function inspectPermissions(
  source: NormalizedSkill,
  compiled: NormalizedSkill,
  hooks?: PolicyHook[],
): PermissionInspectionReport {
  const sourceSummary = summarizePermissions(source.permissions ?? []);
  const compiledSummary = summarizePermissions(compiled.permissions ?? []);
  const comparisons = comparePermissions(source.permissions ?? [], compiled.permissions ?? []);

  const provenance = {
    source: source.provenance,
    compiled: compiled.provenance,
  };

  const policyDecisions: PolicyDecision[] = [];
  if (hooks) {
    const report = {
      sourceSummary,
      compiledSummary,
      comparisons,
      provenance,
      policyDecisions: [] as PolicyDecision[],
      toText: () => '',
      toJSON: () => ({}),
    };
    for (const hook of hooks) {
      try {
        policyDecisions.push(hook(report));
      } catch {
        policyDecisions.push({
          allowed: false,
          reasons: ['PolicyHook threw an exception'],
          diagnostics: [
            { severity: 'error', message: 'PolicyHook execution failed', code: 'COMPAT-020' },
          ],
        });
      }
    }
  }

  const report: PermissionInspectionReport = {
    sourceSummary,
    compiledSummary,
    comparisons,
    provenance,
    policyDecisions,
    toText() {
      const lines: string[] = [
        '=== Permission Inspection Report ===',
        '',
        formatCategorySummary('Source', sourceSummary),
        '',
        formatCategorySummary('Compiled', compiledSummary),
        '',
        'Comparisons:',
      ];
      for (const c of comparisons) {
        lines.push(formatComparison(c));
      }
      if (provenance.source || provenance.compiled) {
        lines.push('');
        lines.push('Provenance:');
        if (provenance.source) {
          lines.push(
            `  Source: convertedAt=${provenance.source.convertedAt ?? 'N/A'}, convertedBy=${provenance.source.convertedBy ?? 'N/A'}`,
          );
        }
        if (provenance.compiled) {
          lines.push(
            `  Compiled: convertedAt=${provenance.compiled.convertedAt ?? 'N/A'}, convertedBy=${provenance.compiled.convertedBy ?? 'N/A'}`,
          );
        }
      }
      if (policyDecisions.length > 0) {
        lines.push('');
        lines.push('Policy Decisions:');
        for (const pd of policyDecisions) {
          lines.push(`  ${pd.allowed ? 'ALLOW' : 'DENY'} — ${pd.reasons.join('; ')}`);
        }
      }
      lines.push('');
      lines.push(`Disclaimer: ${DISCLAIMER}`);
      return lines.join('\n');
    },
    toJSON() {
      return {
        sourceSummary,
        compiledSummary,
        comparisons,
        provenance,
        policyDecisions,
        disclaimer: DISCLAIMER,
      };
    },
  };

  return report;
}
