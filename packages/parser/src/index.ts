import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, normalize, isAbsolute, relative, sep } from 'node:path';
import * as yaml from 'js-yaml';
import type { Result, Diagnostic } from '../../core/src/index.js';
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
  | 'PARSER-010'; // I/O error scanning directory

export interface SkillMdSection {
  heading: string;
  body: string;
}

export interface SkillMdResult {
  frontmatter: Record<string, unknown>;
  sections: SkillMdSection[];
}

export function parseSkillMd(content: string): Result<SkillMdResult, Diagnostic[]> {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed.startsWith('---')) {
    return {
      ok: true,
      value: { frontmatter: {}, sections: parseBodySections(trimmed) },
    };
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return {
      ok: false,
      error: [{ severity: 'error', message: 'unclosed frontmatter block', code: 'PARSER-009' }],
    };
  }

  const rawFrontmatter = trimmed.slice(3, endIndex).trim();
  const bodyStart = trimmed.slice(endIndex + 3).trimStart();

  if (!rawFrontmatter) {
    return { ok: true, value: { frontmatter: {}, sections: parseBodySections(bodyStart) } };
  }

  try {
    const parsed = yaml.load(rawFrontmatter);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        error: [
          {
            severity: 'error',
            message: 'frontmatter must be a YAML mapping (object)',
            code: 'PARSER-009',
          },
        ],
      };
    }
    return {
      ok: true,
      value: {
        frontmatter: parsed as Record<string, unknown>,
        sections: parseBodySections(bodyStart),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: [
        {
          severity: 'error',
          message: `malformed YAML in frontmatter: ${message}`,
          code: 'PARSER-002',
        },
      ],
    };
  }
}

function parseBodySections(body: string): SkillMdSection[] {
  const sections: SkillMdSection[] = [];
  const lines = body.split('\n');
  let currentHeading = '';
  let currentBodyLines: string[] = [];

  function flush() {
    if (currentHeading) {
      sections.push({
        heading: currentHeading,
        body: currentBodyLines.join('\n').trim(),
      });
    }
    currentBodyLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s*(.+)/);
    if (
      headingMatch &&
      headingMatch[1].length > 0 &&
      !headingMatch[1].trimStart().startsWith('#')
    ) {
      flush();
      currentHeading = headingMatch[1].trim();
    } else {
      currentBodyLines.push(line);
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
  if (rel.startsWith('..') || sep === '\\' ? rel.startsWith('..\\') : false) {
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

  // Read SKILL.md (required)
  let hasSkillMd = false;
  let skillMdContent: string | undefined;
  try {
    skillMdContent = await readFile(join(normalizedRoot, 'SKILL.md'), 'utf-8');
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
