import { stringSchema, numberSchema, booleanSchema, enumSchema, arraySchema, objectSchema, optionalSchema, validate, } from '../../schema/src/index.js';
export const CAPABILITY_VOCABULARY_VERSION = '0.1.0';
export const CAPABILITY_VOCABULARY = {
    'file-read': {
        id: 'file-read',
        category: 'filesystem',
        description: 'Read files from the local filesystem',
        since: '0.1.0',
        parameters: {
            pattern: { type: 'string', description: 'Glob pattern of readable files', required: false },
        },
    },
    'file-write': {
        id: 'file-write',
        category: 'filesystem',
        description: 'Write files to the local filesystem',
        since: '0.1.0',
        parameters: {
            pattern: { type: 'string', description: 'Glob pattern of writable files', required: false },
        },
    },
    'command-exec': {
        id: 'command-exec',
        category: 'execution',
        description: 'Execute arbitrary shell commands',
        since: '0.1.0',
        parameters: {
            shell: { type: 'string', description: 'Shell to use (e.g., bash, pwsh)', required: false },
            allow: {
                type: 'enum',
                description: 'Allowed command patterns',
                required: false,
                enumValues: ['all', 'list', 'known-commands'],
            },
        },
    },
    'network-access': {
        id: 'network-access',
        category: 'network',
        description: 'Make outbound network connections',
        since: '0.1.0',
        parameters: {
            hosts: { type: 'string', description: 'Allowed host patterns', required: false },
            ports: { type: 'string', description: 'Allowed port ranges', required: false },
        },
    },
    'env-read': {
        id: 'env-read',
        category: 'environment',
        description: 'Read environment variables',
        since: '0.1.0',
        parameters: {
            vars: { type: 'string', description: 'Allowed environment variable names', required: false },
        },
    },
    'search-files': {
        id: 'search-files',
        category: 'filesystem',
        description: 'Search file contents with pattern matching',
        since: '0.1.0',
    },
    'search-web': {
        id: 'search-web',
        category: 'network',
        description: 'Perform web searches',
        since: '0.1.0',
    },
    'read-sensors': {
        id: 'read-sensors',
        category: 'environment',
        description: 'Read system sensors and hardware information',
        since: '0.1.0',
    },
    'http-get': {
        id: 'http-get',
        category: 'network',
        description: 'Perform HTTP GET requests',
        since: '0.1.0',
        parameters: {
            hosts: { type: 'string', description: 'Allowed host patterns', required: false },
        },
    },
    'http-post': {
        id: 'http-post',
        category: 'network',
        description: 'Perform HTTP POST requests',
        since: '0.1.0',
        parameters: {
            hosts: { type: 'string', description: 'Allowed host patterns', required: false },
        },
    },
    'process-spawn': {
        id: 'process-spawn',
        category: 'execution',
        description: 'Spawn and manage child processes',
        since: '0.1.0',
    },
    'read-registry': {
        id: 'read-registry',
        category: 'filesystem',
        description: 'Read from the system registry',
        since: '0.1.0',
    },
    'write-registry': {
        id: 'write-registry',
        category: 'filesystem',
        description: 'Write to the system registry',
        since: '0.1.0',
    },
    'list-directory': {
        id: 'list-directory',
        category: 'filesystem',
        description: 'List directory contents',
        since: '0.1.0',
    },
    'read-file-system-meta': {
        id: 'read-file-system-meta',
        category: 'filesystem',
        description: 'Read filesystem metadata (stat, permissions)',
        since: '0.1.0',
    },
    secrets: {
        id: 'secrets',
        category: 'secrets',
        description: 'Access and manage secrets and API keys',
        since: '0.1.0',
        parameters: {
            keys: { type: 'string', description: 'Allowed secret key patterns', required: false },
        },
    },
    subagent: {
        id: 'subagent',
        category: 'execution',
        description: 'Spawn and coordinate sub-agents',
        since: '0.1.0',
        parameters: {
            maxAgents: {
                type: 'number',
                description: 'Maximum number of concurrent sub-agents',
                required: false,
            },
        },
    },
    hooks: {
        id: 'hooks',
        category: 'integration',
        description: 'Register and invoke lifecycle hooks',
        since: '0.1.0',
        parameters: {
            events: {
                type: 'string',
                description: 'Allowed hook event names',
                required: false,
            },
        },
    },
    mcp: {
        id: 'mcp',
        category: 'integration',
        description: 'Model Context Protocol support',
        since: '0.1.0',
        parameters: {
            servers: { type: 'string', description: 'Allowed MCP server patterns', required: false },
        },
    },
    template: {
        id: 'template',
        category: 'execution',
        description: 'Render templates with variable substitution',
        since: '0.1.0',
        parameters: {
            engine: {
                type: 'string',
                description: 'Template engine (e.g., mustache, handlebars)',
                required: false,
            },
        },
    },
    'user-prompt': {
        id: 'user-prompt',
        category: 'prompting',
        description: 'Prompt the user for interactive input',
        since: '0.1.0',
        parameters: {
            confirmRequired: {
                type: 'boolean',
                description: 'Whether confirmation is required',
                required: false,
            },
        },
    },
    'installation-scope': {
        id: 'installation-scope',
        category: 'installation',
        description: 'Declare required installation scope and permissions',
        since: '0.1.0',
        parameters: {
            scope: {
                type: 'enum',
                description: 'Installation scope',
                required: false,
                enumValues: ['user', 'workspace', 'global'],
            },
        },
    },
    'execution-mode': {
        id: 'execution-mode',
        category: 'execution',
        description: 'Control execution mode constraints',
        since: '0.1.0',
        parameters: {
            mode: {
                type: 'enum',
                description: 'Execution mode',
                required: false,
                enumValues: ['sandbox', 'unsafe', 'contained'],
            },
        },
    },
};
const VENDOR_PREFIX_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\/[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const KNOWN_CAPABILITIES = new Set(Object.keys(CAPABILITY_VOCABULARY));
export function getCapabilityDefinition(id) {
    if (id in CAPABILITY_VOCABULARY) {
        return { ok: true, value: CAPABILITY_VOCABULARY[id] };
    }
    return {
        ok: false,
        error: [
            {
                severity: 'info',
                message: `unknown capability '${id}'`,
                code: 'IR-002',
                source: id,
            },
        ],
    };
}
export function isValidCapability(id) {
    return KNOWN_CAPABILITIES.has(id) || VENDOR_PREFIX_RE.test(id);
}
// Schemas
const irVersionSchema = enumSchema(['0.1.0']);
const capabilitySchema = enumSchema([
    'file-read',
    'file-write',
    'command-exec',
    'network-access',
    'env-read',
    'search-files',
    'search-web',
    'read-sensors',
    'http-get',
    'http-post',
    'process-spawn',
    'read-registry',
    'write-registry',
    'list-directory',
    'read-file-system-meta',
    'secrets',
    'subagent',
    'hooks',
    'mcp',
    'template',
    'user-prompt',
    'installation-scope',
    'execution-mode',
]);
const capabilityRequirementSchema = objectSchema({
    id: capabilitySchema,
    required: booleanSchema(),
    parameters: optionalSchema(objectSchema({})),
});
const sourceFormatSchema = enumSchema(['markdown', 'yaml', 'json', 'package']);
const skillIdentitySchema = objectSchema({
    name: stringSchema(),
    version: stringSchema({ pattern: /^\d+\.\d+\.\d+$/ }),
    description: optionalSchema(stringSchema()),
});
const invocationGuidanceSchema = objectSchema({
    instructions: stringSchema(),
    example: optionalSchema(stringSchema()),
});
const skillIOSchema = objectSchema({
    name: stringSchema(),
    description: optionalSchema(stringSchema()),
    type: stringSchema(),
    required: optionalSchema(booleanSchema()),
});
const skillResourceSchema = objectSchema({
    pattern: stringSchema(),
    description: optionalSchema(stringSchema()),
});
const skillScriptSchema = objectSchema({
    name: stringSchema(),
    command: stringSchema(),
    args: optionalSchema(arraySchema(stringSchema())),
});
const skillToolSchema = objectSchema({
    name: stringSchema(),
    description: optionalSchema(stringSchema()),
    inputSchema: optionalSchema(objectSchema({})),
});
const permissionSchema = objectSchema({
    resource: stringSchema(),
    actions: arraySchema(stringSchema()),
});
const environmentRequirementSchema = objectSchema({
    key: stringSchema(),
    description: optionalSchema(stringSchema()),
    required: optionalSchema(booleanSchema()),
});
const executionRequirementSchema = objectSchema({
    runtime: optionalSchema(stringSchema()),
    timeout: optionalSchema(numberSchema({ integer: true })),
    memory: optionalSchema(stringSchema({ pattern: /^\d+(MB|GB)$/ })),
});
const conversionStepSchema = objectSchema({
    adapter: stringSchema(),
    timestamp: stringSchema(),
    version: optionalSchema(stringSchema()),
});
const provenanceSchema = objectSchema({
    convertedAt: optionalSchema(stringSchema()),
    convertedBy: optionalSchema(stringSchema()),
    sourcePackage: optionalSchema(stringSchema()),
    history: optionalSchema(arraySchema(conversionStepSchema)),
});
const licenseMetadataSchema = objectSchema({
    license: optionalSchema(stringSchema()),
    notice: optionalSchema(stringSchema()),
});
const sourceMetadataSchema = objectSchema({
    format: sourceFormatSchema,
    version: optionalSchema(stringSchema()),
    path: optionalSchema(stringSchema()),
});
export const normalizedSkillSchema = objectSchema({
    irVersion: irVersionSchema,
    identity: skillIdentitySchema,
    invocation: optionalSchema(invocationGuidanceSchema),
    inputs: optionalSchema(arraySchema(skillIOSchema)),
    outputs: optionalSchema(arraySchema(skillIOSchema)),
    resources: optionalSchema(arraySchema(skillResourceSchema)),
    scripts: optionalSchema(arraySchema(skillScriptSchema)),
    capabilities: arraySchema(capabilitySchema),
    tools: optionalSchema(arraySchema(skillToolSchema)),
    permissions: arraySchema(permissionSchema),
    environment: optionalSchema(arraySchema(environmentRequirementSchema)),
    execution: optionalSchema(executionRequirementSchema),
    provenance: optionalSchema(provenanceSchema),
    license: optionalSchema(licenseMetadataSchema),
    source: sourceMetadataSchema,
    extensions: optionalSchema(objectSchema({})),
});
export function validateNormalizedSkill(value) {
    return validate(normalizedSkillSchema, value);
}
export function validateCapabilityRequirement(value) {
    return validate(capabilityRequirementSchema, value);
}
const packageManifestSchema = objectSchema({
    name: optionalSchema(stringSchema()),
    version: optionalSchema(stringSchema()),
    description: optionalSchema(stringSchema()),
    author: optionalSchema(stringSchema()),
    license: optionalSchema(stringSchema()),
    scripts: optionalSchema(objectSchema({})),
    dependencies: optionalSchema(objectSchema({})),
});
export function validatePackageManifest(value) {
    return validate(packageManifestSchema, value);
}
export function migrateIRPackage(pkg, targetVersion) {
    if (pkg.irVersion === targetVersion) {
        return { ok: true, value: pkg };
    }
    if (pkg.irVersion === '0.1.0' && targetVersion === '0.1.0') {
        return { ok: true, value: pkg };
    }
    return {
        ok: false,
        error: [
            {
                severity: 'error',
                message: `Migration from ${pkg.irVersion} to ${targetVersion} is not supported`,
                code: 'IR-001',
            },
        ],
    };
}
//# sourceMappingURL=index.js.map