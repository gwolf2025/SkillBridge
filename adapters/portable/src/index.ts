import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import type {
  Adapter,
  AdapterManifest,
  ConversionContext,
  InstallPlan,
  Result,
  Diagnostic,
} from '../../../packages/adapter-sdk/src/index.js';
import type {
  NormalizedSkill,
  Capability,
  Permission,
  SourceMetadata,
  IRVersion,
} from '../../../packages/ir/src/index.js';
import { isValidCapability } from '../../../packages/ir/src/index.js';
import { parseSkillMd } from '../../../packages/parser/src/index.js';
import type { SkillMdResult } from '../../../packages/parser/src/index.js';

export const MANIFEST: AdapterManifest = {
  name: 'adapter-portable',
  version: '0.0.0',
  vendor: 'skillbridge',
  adapterVersion: '0.0.0',
  supports: {
    sourceFormats: ['markdown'],
    targetFormats: ['markdown'],
  },
  capabilities: ['detect', 'parse', 'normalize', 'compile'],
  description: 'Portable Agent Skills adapter for SkillBridge',
};

function sourcePrefix(source?: string): string {
  return `adapter:portable${source ? `:${source}` : ''}`;
}

function isContentString(input: string): boolean {
  return input.includes('\n');
}

function tryStat(path: string): { isDirectory(): boolean; isFile(): boolean } | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function discoverResourcesSync(dirPath: string): string[] {
  try {
    const entries = readdirSync(dirPath);
    const resources: string[] = [];
    for (const entry of entries) {
      if (entry === 'SKILL.md') continue;
      try {
        const fullPath = join(dirPath, entry);
        if (statSync(fullPath).isFile()) {
          resources.push(entry);
        }
      } catch {
        /* skip unreadable */
      }
    }
    return resources;
  } catch {
    return [];
  }
}

function detectPath(path: string): boolean {
  try {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      return existsSync(join(path, 'SKILL.md'));
    }
    if (stats.isFile()) {
      const normalizedPath = path.replace(/\\/g, '/');
      const name = normalizedPath.split('/').pop() ?? '';
      if (name !== 'SKILL.md' && !name.endsWith('.md')) {
        return false;
      }
      const content = readFileSync(path, 'utf-8');
      return content.startsWith('---');
    }
    return false;
  } catch {
    return false;
  }
}

class PortableAdapter implements Adapter<string, string, SkillMdResult> {
  manifest: AdapterManifest = { ...MANIFEST };

  detect(source: string): boolean {
    if (!source || typeof source !== 'string') {
      return false;
    }
    if (isContentString(source)) {
      return source.trimStart().startsWith('---');
    }
    return detectPath(source);
  }

  parse(source: string): SkillMdResult {
    let content: string;
    let filePath: string | undefined;
    let resources: string[] | undefined;

    if (isContentString(source)) {
      content = source;
    } else {
      filePath = source;

      const stats = tryStat(source);
      if (!stats) {
        return {
          frontmatter: {},
          sections: [],
          diagnostics: [
            {
              severity: 'error',
              message: `cannot read path: ${source}`,
              code: 'PARSER-007',
              source: sourcePrefix('read'),
            },
          ],
        };
      }

      if (stats.isDirectory()) {
        const skillMdPath = join(source, 'SKILL.md');
        if (!existsSync(skillMdPath)) {
          return {
            frontmatter: {},
            sections: [],
            diagnostics: [
              {
                severity: 'error',
                message: `directory does not contain SKILL.md: ${source}`,
                code: 'PARSER-001',
                source: sourcePrefix('parse'),
              },
            ],
          };
        }
        try {
          content = readFileSync(skillMdPath, 'utf-8');
          filePath = skillMdPath;
          resources = discoverResourcesSync(source);
        } catch {
          return {
            frontmatter: {},
            sections: [],
            diagnostics: [
              {
                severity: 'error',
                message: `cannot read SKILL.md in directory: ${source}`,
                code: 'PARSER-007',
                source: sourcePrefix('read'),
              },
            ],
          };
        }
      } else {
        try {
          content = readFileSync(source, 'utf-8');
        } catch {
          return {
            frontmatter: {},
            sections: [],
            diagnostics: [
              {
                severity: 'error',
                message: `cannot read file: ${source}`,
                code: 'PARSER-007',
                source: sourcePrefix('read'),
              },
            ],
          };
        }
      }
    }

    const result = parseSkillMd(content, filePath);
    if (!result.ok) {
      return {
        frontmatter: {},
        sections: [],
        diagnostics: result.error.map((d) => ({
          ...d,
          source: d.source ?? sourcePrefix('parse'),
        })),
      };
    }

    const diagnostics: Diagnostic[] = (result.value.diagnostics ?? []).map((d) => ({
      ...d,
      source: d.source ?? sourcePrefix('parse'),
    }));

    let extensions = result.value.extensions;
    if (resources && resources.length > 0) {
      extensions = { ...(extensions ?? {}), _resources: resources };
    }

    return {
      frontmatter: result.value.frontmatter,
      sections: result.value.sections,
      extensions,
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    };
  }

