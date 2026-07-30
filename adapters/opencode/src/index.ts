import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';
import { homedir } from 'node:os';
import * as yaml from 'js-yaml';
import type {
  Adapter,
  AdapterManifest,
  ConversionContext,
  InstallPlan,
  Result,
  Diagnostic,
} from '@skillbridge/adapter-sdk';
import type {
  NormalizedSkill,
  Capability,
  Permission,
  SourceMetadata,
  IRVersion,
} from '@skillbridge/ir';

export interface OpenCodePermission {
  edit?: boolean | string | Record<string, string>;
  bash?: Record<string, string>;
}

export interface OpenCodeFrontmatter {
  description?: string;
  mode?: 'primary' | 'subagent';
  instruction?: string;
  model?: string;
  permission?: OpenCodePermission;
  rule?: string | string[];
  agent?: string;
}

export interface OpenCodeSkillResult {
  kind: 'agent' | 'command';
  frontmatter: OpenCodeFrontmatter;
  body: string;
  nameHint?: string;
  extensions?: Record<string, unknown>;
  diagnostics?: Diagnostic[];
}

const KNOWN_AGENT_FIELDS = new Set([
  'description',
  'mode',
  'instruction',
  'model',
  'permission',
  'rule',
]);
const KNOWN_COMMAND_FIELDS = new Set(['description', 'agent', 'model', 'instruction', 'rule']);
const DETECT_FIELDS = new Set(['description', 'mode', 'agent', 'rule']);

export const MANIFEST: AdapterManifest = {
  name: 'adapter-opencode',
  version: '0.0.0',
  vendor: 'skillbridge',
  adapterVersion: '0.0.0',
  supports: {
    sourceFormats: ['markdown'],
    targetFormats: ['markdown'],
  },
  capabilities: [
    'detect',
    'parse',
    'normalize',
    'compile',
    'install-plan',
    'install',
    'uninstall',
    'verify',
  ],
  description: 'OpenCode Agent Skills adapter for SkillBridge',
};

function sourcePrefix(source?: string): string {
  return `adapter:opencode${source ? `:${source}` : ''}`;
}

function isContentString(input: string): boolean {
  if (input.includes('\n')) return true;
  if (input.startsWith('---')) return true;
  return false;
}

function tryStat(path: string): { isDirectory(): boolean; isFile(): boolean } | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function extractNameFromPath(path: string): string {
  const parsed = parsePath(path.replace(/\\/g, '/'));
  return parsed.name;
}

