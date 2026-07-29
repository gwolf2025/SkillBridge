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
} from '../../../packages/adapter-sdk/src/index.js';
import type {
  NormalizedSkill,
  Capability,
  Permission,
  SourceMetadata,
  IRVersion,
} from '../../../packages/ir/src/index.js';

export interface ClaudeSkillResult {
  name: string;
  description: string;
  frontmatter: Record<string, unknown>;
  body: string;
  extensions?: Record<string, unknown>;
  diagnostics?: Diagnostic[];
  allowedTools?: string[];
  disallowedTools?: string[];
  isForked?: boolean;
  isManualOnly?: boolean;
  isUserInvokable?: boolean;
  paths?: string[];
  arguments?: string[];
  argumentsHint?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  shell?: 'bash' | 'powershell';
  hooks?: Record<string, string>;
}

const CLAUDE_KNOWN_FIELDS = new Set([
  'name',
  'description',
  'when_to_use',
  'disabled',
  'allowed-tools',
  'disallowed-tools',
  'model',
  'effort',
  'context',
  'agent',
  'background',
  'hooks',
  'paths',
  'shell',
  'arguments',
  'argument-hint',
  'disable-model-invocation',
  'user-invocable',
]);

const OPEN_STANDARD_KNOWN_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

const DETECT_FIELDS = new Set(['description', 'name']);

const KNOWN_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Grep',
  'Search',
  'Git',
  'AskUserQuestion',
]);

const VALID_EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

const BOOLEAN_TRUE = new Set(['true', 'yes', 'on', '1']);
const BOOLEAN_FALSE = new Set(['false', 'no', 'off', '0']);

export const MANIFEST: AdapterManifest = {
  name: 'adapter-claude',
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
  description: 'Claude Code Agent Skills adapter for SkillBridge',
};

function sourcePrefix(source?: string): string {
  return `adapter:claude${source ? `:${source}` : ''}`;
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

function detectContentHasClaudeFields(content: string): boolean {
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
      return detectContentHasClaudeFields(content);
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
      code: 'CLAUDE-001',
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
      code: 'CLAUDE-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body, diagnostics };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    diagnostics.push({
      severity: 'error',
      message: 'frontmatter must be a YAML mapping (object)',
      code: 'CLAUDE-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body, diagnostics };
  }

  return { frontmatter: parsed as Record<string, unknown>, body, diagnostics };
}

function parseToolList(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  if (Array.isArray(value)) {
    return value.map((t) => (typeof t === 'string' ? t.trim() : '')).filter((t) => t.length > 0);
  }
  return [];
}

function parseBooleanField(
  value: unknown,
  diagnostics: Diagnostic[],
  field: string,
): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (BOOLEAN_TRUE.has(lower)) {
      if (lower !== 'true') {
        diagnostics.push({
          severity: 'info',
          message: `non-standard boolean value '${value}' for '${field}'`,
          code: 'CLAUDE-004',
          source: sourcePrefix('parse'),
        });
      }
      return true;
    }
    if (BOOLEAN_FALSE.has(lower)) {
      if (lower !== 'false') {
        diagnostics.push({
          severity: 'info',
          message: `non-standard boolean value '${value}' for '${field}'`,
          code: 'CLAUDE-004',
          source: sourcePrefix('parse'),
        });
      }
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
}

