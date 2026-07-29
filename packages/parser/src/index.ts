import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, normalize, isAbsolute, relative } from 'node:path';
import * as yaml from 'js-yaml';
import type { Result, Diagnostic, SourceLocation } from '../../core/src/index.js';
import { hasReservedWindowsFilename, stripBom } from '../../core/src/win32.js';
import type {
  PackageManifest,
  SkillPackageMeta,
  SkillPackageResourceDirs,
} from '../../ir/src/index.js';
import { validatePackageManifest } from '../../ir/src/index.js';

export type ParserErrorCode =
  | 'PARSER-001' // missing SKILL.md
  | 'PARSER-002' // malformed YAML in frontmatter
  | 'PARSER-003' // malformed skillbridge.yaml
  | 'PARSER-004' // path traversal detected
  | 'PARSER-005' // absolute path not allowed
  | 'PARSER-006' // path outside package root
  | 'PARSER-007' // I/O error reading file
  | 'PARSER-008' // unknown field in skillbridge.yaml
  | 'PARSER-009' // invalid frontmatter structure
  | 'PARSER-010' // I/O error scanning directory
  | 'PARSER-011' // wrong type for known frontmatter field
  | 'PARSER-012'; // document-level note

export interface SkillMdSection {
  heading: string;
  body: string;
  location?: SourceLocation;
}

export interface SkillMdResult {
  frontmatter: Record<string, unknown>;
  sections: SkillMdSection[];
  extensions?: Record<string, unknown>;
  diagnostics?: Diagnostic[];
}

const KNOWN_FRONTMATTER_FIELDS = new Set([
  'name',
  'version',
  'description',
  'capabilities',
  'permissions',
  'tools',
  'scripts',
  'inputs',
  'outputs',
  'resources',
  'environment',
  'execution',
  'invocation',
  'license',
  'source',
  'irVersion',
  'provenance',
  'extensions',
]);

const FIELD_EXPECTED_TYPES: Record<string, string> = {
  name: 'string',
  version: 'string',
  description: 'string',
  irVersion: 'string',
  capabilities: 'array',
  permissions: 'array',
  tools: 'array',
  scripts: 'array',
  inputs: 'array',
  outputs: 'array',
  resources: 'array',
  environment: 'array',
  execution: 'object',
  invocation: 'object',
  source: 'object',
  license: 'string or object',
  provenance: 'object',
  extensions: 'object',
};

function typeMatches(value: unknown, expected: string): boolean {
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'string or object':
      return (
        typeof value === 'string' ||
        (typeof value === 'object' && value !== null && !Array.isArray(value))
      );
    default:
      return true;
  }
}

function findKeyLineIndex(lines: string[], key: string): number {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  return 0;
}

function lineAtOffset(text: string, offset: number): number {
  return text.slice(0, Math.min(offset, text.length)).split('\n').length;
}

