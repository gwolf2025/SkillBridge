import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname, parse as parsePath } from 'node:path';
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

export interface CodexSkillResult {
  name: string;
  description: string;
  frontmatter: Record<string, unknown>;
  body: string;
  extensions?: Record<string, unknown>;
  diagnostics?: Diagnostic[];
  allowedTools?: string[];
  openaiYaml?: Record<string, unknown>;
}

const CODEX_KNOWN_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

const OPEN_STANDARD_KNOWN_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

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

const CONSECUTIVE_HYPHEN_RE = /--/;

export const MANIFEST: AdapterManifest = {
  name: 'adapter-codex',
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
  description: 'OpenAI Codex Agent Skills adapter for SkillBridge',
};

function sourcePrefix(source?: string): string {
  return `adapter:codex${source ? `:${source}` : ''}`;
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

function detectContentHasCodexFields(content: string): boolean {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return false;
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) return false;
  const rawFm = trimmed.slice(3, endIndex);
  try {
    const parsed = yaml.load(rawFm);
    if (typeof parsed !== 'object' || parsed === null) return false;
    const record = parsed as Record<string, unknown>;
    return (
      typeof record.name === 'string' &&
      record.name.length > 0 &&
      typeof record.description === 'string' &&
      record.description.length > 0
    );
  } catch {
    return false;
  }
}

function isMdFilePath(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/');
  const filename = normalizedPath.split('/').pop() ?? '';
  return filename.endsWith('.md') || filename.endsWith('.SKILL.md') || filename === 'SKILL.md';
}

function detectFilePath(path: string): boolean {
  try {
    const stats = statSync(path);
    if (stats.isDirectory()) return false;
    if (stats.isFile()) {
      if (!isMdFilePath(path)) return false;
      const content = readFileSync(path, 'utf-8');
      return detectContentHasCodexFields(content);
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
      code: 'CODEX-001',
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
      code: 'CODEX-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body, diagnostics };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    diagnostics.push({
      severity: 'error',
      message: 'frontmatter must be a YAML mapping (object)',
      code: 'CODEX-001',
      source: sourcePrefix('parse'),
    });
    return { frontmatter: {}, body, diagnostics };
  }

  return { frontmatter: parsed as Record<string, unknown>, body, diagnostics };
}

function validateName(name: string, diagnostics: Diagnostic[], source: string): string {
  if (name.length > 64) {
    diagnostics.push({
      severity: 'warning',
      message: `name '${name}' exceeds 64 characters (${name.length})`,
      code: 'CODEX-004',
      source,
    });
  }

  if (name !== name.toLowerCase()) {
    diagnostics.push({
      severity: 'warning',
      message: `name '${name}' contains uppercase characters; must be lowercase`,
      code: 'CODEX-004',
      source,
    });
  }

  if (name.startsWith('-') || name.endsWith('-')) {
    diagnostics.push({
      severity: 'warning',
      message: `name '${name}' starts or ends with a hyphen`,
      code: 'CODEX-004',
      source,
    });
  }

  if (CONSECUTIVE_HYPHEN_RE.test(name)) {
    diagnostics.push({
      severity: 'warning',
      message: `name '${name}' contains consecutive hyphens`,
      code: 'CODEX-004',
      source,
    });
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    diagnostics.push({
      severity: 'warning',
      message: `name '${name}' contains invalid characters; only lowercase alphanumeric and hyphens allowed`,
      code: 'CODEX-004',
      source,
    });
  }

  return name;
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

function parseOpenaiYaml(
  skillDir: string,
  source: string,
): { yamlContent: Record<string, unknown> | undefined; diagnostics: Diagnostic[] } {
  const openaiPath = join(skillDir, 'agents', 'openai.yaml');
  try {
    if (!existsSync(openaiPath)) {
      return { yamlContent: undefined, diagnostics: [] };
    }
    const raw = readFileSync(openaiPath, 'utf-8');
    const parsed = yaml.load(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        yamlContent: undefined,
        diagnostics: [
          {
            severity: 'warning',
            message: 'agents/openai.yaml is not a YAML mapping',
            code: 'CODEX-002',
            source,
          },
        ],
      };
    }
    return { yamlContent: parsed as Record<string, unknown>, diagnostics: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      yamlContent: undefined,
      diagnostics: [
        {
          severity: 'warning',
          message: `malformed YAML in agents/openai.yaml: ${message}`,
          code: 'CODEX-002',
          source,
        },
      ],
    };
  }
}