  normalize(source: string, parsed: SkillMdResult): NormalizedSkill {
    const fm = parsed.frontmatter;

    const capabilities: Capability[] = [];
    const unknownCaps: string[] = [];
    const rawCaps = fm.capabilities;
    if (Array.isArray(rawCaps)) {
      for (const cap of rawCaps) {
        if (typeof cap === 'string' && isValidCapability(cap)) {
          capabilities.push(cap as Capability);
        } else if (typeof cap === 'string') {
          unknownCaps.push(cap);
        }
      }
    }

    const permissions: Permission[] = [];
    const rawPerms = fm.permissions;
    if (Array.isArray(rawPerms)) {
      for (const perm of rawPerms) {
        if (typeof perm === 'object' && perm !== null) {
          const p = perm as Record<string, unknown>;
          if (typeof p.resource === 'string' && Array.isArray(p.actions)) {
            permissions.push({
              resource: p.resource,
              actions: p.actions.map(String),
            });
          }
        }
      }
    }

    const inputs = Array.isArray(fm.inputs)
      ? fm.inputs.map((i: Record<string, unknown>) => ({
          name: String(i.name ?? ''),
          description: i.description ? String(i.description) : undefined,
          type: String(i.type ?? 'string'),
          required: i.required === true ? true : undefined,
        }))
      : undefined;

    const outputs = Array.isArray(fm.outputs)
      ? fm.outputs.map((o: Record<string, unknown>) => ({
          name: String(o.name ?? ''),
          description: o.description ? String(o.description) : undefined,
          type: String(o.type ?? 'string'),
          required: o.required === true ? true : undefined,
        }))
      : undefined;

    let invocationInstructions = '';
    for (const section of parsed.sections) {
      const lower = section.heading.toLowerCase();
      if (lower === 'description' || lower === 'usage') {
        if (section.body) {
          invocationInstructions += (invocationInstructions ? '\n\n' : '') + section.body;
        }
      }
    }

    const sourceMeta: SourceMetadata = {
      format: 'markdown',
      path: isContentString(source) ? undefined : source,
    };

    let extensions: Record<string, unknown> | undefined;
    if (
      (parsed.extensions && Object.keys(parsed.extensions).length > 0) ||
      unknownCaps.length > 0
    ) {
      extensions = { ...parsed.extensions };
      if (unknownCaps.length > 0) {
        extensions._unknownCapabilities = unknownCaps;
      }
    }

    return {
      irVersion: '0.1.0' as IRVersion,
      identity: {
        name: String(fm.name ?? 'unnamed'),
        version: String(fm.version ?? '0.0.0'),
        description: fm.description ? String(fm.description) : undefined,
      },
      invocation: invocationInstructions ? { instructions: invocationInstructions } : undefined,
      inputs,
      outputs,
      capabilities,
      permissions,
      source: sourceMeta,
      ...(extensions ? { extensions } : {}),
    };
  }

