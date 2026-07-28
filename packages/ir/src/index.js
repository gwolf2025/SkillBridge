import { stringSchema, numberSchema, booleanSchema, enumSchema, arraySchema, objectSchema, optionalSchema, validate, } from '../../schema/src/index.js';
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
]);
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