function detectContentHasOpenCodeFields(content: string): boolean {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return false;
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) return false;
  const rawFm = trimmed.slice(3, endIndex);
  try {
    const parsed = yaml.load(rawFm);
    if (typeof parsed !== 'object' || parsed === null) return false;
    const record = parsed as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (DETECT_FIELDS.has(key)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function detectFilePath(path: string): boolean {
  try {
    const stats = statSync(path);
    if (stats.isDirectory()) return false;
    if (stats.isFile()) {
      const normalizedPath = path.replace(/\\/g, '/');
      const name = normalizedPath.split('/').pop() ?? '';
      if (!name.endsWith('.md')) return false;
      const content = readFileSync(path, 'utf-8');
      return detectContentHasOpenCodeFields(content);
    }
    return false;
  } catch {
    return false;
  }
}

function parseYamlFrontmatter(
  content: string,
  _source: string,
): {
  frontmatter: Record<string, unknown>;
  body: string;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

  if (!normalized.startsWith('---')) {
    return { frontmatter: {}, body: normalized, diagnostics };
  }

  const endIndex = normalized.indexOf('---', 3);
  if (endIndex === -1) {
    diagnostics.push({
      severity: 'error',
      message: 'unclosed frontmatter block',
      code: 'OPENCODE-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body: normalized.slice(3), diagnostics };
  }

  const rawFrontmatter = normalized.slice(3, endIndex);
  const trimmedFm = rawFrontmatter.trim();
  const body = normalized.slice(endIndex + 3).trimStart();

  if (!trimmedFm) {
    return { frontmatter: {}, body, diagnostics };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(trimmedFm);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      severity: 'error',
      message: `malformed YAML in frontmatter: ${message}`,
      code: 'OPENCODE-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body, diagnostics };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    diagnostics.push({
      severity: 'error',
      message: 'frontmatter must be a YAML mapping (object)',
      code: 'OPENCODE-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body, diagnostics };
  }

  return { frontmatter: parsed as Record<string, unknown>, body, diagnostics };
}

function determineKind(fm: Record<string, unknown>): 'agent' | 'command' {
  if ('agent' in fm) return 'command';
  return 'agent';
}

function buildOpenCodeFrontmatter(
  raw: Record<string, unknown>,
  kind: 'agent' | 'command',
  diagnostics: Diagnostic[],
): {
  frontmatter: OpenCodeFrontmatter;
  extensions: Record<string, unknown>;
} {
  const known = kind === 'agent' ? KNOWN_AGENT_FIELDS : KNOWN_COMMAND_FIELDS;
  const frontmatter: OpenCodeFrontmatter = {};
  const extensions: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (known.has(key)) {
      switch (key) {
        case 'description':
          if (typeof value === 'string') frontmatter.description = value;
          break;
        case 'mode':
          if (value === 'primary' || value === 'subagent') {
            frontmatter.mode = value;
          } else if (typeof value === 'string') {
            diagnostics.push({
              severity: 'warning',
              message: `invalid mode '${value}'; expected 'primary' or 'subagent'`,
              code: 'OPENCODE-002',
              source: sourcePrefix('parse'),
            });
            frontmatter.mode = value as 'primary' | 'subagent';
          }
          break;
        case 'instruction':
          if (typeof value === 'string') {
            frontmatter.instruction = value;
            diagnostics.push({
              severity: 'info',
              message: `instruction file reference not resolved: ${value}`,
              code: 'OPENCODE-005',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'model':
          if (typeof value === 'string') frontmatter.model = value;
          break;
        case 'permission':
          if (typeof value === 'object' && value !== null) {
            frontmatter.permission = value as OpenCodePermission;
          }
          break;
        case 'rule':
          frontmatter.rule = value as string | string[];
          break;
        case 'agent':
          if (typeof value === 'string') frontmatter.agent = value;
          break;
      }
    } else {
      extensions[key] = value;
      diagnostics.push({
        severity: 'info',
        message: `unknown frontmatter field preserved: ${key}`,
        code: 'OPENCODE-005',
        source: sourcePrefix('parse'),
      });
    }
  }

  if (kind === 'command') {
    if ('mode' in raw) {
      diagnostics.push({
        severity: 'warning',
        message: `command files do not support 'mode' field; mapped to extension`,
        code: 'OPENCODE-004',
        source: sourcePrefix('parse'),
      });
      extensions._openCodeCommandMode = raw.mode;
    }
    if ('permission' in raw) {
      diagnostics.push({
        severity: 'warning',
        message: `command files do not support 'permission' field; mapped to extension`,
        code: 'OPENCODE-004',
        source: sourcePrefix('parse'),
      });
      extensions._openCodeCommandPermission = raw.permission;
    }
  }

  if (!frontmatter.description && kind === 'agent') {
    diagnostics.push({
      severity: 'error',
      message: "missing required field 'description' for agent",
      code: 'OPENCODE-006',
      source: sourcePrefix('parse'),
    });
  }

  return { frontmatter, extensions };
}

function validatePermissions(
  permission: OpenCodePermission | undefined,
  diagnostics: Diagnostic[],
): void {
  if (!permission) return;

  if (permission.edit === 'ask') {
    diagnostics.push({
      severity: 'warning',
      message: "interactive permission 'ask' is not representable in IR",
      code: 'OPENCODE-003',
      source: sourcePrefix('normalize'),
    });
  } else if (typeof permission.edit === 'object' && permission.edit !== null) {
    for (const [glob, value] of Object.entries(permission.edit)) {
      if (value === 'deny') {
        diagnostics.push({
          severity: 'warning',
          message: `deny mapping on 'edit:${glob}' is not representable in IR`,
          code: 'OPENCODE-004',
          source: sourcePrefix('normalize'),
        });
      }
    }
  }

  if (permission.bash) {
    for (const [glob, value] of Object.entries(permission.bash)) {
      if (value === 'ask') {
        diagnostics.push({
          severity: 'warning',
          message: "interactive bash permission 'ask' is not representable in IR",
          code: 'OPENCODE-003',
          source: sourcePrefix('normalize'),
        });
      } else if (value === 'deny') {
        diagnostics.push({
          severity: 'warning',
          message: `deny mapping on bash:${glob} is not representable in IR`,
          code: 'OPENCODE-004',
          source: sourcePrefix('normalize'),
        });
      }
    }
  }
}

function mapPermissionsToIR(permission: OpenCodePermission | undefined): Permission[] {
  const result: Permission[] = [];
  if (!permission) return result;

  if (permission.edit === true || permission.edit === 'allow') {
    result.push({ resource: 'fs', actions: ['write'] });
  } else if (typeof permission.edit === 'object' && permission.edit !== null) {
    for (const [glob, action] of Object.entries(permission.edit)) {
      if (action === 'allow') {
        result.push({ resource: `fs:${glob}`, actions: ['write'] });
      }
    }
  }

  if (permission.bash) {
    for (const [glob, action] of Object.entries(permission.bash)) {
      if (action === 'allow') {
        result.push({ resource: `bash:${glob}`, actions: ['execute'] });
      }
    }
  }

  return result;
}

function deriveCapabilities(
  frontmatter: OpenCodeFrontmatter,
  _diagnostics: Diagnostic[],
): Capability[] {
  const caps: Capability[] = [];

  if (frontmatter.permission) {
    if (frontmatter.permission.edit === true || frontmatter.permission.edit === 'allow') {
      caps.push('file-write');
    } else if (typeof frontmatter.permission.edit === 'object') {
      const hasAllow = Object.values(frontmatter.permission.edit).some((v) => v === 'allow');
      if (hasAllow) caps.push('file-write');
    }

    if (frontmatter.permission.bash) {
      const hasAllow = Object.values(frontmatter.permission.bash).some((v) => v === 'allow');
      if (hasAllow) caps.push('command-exec');
    }
  }

  if (frontmatter.mode === 'subagent') {
    caps.push('subagent');
  }

  return caps;
}

function compileFrontmatterToYaml(
  frontmatter: OpenCodeFrontmatter,
  kind: 'agent' | 'command',
  extensions: Record<string, unknown> | undefined,
): string {
  const output: Record<string, unknown> = {};

  if (frontmatter.description) {
    output.description = frontmatter.description;
  }

  if (kind === 'agent') {
    if (frontmatter.mode && frontmatter.mode !== 'primary') {
      output.mode = frontmatter.mode;
    }
    if (frontmatter.permission) {
      const perm = frontmatter.permission;
      const permOut: Record<string, unknown> = {};
      if (perm.edit !== undefined) permOut.edit = perm.edit;
      if (perm.bash !== undefined) permOut.bash = perm.bash;
      if (Object.keys(permOut).length > 0) {
        output.permission = permOut;
      }
    }
  }

  if (kind === 'command' && frontmatter.agent) {
    output.agent = frontmatter.agent;
  }

  if (frontmatter.instruction) {
    output.instruction = frontmatter.instruction;
  }
  if (frontmatter.model) {
    output.model = frontmatter.model;
  }
  if (frontmatter.rule) {
    output.rule = frontmatter.rule;
  }

  if (extensions) {
    for (const [key, value] of Object.entries(extensions)) {
      if (!(key in output) && !key.startsWith('_openCode')) {
        output[key] = value;
      }
    }
  }

  return yaml.dump(output, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

function getInstallPaths(context: ConversionContext<string, OpenCodeSkillResult>): {
  projectDir: string;
  userDir: string;
  filename: string;
} {
  const normalized = context.normalized;
  const nameHint = normalized.nameHint ?? 'unnamed';
  const subdir = normalized.kind === 'agent' ? 'agents' : 'commands';
  const filename = `${nameHint}.md`;

  const baseDir = (context.options?.baseDir as string) ?? '.opencode';
  const projectDir = join(baseDir, subdir);

  const userConfigDir =
    (context.options?.userConfigDir as string) ?? join(homedir(), '.config', 'opencode');
  const userDir = join(userConfigDir, subdir);

  return { projectDir, userDir, filename };
}

class OpenCodeAdapter implements Adapter<string, string, OpenCodeSkillResult> {
  manifest: AdapterManifest = { ...MANIFEST };

  detect(source: string): boolean {
    if (!source || typeof source !== 'string') {
      return false;
    }
    if (isContentString(source)) {
      return detectContentHasOpenCodeFields(source);
    }
    const stats = tryStat(source);
    if (!stats) {
      return detectContentHasOpenCodeFields(source);
    }
    return detectFilePath(source);
  }

  parse(source: string): OpenCodeSkillResult {
    let content: string;
    let nameHint: string | undefined;

    if (isContentString(source)) {
      content = source;
    } else {
      const stats = tryStat(source);
      if (!stats) {
        content = source;
      } else {
        try {
          content = readFileSync(source, 'utf-8');
          nameHint = extractNameFromPath(source);
        } catch {
          return {
            kind: 'agent',
            frontmatter: {},
            body: '',
            diagnostics: [
              {
                severity: 'error',
                message: `cannot read file: ${source}`,
                code: 'OPENCODE-007',
                source: sourcePrefix('read'),
              },
            ],
          };
        }
      }
    }

    const parseResult = parseYamlFrontmatter(content, source);
    if (parseResult.diagnostics.some((d) => d.severity === 'error' && d.code === 'OPENCODE-001')) {
      return {
        kind: 'agent',
        frontmatter: {},
        body: parseResult.body,
        diagnostics: parseResult.diagnostics,
      };
    }

    const kind = determineKind(parseResult.frontmatter);

    if (kind === 'command') {
      const agentName = parseResult.frontmatter.agent;
      if (agentName && typeof agentName === 'string') {
        nameHint = nameHint ?? agentName;
      }
    }
    nameHint = nameHint ?? 'unnamed';

    const built = buildOpenCodeFrontmatter(parseResult.frontmatter, kind, parseResult.diagnostics);

    return {
      kind,
      frontmatter: built.frontmatter,
      body: parseResult.body,
      nameHint,
      extensions: Object.keys(built.extensions).length > 0 ? built.extensions : undefined,
      diagnostics: parseResult.diagnostics.length > 0 ? parseResult.diagnostics : undefined,
    };
  }

  normalize(source: string, parsed: OpenCodeSkillResult): NormalizedSkill {
    const diagnostics: Diagnostic[] = [];

    validatePermissions(parsed.frontmatter.permission, diagnostics);

    const capabilities = deriveCapabilities(parsed.frontmatter, diagnostics);
    const permissions = mapPermissionsToIR(parsed.frontmatter.permission);

    let invocationInstructions = parsed.body.trim();
    if (parsed.frontmatter.instruction && parsed.frontmatter.instruction.length > 0) {
      if (invocationInstructions) {
        invocationInstructions += '\n\n';
      }
      invocationInstructions += `See instruction file: ${parsed.frontmatter.instruction}`;
    }

    const sourceMeta: SourceMetadata = {
      format: 'markdown',
      path: isContentString(source) ? undefined : source,
    };

    let extensions: Record<string, unknown> | undefined;
    if (parsed.extensions && Object.keys(parsed.extensions).length > 0) {
      extensions = { ...parsed.extensions };
    }

    const name = parsed.nameHint ?? 'unnamed';

    return {
      irVersion: '0.1.0' as IRVersion,
      identity: {
        name,
        version: '0.0.0',
        description: parsed.frontmatter.description,
      },
      invocation: invocationInstructions ? { instructions: invocationInstructions } : undefined,
      capabilities,
      permissions,
      source: sourceMeta,
      ...(extensions ? { extensions } : {}),
    };
  }

  compile(normalized: OpenCodeSkillResult): string {
    const yamlStr = compileFrontmatterToYaml(
      normalized.frontmatter,
      normalized.kind,
      normalized.extensions,
    );
    const body = normalized.body ? `\n${normalized.body}\n` : '\n';
    return `---\n${yamlStr}---${body}`;
  }

  installPlan(context: ConversionContext<string, OpenCodeSkillResult>): InstallPlan {
    const { projectDir, userDir, filename } = getInstallPaths(context);
    return {
      steps: [
        `Create directory: ${projectDir}`,
        `Copy to project scope: ${join(projectDir, filename)}`,
        `Create directory: ${userDir}`,
        `Copy to user scope: ${join(userDir, filename)}`,
      ],
      warnings: [],
    };
  }

  install(context: ConversionContext<string, OpenCodeSkillResult>): Result<void, Diagnostic[]> {
    const { projectDir, filename } = getInstallPaths(context);
    const targetDir = (context.options?.installDir as string) ?? projectDir;
    const targetPath = join(targetDir, filename);

    try {
      mkdirSync(targetDir, { recursive: true });
      const compiled = this.compile(context.normalized);
      writeFileSync(targetPath, compiled, 'utf-8');
      return { ok: true, value: undefined };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `failed to install: ${message}`,
            code: 'OPENCODE-007',
            source: sourcePrefix('install'),
          },
        ],
      };
    }
  }

  uninstall(context: ConversionContext<string, OpenCodeSkillResult>): Result<void, Diagnostic[]> {
    const { projectDir, filename } = getInstallPaths(context);
    const targetDir = (context.options?.installDir as string) ?? projectDir;
    const targetPath = join(targetDir, filename);

    try {
      if (existsSync(targetPath)) {
        unlinkSync(targetPath);
      }
      return { ok: true, value: undefined };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `failed to uninstall: ${message}`,
            code: 'OPENCODE-007',
            source: sourcePrefix('uninstall'),
          },
        ],
      };
    }
  }

  verify(context: ConversionContext<string, OpenCodeSkillResult>): Result<boolean, Diagnostic[]> {
    try {
      const compiled = this.compile(context.normalized);
      const reparsed = this.parse(compiled);
      return {
        ok: true,
        value:
          reparsed.frontmatter.description === context.normalized.frontmatter.description &&
          reparsed.body.trim() === context.normalized.body.trim(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `verification failed: ${message}`,
            code: 'OPENCODE-007',
            source: sourcePrefix('verify'),
          },
        ],
      };
    }
  }

  invoke(_context: ConversionContext<string, OpenCodeSkillResult>): Result<string, Diagnostic[]> {
    return { ok: true, value: '' };
  }
}

const ADAPTER = new OpenCodeAdapter();
export default ADAPTER;
export { OpenCodeAdapter };