  compile(parsed: SkillMdResult): string {
    const fm = parsed.frontmatter;

    const frontmatter: Record<string, unknown> = {
      name: String(fm.name ?? 'unnamed'),
      version: String(fm.version ?? '0.0.0'),
    };

    if (fm.description) {
      frontmatter.description = String(fm.description);
    }

    if (Array.isArray(fm.capabilities) && fm.capabilities.length > 0) {
      frontmatter.capabilities = [...fm.capabilities];
    }

    if (Array.isArray(fm.permissions) && fm.permissions.length > 0) {
      frontmatter.permissions = fm.permissions.map((p: Record<string, unknown>) => ({
        resource: p.resource,
        actions: [...(p.actions as string[])],
      }));
    }

    if (Array.isArray(fm.inputs) && fm.inputs.length > 0) {
      frontmatter.inputs = fm.inputs.map((i: Record<string, unknown>) => ({
        name: i.name,
        type: i.type,
        ...(i.description ? { description: i.description } : {}),
        ...(i.required ? { required: true } : {}),
      }));
    }

    if (Array.isArray(fm.outputs) && fm.outputs.length > 0) {
      frontmatter.outputs = fm.outputs.map((o: Record<string, unknown>) => ({
        name: o.name,
        type: o.type,
        ...(o.description ? { description: o.description } : {}),
        ...(o.required ? { required: true } : {}),
      }));
    }

    if (parsed.extensions && Object.keys(parsed.extensions).length > 0) {
      for (const [key, value] of Object.entries(parsed.extensions)) {
        if (!(key in frontmatter) && !key.startsWith('_')) {
          frontmatter[key] = value;
        }
      }
      const unknownCaps = parsed.extensions._unknownCapabilities;
      if (Array.isArray(unknownCaps) && unknownCaps.length > 0) {
        const existing = Array.isArray(frontmatter.capabilities)
          ? (frontmatter.capabilities as string[])
          : [];
        const existingSet = new Set(existing);
        for (const cap of unknownCaps) {
          if (typeof cap === 'string' && !existingSet.has(cap)) {
            existing.push(cap);
          }
        }
        frontmatter.capabilities = existing;
      }
    }

    if (fm.source) {
      frontmatter.source = fm.source;
    }

    if (fm.provenance) {
      frontmatter.provenance = fm.provenance;
    }

    const yamlStr = yaml.dump(frontmatter, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    const sectionMap = new Map<string, string>();
    for (const sec of parsed.sections) {
      sectionMap.set(sec.heading.toLowerCase(), sec.body);
    }

    const bodyParts: string[] = [];

    const descBody = sectionMap.get('description');
    if (descBody) {
      bodyParts.push(`## Description\n\n${descBody}`);
    } else if (fm.description) {
      bodyParts.push(`## Description\n\n${String(fm.description)}`);
    }

    const usageBody = sectionMap.get('usage');
    if (usageBody) {
      bodyParts.push(`## Usage\n\n${usageBody}`);
    }

    const argsBody = sectionMap.get('arguments');
    if (argsBody) {
      bodyParts.push(`## Arguments\n\n${argsBody}`);
    } else if (Array.isArray(fm.inputs) && fm.inputs.length > 0) {
      const argLines = fm.inputs.map((i: Record<string, unknown>) => {
        const req = i.required ? ' (required)' : '';
        const desc = i.description ? `: ${i.description}` : '';
        return `- \`${i.name}\` (${i.type})${req}${desc}`;
      });
      bodyParts.push(`## Arguments\n\n${argLines.join('\n')}`);
    }

    const outputsBody = sectionMap.get('outputs');
    if (outputsBody) {
      bodyParts.push(`## Outputs\n\n${outputsBody}`);
    } else if (Array.isArray(fm.outputs) && fm.outputs.length > 0) {
      const outLines = fm.outputs.map((o: Record<string, unknown>) => {
        const desc = o.description ? `: ${o.description}` : '';
        return `- \`${o.name}\` (${o.type})${desc}`;
      });
      bodyParts.push(`## Outputs\n\n${outLines.join('\n')}`);
    }

    for (const sec of parsed.sections) {
      const lower = sec.heading.toLowerCase();
      if (!['description', 'usage', 'arguments', 'outputs'].includes(lower)) {
        bodyParts.push(`## ${sec.heading}\n\n${sec.body}`);
      }
    }

    const body = bodyParts.length > 0 ? `\n${bodyParts.join('\n\n')}\n` : '\n';

    return `---\n${yamlStr}---${body}`;
  }

  installPlan(_context: ConversionContext<string, SkillMdResult>): InstallPlan {
    return { steps: [] };
  }

  install(_context: ConversionContext<string, SkillMdResult>): Result<void, Diagnostic[]> {
    return { ok: true, value: undefined };
  }

  uninstall(_context: ConversionContext<string, SkillMdResult>): Result<void, Diagnostic[]> {
    return { ok: true, value: undefined };
  }

  verify(_context: ConversionContext<string, SkillMdResult>): Result<boolean, Diagnostic[]> {
    return { ok: true, value: true };
  }

  invoke(_context: ConversionContext<string, SkillMdResult>): Result<string, Diagnostic[]> {
    return { ok: true, value: '' };
  }
}

const ADAPTER = new PortableAdapter();
export default ADAPTER;
export { PortableAdapter };