export function parseSkillMd(content: string, file?: string): Result<SkillMdResult, Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];

  const loc = (line: number, column = 1): SourceLocation => ({ line, column, file });

  const normalized = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

  if (!normalized.startsWith('---')) {
    return {
      ok: true,
      value: {
        frontmatter: {},
        sections: parseBodySections(normalized, 1, file),
      },
    };
  }

  const endIndex = normalized.indexOf('---', 3);
  const frontmatterStartLine = 1;

  if (endIndex === -1) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'unclosed frontmatter block',
          code: 'PARSER-009',
          location: loc(frontmatterStartLine),
        },
      ],
    };
  }

  const rawFrontmatter = normalized.slice(3, endIndex);
  const trimmedFm = rawFrontmatter.trim();
  const bodyStart = normalized.slice(endIndex + 3);
  const bodyStartLine = lineAtOffset(normalized, endIndex + 3);

  if (!trimmedFm) {
    return {
      ok: true,
      value: {
        frontmatter: {},
        sections: parseBodySections(bodyStart, bodyStartLine, file),
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(trimmedFm);
  } catch (err: unknown) {
    if (err instanceof yaml.YAMLException && err.mark) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: `malformed YAML in frontmatter: ${err.message}`,
            code: 'PARSER-002',
            location: loc(frontmatterStartLine + err.mark.line, err.mark.column + 1),
          },
        ],
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `malformed YAML in frontmatter: ${message}`,
          code: 'PARSER-002',
          location: loc(frontmatterStartLine + 1),
        },
      ],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'frontmatter must be a YAML mapping (object)',
          code: 'PARSER-009',
          location: loc(frontmatterStartLine + 1),
        },
      ],
    };
  }

  const record = parsed as Record<string, unknown>;
  const frontmatter: Record<string, unknown> = {};
  const extensions: Record<string, unknown> = {};
  const rawFmLines = rawFrontmatter.split('\n');

  for (const [key, value] of Object.entries(record)) {
    if (KNOWN_FRONTMATTER_FIELDS.has(key)) {
      frontmatter[key] = value;
      const expectedType = FIELD_EXPECTED_TYPES[key];
      if (expectedType && !typeMatches(value, expectedType)) {
        const keyLineIndex = findKeyLineIndex(rawFmLines, key);
        const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
        diagnostics.push({
          severity: 'warning',
          message: `expected '${key}' to be ${expectedType}, got ${valueType}`,
          code: 'PARSER-011',
          source: key,
          location: loc(frontmatterStartLine + keyLineIndex),
        });
      }
    } else {
      extensions[key] = value;
    }
  }

  const result: SkillMdResult = {
    frontmatter,
    sections: parseBodySections(bodyStart, bodyStartLine, file),
  };
  if (Object.keys(extensions).length > 0) {
    result.extensions = extensions;
  }
  if (diagnostics.length > 0) {
    result.diagnostics = diagnostics;
  }

  return { ok: true, value: result };
}

function parseBodySections(body: string, startLine: number, file?: string): SkillMdSection[] {
  const sections: SkillMdSection[] = [];
  const lines = body.split('\n');
  let currentHeading = '';
  let currentBodyLines: string[] = [];
  let headingLineNumber = 1;

  function flush() {
    if (currentHeading) {
      sections.push({
        heading: currentHeading,
        body: currentBodyLines.join('\n').trim(),
        location: { line: headingLineNumber, column: 1, file },
      });
    }
    currentBodyLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^##\s*(.+)/);
    if (
      headingMatch &&
      headingMatch[1].length > 0 &&
      !headingMatch[1].trimStart().startsWith('#')
    ) {
      flush();
      currentHeading = headingMatch[1].trim();
      headingLineNumber = startLine + i;
    } else {
      currentBodyLines.push(lines[i]);
    }
  }
  flush();

  return sections;
}

export interface SkillbridgeYamlResult {
  manifest: PackageManifest;
  diagnostics: Diagnostic[];
}

export function parseSkillbridgeYaml(content: string): Result<SkillbridgeYamlResult, Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `malformed skillbridge.yaml: ${message}`,
          code: 'PARSER-003',
        },
      ],
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: 'skillbridge.yaml must be a YAML mapping',
          code: 'PARSER-003',
        },
      ],
    };
  }

  const knownFields = new Set([
    'name',
    'version',
    'description',
    'author',
    'license',
    'scripts',
    'dependencies',
  ]);
  const record = parsed as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!knownFields.has(key)) {
      diagnostics.push({
        severity: 'warning',
        message: `unknown field '${key}' in skillbridge.yaml`,
        code: 'PARSER-008',
        source: key,
      });
    }
  }

  const validationResult = validatePackageManifest(record);
  if (!validationResult.ok) {
    diagnostics.push(...validationResult.error);
    return {
      ok: true,
      value: {
        manifest: record as unknown as PackageManifest,
        diagnostics,
      },
    };
  }

  const validated = validationResult.value;
  return {
    ok: true,
    value: {
      manifest: {
        name: validated.name ?? (record.name as string | undefined),
        version: validated.version ?? (record.version as string | undefined),
        description: validated.description ?? (record.description as string | undefined),
        author: validated.author ?? (record.author as string | undefined),
        license: validated.license ?? (record.license as string | undefined),
        scripts: record.scripts as Record<string, string> | undefined,
        dependencies: record.dependencies as Record<string, string> | undefined,
      },
      diagnostics,
    },
  };
}