function buildClaudeResult(
  raw: Record<string, unknown>,
  body: string,
  nameHint: string | undefined,
  existingDiagnostics: Diagnostic[],
): ClaudeSkillResult {
  const diagnostics = [...existingDiagnostics];
  const extensions: Record<string, unknown> = {};
  const result: ClaudeSkillResult = {
    name: 'unnamed',
    description: '',
    frontmatter: { ...raw },
    body,
  };

  for (const [key, value] of Object.entries(raw)) {
    if (CLAUDE_KNOWN_FIELDS.has(key) || OPEN_STANDARD_KNOWN_FIELDS.has(key)) {
      switch (key) {
        case 'name':
          if (typeof value === 'string') {
            result.name = value;
            result.frontmatter.name = value;
          }
          break;
        case 'description':
          if (typeof value === 'string') {
            result.description = value;
            result.frontmatter.description = value;
          }
          break;
        case 'when_to_use':
          if (typeof value === 'string') {
            result.frontmatter.when_to_use = value;
          }
          break;
        case 'disabled': {
          const boolVal = parseBooleanField(value, diagnostics, 'disabled');
          if (boolVal !== undefined) {
            result.frontmatter.disabled = boolVal;
            if (boolVal) {
              diagnostics.push({
                severity: 'info',
                message: "skill is marked as 'disabled: true' — will be skipped by Claude Code",
                code: 'CLAUDE-002',
                source: sourcePrefix('parse'),
              });
            }
          }
          break;
        }
        case 'allowed-tools': {
          const tools = parseToolList(value);
          result.allowedTools = tools;
          result.frontmatter['allowed-tools'] = tools.length > 0 ? tools.join(' ') : '';
          for (const tool of tools) {
            if (!KNOWN_TOOLS.has(tool)) {
              diagnostics.push({
                severity: 'info',
                message: `unknown tool name '${tool}' preserved as-is`,
                code: 'CLAUDE-005',
                source: sourcePrefix('parse'),
              });
            }
          }
          break;
        }
        case 'disallowed-tools': {
          const tools = parseToolList(value);
          result.disallowedTools = tools;
          result.frontmatter['disallowed-tools'] = tools;
          extensions._claudeDisallowedTools = tools;
          diagnostics.push({
            severity: 'info',
            message: "'disallowed-tools' has no IR equivalent; preserved in extensions",
            code: 'CLAUDE-002',
            source: sourcePrefix('parse'),
          });
          break;
        }
        case 'model':
          if (typeof value === 'string') {
            result.model = value;
            result.frontmatter.model = value;
            extensions._claudeModel = value;
            diagnostics.push({
              severity: 'info',
              message: "'model' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'effort': {
          if (typeof value === 'string') {
            if (VALID_EFFORT.has(value)) {
              result.effort = value as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
              result.frontmatter.effort = value;
            } else {
              diagnostics.push({
                severity: 'warning',
                message: `invalid effort level '${value}'; expected one of: low, medium, high, xhigh, max`,
                code: 'CLAUDE-003',
                source: sourcePrefix('parse'),
              });
              result.effort = value as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
              result.frontmatter.effort = value;
            }
            extensions._claudeEffort = value;
            diagnostics.push({
              severity: 'info',
              message: "'effort' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        }
        case 'context':
          if (typeof value === 'string') {
            result.isForked = value === 'fork';
            result.frontmatter.context = value;
            extensions._claudeContext = value;
            diagnostics.push({
              severity: 'info',
              message: "'context' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'agent':
          if (typeof value === 'string') {
            result.frontmatter.agent = value;
            extensions._claudeAgent = value;
            diagnostics.push({
              severity: 'info',
              message: "'agent' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'background': {
          const boolVal = parseBooleanField(value, diagnostics, 'background');
          if (boolVal !== undefined) {
            result.frontmatter.background = boolVal;
            extensions._claudeBackground = boolVal;
            diagnostics.push({
              severity: 'info',
              message: "'background' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        }
        case 'hooks':
          if (typeof value === 'object' && value !== null) {
            result.hooks = value as Record<string, string>;
            result.frontmatter.hooks = value;
            extensions._claudeHooks = value;
            diagnostics.push({
              severity: 'info',
              message: "'hooks' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'paths': {
          const paths = parseToolList(value);
          result.paths = paths;
          result.frontmatter.paths = paths;
          extensions._claudePaths = paths;
          diagnostics.push({
            severity: 'info',
            message: "'paths' has no IR equivalent; preserved in extensions",
            code: 'CLAUDE-002',
            source: sourcePrefix('parse'),
          });
          break;
        }
        case 'shell':
          if (typeof value === 'string') {
            result.shell = value as 'bash' | 'powershell';
            result.frontmatter.shell = value;
            extensions._claudeShell = value;
            diagnostics.push({
              severity: 'info',
              message: "'shell' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'arguments': {
          const args = parseToolList(value);
          result.arguments = args;
          result.frontmatter.arguments = args;
          extensions._claudeArguments = args;
          diagnostics.push({
            severity: 'info',
            message: "'arguments' has no IR equivalent; preserved in extensions",
            code: 'CLAUDE-002',
            source: sourcePrefix('parse'),
          });
          break;
        }
        case 'argument-hint':
          if (typeof value === 'string') {
            result.argumentsHint = value;
            result.frontmatter['argument-hint'] = value;
            extensions._claudeArgumentsHint = value;
            diagnostics.push({
              severity: 'info',
              message: "'argument-hint' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        case 'disable-model-invocation': {
          const boolVal = parseBooleanField(value, diagnostics, 'disable-model-invocation');
          if (boolVal !== undefined) {
            result.isManualOnly = boolVal;
            result.frontmatter['disable-model-invocation'] = boolVal;
            extensions._claudeDisableModelInvocation = boolVal;
            diagnostics.push({
              severity: 'info',
              message: "'disable-model-invocation' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        }
        case 'user-invocable': {
          const boolVal = parseBooleanField(value, diagnostics, 'user-invocable');
          if (boolVal !== undefined) {
            result.isUserInvokable = boolVal;
            result.frontmatter['user-invocable'] = boolVal;
            extensions._claudeUserInvokable = boolVal;
            diagnostics.push({
              severity: 'info',
              message: "'user-invocable' has no IR equivalent; preserved in extensions",
              code: 'CLAUDE-002',
              source: sourcePrefix('parse'),
            });
          }
          break;
        }
        case 'license':
        case 'compatibility':
        case 'metadata':
          extensions[key] = value;
          break;
      }
    } else {
      extensions[key] = value;
      diagnostics.push({
        severity: 'info',
        message: `unknown frontmatter field '${key}' preserved in extensions`,
        code: 'CLAUDE-002',
        source: sourcePrefix('parse'),
      });
    }
  }

  if (nameHint && result.name === 'unnamed') {
    result.name = nameHint;
  }

  if (!result.description && result.body) {
    const firstPara = result.body.trim().split('\n\n')[0] ?? '';
    result.description = firstPara;
  }

  if (Object.keys(extensions).length > 0) {
    result.extensions = extensions;
  }
  if (diagnostics.length > 0) {
    result.diagnostics = diagnostics;
  }

  return result;
}

function mapPermissionsToIR(allowedTools: string[] | undefined): Permission[] {
  const result: Permission[] = [];
  if (!allowedTools || allowedTools.length === 0) return result;

  for (const tool of allowedTools) {
    switch (tool) {
      case 'Read':
        result.push({ resource: 'fs', actions: ['read'] });
        break;
      case 'Write':
      case 'Edit':
        result.push({ resource: 'fs', actions: ['write'] });
        break;
      case 'Bash':
        result.push({ resource: 'bash:*', actions: ['execute'] });
        break;
      case 'Grep':
      case 'Search':
        result.push({ resource: 'fs', actions: ['search'] });
        break;
    }
  }

  return result;
}

function deriveCapabilities(allowedTools: string[] | undefined): Capability[] {
  const caps: Capability[] = [];
  if (!allowedTools || allowedTools.length === 0) {
    return ['file-write', 'command-exec'];
  }

  const toolSet = new Set(allowedTools);
  if (toolSet.has('Write') || toolSet.has('Edit')) {
    caps.push('file-write');
  }
  if (toolSet.has('Bash')) {
    caps.push('command-exec');
  }

  return caps;
}

function compileFrontmatterToYaml(result: ClaudeSkillResult): string {
  const output: Record<string, unknown> = {};

  if (result.name && result.name !== 'unnamed') {
    output.name = result.name;
  }
  if (result.description) {
    output.description = result.description;
  }
  if (result.frontmatter.when_to_use) {
    output.when_to_use = result.frontmatter.when_to_use;
  }
  if (result.frontmatter.disabled === true || result.frontmatter.disabled === false) {
    if (result.frontmatter.disabled) {
      output.disabled = true;
    }
  }
  if (result.allowedTools && result.allowedTools.length > 0) {
    output['allowed-tools'] = result.allowedTools.join(' ');
  }
  if (result.disallowedTools && result.disallowedTools.length > 0) {
    output['disallowed-tools'] = result.disallowedTools.join(' ');
  }
  if (result.model) {
    output.model = result.model;
  }
  if (result.effort) {
    output.effort = result.effort;
  }
  if (result.isForked) {
    output.context = 'fork';
  }
  if (result.frontmatter.agent) {
    output.agent = result.frontmatter.agent;
  }
  if (result.frontmatter.background === false) {
    output.background = false;
  } else if (result.frontmatter.background === true) {
    output.background = true;
  }
  if (result.hooks) {
    output.hooks = result.hooks;
  }
  if (result.paths && result.paths.length > 0) {
    output.paths = result.paths;
  }
  if (result.shell) {
    output.shell = result.shell;
  }
  if (result.arguments && result.arguments.length > 0) {
    output.arguments = result.arguments;
  }
  if (result.argumentsHint) {
    output['argument-hint'] = result.argumentsHint;
  }
  if (result.isManualOnly) {
    output['disable-model-invocation'] = true;
  }
  if (result.isUserInvokable === false) {
    output['user-invocable'] = false;
  }

  if (result.extensions) {
    for (const [key, value] of Object.entries(result.extensions)) {
      if (!(key in output) && !key.startsWith('_claude')) {
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

function getInstallPaths(context: ConversionContext<string, ClaudeSkillResult>): {
  projectDir: string;
  userDir: string;
  filename: string;
} {
  const result = context.normalized;
  const name = result.name && result.name !== 'unnamed' ? result.name : 'unnamed';
  const subdir = 'skills';
  const filename = `${name}.md`;

  const baseDir = (context.options?.baseDir as string) ?? '.claude';
  const projectDir = join(baseDir, subdir);

  const userConfigDir = (context.options?.userConfigDir as string) ?? join(homedir(), '.claude');
  const userDir = join(userConfigDir, subdir);

  return { projectDir, userDir, filename };
}

class ClaudeCodeAdapter implements Adapter<string, string, ClaudeSkillResult> {
  manifest: AdapterManifest = { ...MANIFEST };

  detect(source: string): boolean {
    if (!source || typeof source !== 'string') {
      return false;
    }
    if (isContentString(source)) {
      return detectContentHasClaudeFields(source);
    }
    const stats = tryStat(source);
    if (!stats) {
      return detectContentHasClaudeFields(source);
    }
    return detectFilePath(source);
  }

  parse(source: string): ClaudeSkillResult {
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
            name: 'unnamed',
            description: '',
            frontmatter: {},
            body: '',
            diagnostics: [
              {
                severity: 'error',
                message: `cannot read file: ${source}`,
                code: 'CLAUDE-001',
                source: sourcePrefix('read'),
              },
            ],
          };
        }
      }
    }

    const parseResult = parseYamlFrontmatter(content, source);
    if (parseResult.diagnostics.some((d) => d.severity === 'error' && d.code === 'CLAUDE-001')) {
      return {
        name: 'unnamed',
        description: '',
        frontmatter: {},
        body: parseResult.body,
        diagnostics: parseResult.diagnostics,
      };
    }

    return buildClaudeResult(
      parseResult.frontmatter,
      parseResult.body,
      nameHint,
      parseResult.diagnostics,
    );
  }

  normalize(source: string, parsed: ClaudeSkillResult): NormalizedSkill {
    const capabilities = deriveCapabilities(parsed.allowedTools);
    const permissions = mapPermissionsToIR(parsed.allowedTools);

    const sourceMeta: SourceMetadata = {
      format: 'markdown',
      path: isContentString(source) ? undefined : source,
    };

    let extensions: Record<string, unknown> | undefined;
    if (parsed.extensions && Object.keys(parsed.extensions).length > 0) {
      extensions = { ...parsed.extensions };
    }

    const invocationInstructions = parsed.body.trim();

    return {
      irVersion: '0.1.0' as IRVersion,
      identity: {
        name: parsed.name,
        version: '0.0.0',
        description: parsed.description || undefined,
      },
      invocation: invocationInstructions ? { instructions: invocationInstructions } : undefined,
      capabilities,
      permissions,
      source: sourceMeta,
      ...(extensions ? { extensions } : {}),
    };
  }

  compile(normalized: ClaudeSkillResult): string {
    const yamlStr = compileFrontmatterToYaml(normalized);
    const body = normalized.body ? `\n${normalized.body}\n` : '\n';
    return `---\n${yamlStr}---${body}`;
  }

  installPlan(context: ConversionContext<string, ClaudeSkillResult>): InstallPlan {
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

  install(context: ConversionContext<string, ClaudeSkillResult>): Result<void, Diagnostic[]> {
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
            code: 'CLAUDE-001',
            source: sourcePrefix('install'),
          },
        ],
      };
    }
  }

  uninstall(context: ConversionContext<string, ClaudeSkillResult>): Result<void, Diagnostic[]> {
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
            code: 'CLAUDE-001',
            source: sourcePrefix('uninstall'),
          },
        ],
      };
    }
  }

  verify(context: ConversionContext<string, ClaudeSkillResult>): Result<boolean, Diagnostic[]> {
    try {
      const compiled = this.compile(context.normalized);
      const reparsed = this.parse(compiled);
      return {
        ok: true,
        value:
          reparsed.name === context.normalized.name &&
          reparsed.description === context.normalized.description &&
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
            code: 'CLAUDE-001',
            source: sourcePrefix('verify'),
          },
        ],
      };
    }
  }

  invoke(_context: ConversionContext<string, ClaudeSkillResult>): Result<string, Diagnostic[]> {
    return { ok: true, value: '' };
  }
}

const ADAPTER = new ClaudeCodeAdapter();
export default ADAPTER;
export { ClaudeCodeAdapter };
