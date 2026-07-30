import { describe, it, expect } from 'vitest';
import { parseSkillMd } from '@skillbridge/parser';
import { validateNormalizedSkill } from '@skillbridge/ir';
import {
  HELLO_WORLD_SKILL,
  FILE_ORGANIZER_SKILL,
  SECRET_ROTATOR_SKILL,
  CODE_ANALYZER_SKILL,
  VENDOR_HOOKS_SKILL,
} from './examples.js';

describe('example skills', () => {
  const examples = [
    { name: 'hello-world', content: HELLO_WORLD_SKILL },
    { name: 'file-organizer', content: FILE_ORGANIZER_SKILL },
    { name: 'secret-rotator', content: SECRET_ROTATOR_SKILL },
    { name: 'code-analyzer', content: CODE_ANALYZER_SKILL },
    { name: 'vendor-hooks', content: VENDOR_HOOKS_SKILL },
  ];

  for (const ex of examples) {
    it(`${ex.name}: parses successfully`, () => {
      const result = parseSkillMd(ex.content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.frontmatter.name).toBe(ex.name);
        expect(typeof result.value.frontmatter.version).toBe('string');
        const desc = result.value.frontmatter.description as string;
        expect(desc).toContain('DEMONSTRATION ONLY');
        expect(desc).toContain('Not intended for production use');
      }
    });
  }

  for (const ex of examples) {
    it(`${ex.name}: validates against NormalizedSkill schema`, () => {
      const parseResult = parseSkillMd(ex.content);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const fm = parseResult.value.frontmatter;
      const normalized = {
        irVersion: '0.1.0',
        identity: {
          name: fm.name as string,
          version: fm.version as string,
          description: fm.description as string,
        },
        capabilities: (fm.capabilities as string[]) || [],
        permissions: (fm.permissions as Array<{ resource: string; actions: string[] }>) || [],
        source: { format: 'markdown' as const },
      };
      const validation = validateNormalizedSkill(normalized);
      expect(validation.ok).toBe(true);
    });
  }

  it('vendor-hooks has vendor-specific fields preserved', () => {
    const result = parseSkillMd(VENDOR_HOOKS_SKILL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = result.value;
      // hooks is not a known frontmatter field, so it's stored in extensions
      expect(parsed.extensions).toBeDefined();
      expect(Object.keys(parsed.extensions ?? {}).length).toBeGreaterThanOrEqual(1);
      // extensions is a known field, stored in frontmatter
      expect(parsed.frontmatter.extensions).toBeDefined();
    }
  });

  it('all examples have description with demonstration disclaimer', () => {
    for (const ex of examples) {
      const result = parseSkillMd(ex.content);
      if (result.ok) {
        const desc = result.value.frontmatter.description as string;
        expect(desc).toContain('DEMONSTRATION ONLY');
        expect(desc).toContain('Not intended for production use');
      }
    }
  });
});
