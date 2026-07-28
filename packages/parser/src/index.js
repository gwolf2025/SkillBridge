import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, normalize, isAbsolute, relative, sep } from 'node:path';
import * as yaml from 'js-yaml';
import { validatePackageManifest } from '../../ir/src/index.js';
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
const FIELD_EXPECTED_TYPES = {
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
function typeMatches(value, expected) {
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
            return (typeof value === 'string' ||
                (typeof value === 'object' && value !== null && !Array.isArray(value)));
        default:
            return true;
    }
}
function findKeyLineIndex(lines, key) {
    const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`);
    for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]))
            return i;
    }
    return 0;
}
function lineAtOffset(text, offset) {
    return text.slice(0, Math.min(offset, text.length)).split('\n').length;
}
export function parseSkillMd(content, file) {
    const diagnostics = [];
    const loc = (line, column = 1) => ({ line, column, file });
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
    let parsed;
    try {
        parsed = yaml.load(trimmedFm);
    }
    catch (err) {
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
    const record = parsed;
    const frontmatter = {};
    const extensions = {};
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
        }
        else {
            extensions[key] = value;
        }
    }
    const result = {
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
function parseBodySections(body, startLine, file) {
    const sections = [];
    const lines = body.split('\n');
    let currentHeading = '';
    let currentBodyLines = [];
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
        if (headingMatch &&
            headingMatch[1].length > 0 &&
            !headingMatch[1].trimStart().startsWith('#')) {
            flush();
            currentHeading = headingMatch[1].trim();
            headingLineNumber = startLine + i;
        }
        else {
            currentBodyLines.push(lines[i]);
        }
    }
    flush();
    return sections;
}
export function parseSkillbridgeYaml(content) {
    const diagnostics = [];
    let parsed;
    try {
        parsed = yaml.load(content);
    }
    catch (err) {
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
    const record = parsed;
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
                manifest: record,
                diagnostics,
            },
        };
    }
    const validated = validationResult.value;
    return {
        ok: true,
        value: {
            manifest: {
                name: validated.name ?? record.name,
                version: validated.version ?? record.version,
                description: validated.description ?? record.description,
                author: validated.author ?? record.author,
                license: validated.license ?? record.license,
                scripts: record.scripts,
                dependencies: record.dependencies,
            },
            diagnostics,
        },
    };
}
export function validatePackagePath(proposedPath, packageRoot) {
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
export async function discoverResources(packagePath) {
    const dirs = {
        scripts: [],
        references: [],
        templates: [],
        examples: [],
        assets: [],
        tests: [],
    };
    const subdirNames = [
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
        }
        catch {
            // directory doesn't exist — not an error
        }
    }
    return { ok: true, value: dirs };
}
export async function loadPackage(path) {
    const diagnostics = [];
    const normalizedRoot = normalize(resolve(path));
    // Read SKILL.md (required)
    let hasSkillMd = false;
    let skillMdContent;
    try {
        skillMdContent = await readFile(join(normalizedRoot, 'SKILL.md'), 'utf-8');
        hasSkillMd = true;
    }
    catch {
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
    else if (parseResult.value.diagnostics) {
        diagnostics.push(...parseResult.value.diagnostics);
    }
    // Read skillbridge.yaml (optional)
    let manifest;
    try {
        const yamlContent = await readFile(join(normalizedRoot, 'skillbridge.yaml'), 'utf-8');
        const yamlResult = parseSkillbridgeYaml(yamlContent);
        if (!yamlResult.ok) {
            diagnostics.push(...yamlResult.error);
        }
        else {
            manifest = yamlResult.value.manifest;
            diagnostics.push(...yamlResult.value.diagnostics);
        }
    }
    catch {
        // skillbridge.yaml is optional — not an error
    }
    // Check for LICENSE and NOTICE
    let hasLicense = false;
    let hasNotice = false;
    try {
        await stat(join(normalizedRoot, 'LICENSE'));
        hasLicense = true;
    }
    catch {
        /* optional */
    }
    try {
        await stat(join(normalizedRoot, 'NOTICE'));
        hasNotice = true;
    }
    catch {
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
//# sourceMappingURL=index.js.map