function buildCodexResult(
  raw: Record<string, unknown>,
  body: string,
  nameHint: string | undefined,
  openaiYaml: Record<string, unknown> | undefined,
  existingDiagnostics: Diagnostic[],
): CodexSkillResult {
  const diagnostics = [...existingDiagnostics];
  const extensions: Record<string, unknown> = {};
  let hasExplicitDescription = false;
  const result: CodexSkillResult = {
    name: '',
    description: '',
    frontmatter: { ...raw },
    body,
  };

  for (const [key, value] of Object.entries(raw)) {
    if (CODEX_KNOWN_FIELDS.has(key) || OPEN_STANDARD_KNOWN_FIELDS.has(key)) {
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
            hasExplicitDescription = true;
          }
          break;
        case 'allowed-tools': {
          const tools = parseToolList(value);
          result.allowedTools = tools;
          result.frontmatter['allowed-tools'] = tools.length > 0 ? tools.join(' ') : '';
          diagnostics.push({
            severity: 'info',
            message: "'allowed-tools' is experimental — behaviour in Codex is not documented",
            code: 'CODEX-003',
            source: sourcePrefix('parse'),
          });
          for (const tool of tools) {
            if (!KNOWN_TOOLS.has(tool)) {
              diagnostics.push({
                severity: 'info',
                message: `unknown tool name '${tool}' preserved as-is`,
                code: 'CODEX-005',
                source: sourcePrefix('parse'),
              });
            }
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
        code: 'CODEX-005',
        source: sourcePrefix('parse'),
      });
    }
  }

  if (nameHint && !result.name) {
    result.name = nameHint;
  }

  if (!hasExplicitDescription && !result.description && result.body) {
    const firstPara = result.body.trim().split('\n\n')[0] ?? '';
    result.description = firstPara;
  }

  if (openaiYaml && Object.keys(openaiYaml).length > 0) {
    extensions._codexOpenaiYaml = openaiYaml;
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
    const baseTool = tool.split('(')[0];
    switch (baseTool) {
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
    return ['file-read', 'command-exec'];
  }

  const toolSet = new Set(allowedTools.map((t) => t.split('(')[0]));
  if (toolSet.has('Read')) {
    caps.push('file-read');
  }
  if (toolSet.has('Write') || toolSet.has('Edit')) {
    caps.push('file-write');
  }
  if (toolSet.has('Bash')) {
    caps.push('command-exec');
  }

  return caps.length > 0 ? caps : ['file-read', 'command-exec'];
}

