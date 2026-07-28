import { describe, it, expect } from 'vitest';
import { normalizePackageToIR } from '../normalize.js';
import type { NormalizationInput, FieldProvenance } from '../normalize.js';
import type { SkillMdResult, SkillMdSection } from '../../../parser/src/index.js';

function input(
  overrides: Partial<NormalizationInput> & { skillMd: SkillMdResult },
): NormalizationInput {
  return {
    resourceDirs: {
      scripts: [],
      references: [],
      templates: [],
      examples: [],
      assets: [],
      tests: [],
    },
    packagePath: '/test/pkg',
    ...overrides,
  };
}

function fm(data: Record<string, unknown>): SkillMdResult {
  return { frontmatter: data, sections: [] };
}

function fmSections(data: Record<string, unknown>, sections: SkillMdSection[]): SkillMdResult {
  return { frontmatter: data, sections };
}

describe('normalizePackageToIR', () => {
  it('produces a complete NormalizedSkill from valid SKILL.md + skillbridge.yaml', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fm({
          name: 'my-skill',
          version: '1.0.0',
          description: 'A test skill',
          capabilities: ['file-read'],
          permissions: [{ resource: 'fs', actions: ['read'] }],
        }),
        manifest: {
          name: 'my-skill',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT',
          scripts: { build: 'tsc' },
        },
      }),
    );
    expect(result.normalized.identity.name).toBe('my-skill');
    expect(result.normalized.identity.version).toBe('1.0.0');
    expect(result.normalized.identity.description).toBe('A test skill');
    expect(result.normalized.capabilities).toEqual(['file-read']);
    expect(result.normalized.permissions).toEqual([{ resource: 'fs', actions: ['read'] }]);
    expect(result.normalized.license?.license).toBe('MIT');
    expect(result.normalized.extensions?.author).toBe('Test Author');
    expect(result.normalized.scripts).toEqual([{ name: 'build', command: 'tsc' }]);
    expect(result.normalized.source).toEqual({ format: 'markdown', path: '/test/pkg' });
    expect(result.diagnostics).toHaveLength(0);
  });

  it('reports CONV-006 for missing name and version', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fm({ description: 'no identity' }),
      }),
    );
    expect(result.normalized.identity.name).toBe('');
    expect(result.normalized.identity.version).toBe('');
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c === 'CONV-006')).toHaveLength(2);
  });

  it('emits CONV-002 warning when skillbridge.yaml name conflicts with frontmatter', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fm({ name: 'frontmatter-name', version: '1.0.0' }),
        manifest: { name: 'yaml-name', version: '1.0.0' },
      }),
    );
    expect(result.normalized.identity.name).toBe('frontmatter-name');
    expect(result.diagnostics.some((d) => d.code === 'CONV-002')).toBe(true);
  });

  it('maps Description and Usage body sections to invocation', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fmSections({ name: 's', version: '1.0.0' }, [
          { heading: 'Description', body: 'This skill does X.' },
          { heading: 'Usage', body: 'skillbridge s <arg>' },
        ]),
      }),
    );
    expect(result.normalized.invocation?.instructions).toBe('This skill does X.');
    expect(result.normalized.invocation?.example).toBe('skillbridge s <arg>');
  });

  it('stores unrecognized body sections in extensions with CONV-003 info', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fmSections({ name: 's', version: '1.0.0' }, [
          { heading: 'CustomSection', body: 'some value' },
        ]),
      }),
    );
    expect(result.normalized.extensions?.CustomSection).toBe('some value');
    expect(result.diagnostics.some((d) => d.code === 'CONV-003')).toBe(true);
  });

  it('emits CONV-004 for malformed YAML in Inputs section', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fmSections({ name: 's', version: '1.0.0' }, [
          { heading: 'Inputs', body: '[invalid-yaml' },
        ]),
      }),
    );
    expect(result.diagnostics.some((d) => d.code === 'CONV-004')).toBe(true);
  });

  it('preserves unknown frontmatter fields in extensions', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: {
          frontmatter: { name: 's', version: '1.0.0' },
          sections: [],
          extensions: { 'x-custom': 'custom-value' },
        },
      }),
    );
    expect(result.normalized.extensions?.['x-custom']).toBe('custom-value');
  });

  it('tracks provenance for every normalized field', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fm({
          name: 'prov-skill',
          version: '2.0.0',
          capabilities: ['file-read'],
        }),
        manifest: { license: 'Apache-2.0' },
      }),
    );
    expect(result.provenances.length).toBeGreaterThan(0);
    const fields = result.provenances.map((p: FieldProvenance) => p.field);
    expect(fields).toContain('identity.name');
    expect(fields).toContain('identity.version');
    expect(fields).toContain('capabilities');
    expect(fields).toContain('license.license');
  });

  it('emits CONV-002 when scripts from both sources differ', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fm({
          name: 's',
          version: '1.0.0',
          scripts: [{ name: 'build', command: 'tsc' }],
        }),
        manifest: { scripts: { build: 'webpack' } },
      }),
    );
    const overwrites = result.diagnostics.filter((d) => d.code === 'CONV-002');
    expect(overwrites.some((d) => d.source === 'scripts')).toBe(true);
  });

  it('emits CONV-005 for unknown fields in skillbridge.yaml via rawYamlRecord', () => {
    const result = normalizePackageToIR(
      input({
        skillMd: fm({ name: 's', version: '1.0.0' }),
        manifest: { name: 's', version: '1.0.0' },
        rawYamlRecord: { name: 's', version: '1.0.0', customField: 'hello' },
      }),
    );
    expect(result.normalized.extensions?.skillbridge).toEqual({ customField: 'hello' });
    expect(result.diagnostics.some((d) => d.code === 'CONV-005')).toBe(true);
  });
});