export function validatePackagePath(
  proposedPath: string,
  packageRoot: string,
): Result<string, Diagnostic[]> {
  const normalizedRoot = normalize(resolve(packageRoot));

  if (hasReservedWindowsFilename(proposedPath)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `path contains reserved Windows filename: ${proposedPath}`,
          code: 'PARSER-013',
        },
      ],
    };
  }

  if (isAbsolute(proposedPath)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `absolute path not allowed: ${proposedPath}`,
          code: 'PARSER-005',
        },
      ],
    };
  }

  const normalized = normalize(join(packageRoot, proposedPath));

  if (!normalized.startsWith(normalizedRoot)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `path escapes package root: ${proposedPath}`,
          code: 'PARSER-004',
        },
      ],
    };
  }

  const rel = relative(normalizedRoot, normalized);
  const hasTraversal = rel
    .replace(/\\/g, '/')
    .split('/')
    .some((part) => part === '..');
  if (hasTraversal) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `path traversal detected: ${proposedPath}`,
          code: 'PARSER-004',
        },
      ],
    };
  }

  return { ok: true, value: normalized };
}

export async function discoverResources(
  packagePath: string,
): Promise<Result<SkillPackageResourceDirs, Diagnostic[]>> {
  const dirs: SkillPackageResourceDirs = {
    scripts: [],
    references: [],
    templates: [],
    examples: [],
    assets: [],
    tests: [],
  };

  const subdirNames: (keyof SkillPackageResourceDirs)[] = [
    'scripts',
    'references',
    'templates',
    'examples',
    'assets',
    'tests',
  ];

  for (const name of subdirNames) {
    const dirPath = join(packagePath, name);
    try {
      const dirStat = await stat(dirPath);
      if (dirStat.isDirectory()) {
        const entries = await readdir(dirPath);
        dirs[name] = entries.filter((e) => !e.startsWith('.')).map((e) => join(name, e));
      }
    } catch {
      // directory doesn't exist — not an error
    }
  }

  return { ok: true, value: dirs };
}

export async function loadPackage(path: string): Promise<Result<SkillPackageMeta, Diagnostic[]>> {
  const diagnostics: Diagnostic[] = [];
  const normalizedRoot = normalize(resolve(path));

  if (hasReservedWindowsFilename(path)) {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `path contains reserved Windows filename: ${path}`,
          code: 'PARSER-013',
        },
      ],
    };
  }

  // Read SKILL.md (required)
  let hasSkillMd = false;
  let skillMdContent: string | undefined;
  try {
    skillMdContent = stripBom(await readFile(join(normalizedRoot, 'SKILL.md'), 'utf-8'));
    hasSkillMd = true;
  } catch {
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `missing required SKILL.md in ${normalizedRoot}`,
          code: 'PARSER-001',
        },
      ],
    };
  }

  // Parse SKILL.md for diagnostics (frontmatter structure)
  const parseResult = parseSkillMd(skillMdContent);
  if (!parseResult.ok) {
    diagnostics.push(...parseResult.error);
  } else if (parseResult.value.diagnostics) {
    diagnostics.push(...parseResult.value.diagnostics);
  }

  // Read skillbridge.yaml (optional)
  let manifest: PackageManifest | undefined;
  try {
    const yamlContent = await readFile(join(normalizedRoot, 'skillbridge.yaml'), 'utf-8');
    const yamlResult = parseSkillbridgeYaml(yamlContent);
    if (!yamlResult.ok) {
      diagnostics.push(...yamlResult.error);
    } else {
      manifest = yamlResult.value.manifest;
      diagnostics.push(...yamlResult.value.diagnostics);
    }
  } catch {
    // skillbridge.yaml is optional — not an error
  }

  // Check for LICENSE and NOTICE
  let hasLicense = false;
  let hasNotice = false;
  try {
    await stat(join(normalizedRoot, 'LICENSE'));
    hasLicense = true;
  } catch {
    /* optional */
  }
  try {
    await stat(join(normalizedRoot, 'NOTICE'));
    hasNotice = true;
  } catch {
    /* optional */
  }

  // Discover resource directories
  const resourceResult = await discoverResources(normalizedRoot);
  if (!resourceResult.ok) {
    diagnostics.push(...resourceResult.error);
  }

  return {
    ok: true,
    value: {
      path: normalizedRoot,
      manifest,
      hasSkillMd,
      hasLicense,
      hasNotice,
      resourceDirs: resourceResult.ok
        ? resourceResult.value
        : { scripts: [], references: [], templates: [], examples: [], assets: [], tests: [] },
      diagnostics,
    },
  };
}