function compileFrontmatterToYaml(result: CodexSkillResult): string {
  const output: Record<string, unknown> = {};

  if (result.name) {
    output.name = result.name;
  }
  if (result.description) {
    output.description = result.description;
  }

  if (result.extensions) {
    for (const [key, value] of Object.entries(result.extensions)) {
      if (key.startsWith('_codex')) continue;
      if (key === 'name' || key === 'description') continue;
      output[key] = value;
    }
  }

  if (result.allowedTools && result.allowedTools.length > 0) {
    output['allowed-tools'] = result.allowedTools.join(' ');
  }

  return yaml.dump(output, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

function getInstallPaths(context: ConversionContext<string, CodexSkillResult>): {
  projectDir: string;
  userDir: string;
  skillDirName: string;
} {
  const result = context.normalized;
  const name = result.name || 'unnamed';
  const skillDirName = name;

  const agentsDir = (context.options?.baseDir as string) ?? '.agents';
  const projectDir = join(agentsDir, 'skills', skillDirName);

  const userAgentsDir = (context.options?.userConfigDir as string) ?? join(homedir(), '.agents');
  const userDir = join(userAgentsDir, 'skills', skillDirName);

  return { projectDir, userDir, skillDirName };
}

class CodexAdapter implements Adapter<string, string, CodexSkillResult> {
  manifest: AdapterManifest = { ...MANIFEST };

  detect(source: string): boolean {
    if (!source || typeof source !== 'string') {
      return false;
    }
    if (isContentString(source)) {
      return detectContentHasCodexFields(source);
    }
    const stats = tryStat(source);
    if (!stats) {
      return detectContentHasCodexFields(source);
    }
    return detectFilePath(source);
  }

  parse(source: string): CodexSkillResult {
    let content: string;
    let nameHint: string | undefined;
    let openaiYaml: Record<string, unknown> | undefined;
    let companionDiagnostics: Diagnostic[] = [];

    if (isContentString(source)) {
      content = source;
    } else {
      const stats = tryStat(source);
      if (!stats) {
        content = source;
      } else {
        try {
          content = readFileSync(source, 'utf-8');
          nameHint = parsePath(source.replace(/\\/g, '/')).name;
          const dir = dirname(source);
          const parsedYaml = parseOpenaiYaml(dir, sourcePrefix('parse'));
          openaiYaml = parsedYaml.yamlContent;
          companionDiagnostics = parsedYaml.diagnostics;
        } catch {
          return {
            name: '',
            description: '',
            frontmatter: {},
            body: '',
            diagnostics: [
              {
                severity: 'error',
                message: `cannot read file: ${source}`,
                code: 'CODEX-001',
                source: sourcePrefix('read'),
              },
            ],
          };
        }
      }
    }

    const parseResult = parseYamlFrontmatter(content, source);
    if (parseResult.diagnostics.some((d) => d.severity === 'error' && d.code === 'CODEX-001')) {
      return {
        name: '',
        description: '',
        frontmatter: {},
        body: parseResult.body,
        diagnostics: [...parseResult.diagnostics, ...companionDiagnostics],
      };
    }

    const result = buildCodexResult(
      parseResult.frontmatter,
      parseResult.body,
      nameHint,
      openaiYaml,
      parseResult.diagnostics,
    );

    if (result.name) {
      validateName(result.name, companionDiagnostics, sourcePrefix('parse'));
    }

    if (companionDiagnostics.length > 0) {
      result.diagnostics = [...(result.diagnostics ?? []), ...companionDiagnostics];
    }

    return result;
  }

  normalize(source: string, parsed: CodexSkillResult): NormalizedSkill {
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

  compile(normalized: CodexSkillResult): string {
    const yamlStr = compileFrontmatterToYaml(normalized);
    const body = normalized.body ? `\n${normalized.body}\n` : '\n';
    return `---\n${yamlStr}---${body}`;
  }

  installPlan(context: ConversionContext<string, CodexSkillResult>): InstallPlan {
    const { projectDir, userDir } = getInstallPaths(context);
    return {
      steps: [
        `Copy to project scope: ${join(projectDir, 'SKILL.md')}`,
        `Create directory: ${projectDir}`,
        ...(context.normalized.extensions?._codexOpenaiYaml
          ? [`Copy companion: ${join(projectDir, 'agents', 'openai.yaml')}`]
          : []),
        `Copy to user scope: ${join(userDir, 'SKILL.md')}`,
        `Create directory: ${userDir}`,
        ...(context.normalized.extensions?._codexOpenaiYaml
          ? [`Copy companion: ${join(userDir, 'agents', 'openai.yaml')}`]
          : []),
      ],
      warnings: [],
    };
  }

  install(context: ConversionContext<string, CodexSkillResult>): Result<void, Diagnostic[]> {
    const { projectDir } = getInstallPaths(context);
    const targetDir = (context.options?.installDir as string) ?? projectDir;

    try {
      mkdirSync(targetDir, { recursive: true });
      const compiled = this.compile(context.normalized);
      writeFileSync(join(targetDir, 'SKILL.md'), compiled, 'utf-8');

      const openaiYaml = context.normalized.extensions?._codexOpenaiYaml as
        Record<string, unknown> | undefined;
      if (openaiYaml) {
        const agentsDir = join(targetDir, 'agents');
        mkdirSync(agentsDir, { recursive: true });
        writeFileSync(
          join(agentsDir, 'openai.yaml'),
          yaml.dump(openaiYaml, { lineWidth: 120, noRefs: true }),
          'utf-8',
        );
      }

      return { ok: true, value: undefined };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `failed to install: ${message}`,
            code: 'CODEX-001',
            source: sourcePrefix('install'),
          },
        ],
      };
    }
  }

  uninstall(context: ConversionContext<string, CodexSkillResult>): Result<void, Diagnostic[]> {
    const { projectDir } = getInstallPaths(context);
    const targetDir = (context.options?.installDir as string) ?? projectDir;

    try {
      const skillMdPath = join(targetDir, 'SKILL.md');
      if (existsSync(skillMdPath)) {
        unlinkSync(skillMdPath);
      }
      const openaiYamlPath = join(targetDir, 'agents', 'openai.yaml');
      if (existsSync(openaiYamlPath)) {
        unlinkSync(openaiYamlPath);
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
            code: 'CODEX-001',
            source: sourcePrefix('uninstall'),
          },
        ],
      };
    }
  }

  verify(context: ConversionContext<string, CodexSkillResult>): Result<boolean, Diagnostic[]> {
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
            code: 'CODEX-001',
            source: sourcePrefix('verify'),
          },
        ],
      };
    }
  }

  invoke(_context: ConversionContext<string, CodexSkillResult>): Result<string, Diagnostic[]> {
    return { ok: true, value: '' };
  }
}

const ADAPTER = new CodexAdapter();
export default ADAPTER;
export { CodexAdapter };
