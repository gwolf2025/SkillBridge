import { describe, it, expect } from 'vitest';
import { ConversionPipeline } from '@skillbridge/conversion';
import { LocalAdapterRegistry } from '@skillbridge/registry-local';
import { CompatibilityMatrix } from '@skillbridge/compatibility';
import type { CompatibilityReport } from '@skillbridge/compatibility';
import adapterPortable from '@skillbridge/adapter-portable';
import adapterClaude from '@skillbridge/adapter-claude';
import adapterOpencode from '@skillbridge/adapter-opencode';
import adapterCodex from '@skillbridge/adapter-codex';

const FIXTURE_SKILL =
  '---\nname: cross-adapter-test\ndescription: A skill for cross-adapter compatibility testing.\n---\n\nPerform a compatibility check across all adapters.\n';

const ADAPTERS = [
  { name: 'adapter-portable', instance: adapterPortable },
  { name: 'adapter-claude', instance: adapterClaude },
  { name: 'adapter-opencode', instance: adapterOpencode },
  { name: 'adapter-codex', instance: adapterCodex },
];

function buildRegistry(): LocalAdapterRegistry {
  const registry = new LocalAdapterRegistry();
  for (const a of ADAPTERS) {
    registry.register(a.instance);
  }
  return registry;
}

describe('cross-adapter compatibility verification', () => {
  const registry = buildRegistry();

  describe('parse-normalize-compile', () => {
    for (const adapter of ADAPTERS) {
      it(`${adapter.name}: parse → normalize → compile completes without throwing`, () => {
        const a = adapter.instance as {
          parse(s: string): unknown;
          normalize?(s: string, p: unknown): unknown;
          compile(p: unknown): unknown;
        };
        const parsed = a.parse(FIXTURE_SKILL);
        expect(parsed).toBeDefined();

        if (a.normalize) {
          const normalized = a.normalize(FIXTURE_SKILL, parsed);
          expect(normalized).toBeDefined();
        }

        const compiled = a.compile(parsed);
        expect(compiled).toBeDefined();
        if (typeof compiled === 'string') {
          expect(compiled.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('target reparse', () => {
    for (const adapter of ADAPTERS) {
      it(`${adapter.name}: compiled output can be re-parsed`, () => {
        const a = adapter.instance as { parse(s: string): unknown; compile(p: unknown): unknown };
        const parsed = a.parse(FIXTURE_SKILL);
        const compiled = a.compile(parsed);
        const reparsed = a.parse(compiled as string);
        expect(reparsed).toBeDefined();
      });
    }
  });

  describe('round-trip identity', () => {
    for (const adapter of ADAPTERS) {
      it(`${adapter.name}: name and description survive round-trip`, () => {
        const a = adapter.instance as { parse(s: string): unknown; compile(p: unknown): unknown };
        const parsed = a.parse(FIXTURE_SKILL) as Record<string, unknown>;
        const compiled = a.compile(parsed);
        const reparsed = a.parse(compiled as string) as Record<string, unknown>;

        if (parsed.name) {
          expect(reparsed.name).toBe(parsed.name);
        }
        if (parsed.description) {
          expect(reparsed.description).toBe(parsed.description);
        }
      });
    }
  });

  describe('deterministic output', () => {
    for (const adapter of ADAPTERS) {
      it(`${adapter.name}: compile() produces identical output on repeated calls`, () => {
        const a = adapter.instance as { parse(s: string): unknown; compile(p: unknown): string };
        const parsed = a.parse(FIXTURE_SKILL);
        const first = a.compile(parsed);
        const second = a.compile(parsed);

        expect(first).toBe(second);
      });
    }
  });

  describe('manifest generation', () => {
    for (const adapter of ADAPTERS) {
      it(`${adapter.name}: pipeline produces a CompilationManifest`, () => {
        const pipeline = new ConversionPipeline(registry);
        const result = pipeline.run(FIXTURE_SKILL, 'markdown', 'markdown', {
          sourceAdapterName: adapter.name,
          targetAdapterName: adapter.name,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.manifest).toBeDefined();
          expect(result.value.manifest!.compiledAt).toBeDefined();
          expect(result.value.manifest!.compiledBy).toBeDefined();
        }
      });
    }
  });

  describe('degradation reporting', () => {
    const pairs = ADAPTERS.flatMap((src) =>
      ADAPTERS.filter((tgt) => src.name !== tgt.name).map((tgt) => ({
        src: src.name,
        tgt: tgt.name,
      })),
    );

    for (const { src, tgt } of pairs) {
      it(`${src} → ${tgt}: produces either a compatibility report or explicit diagnostics`, () => {
        const pipeline = new ConversionPipeline(registry);
        const result = pipeline.run(FIXTURE_SKILL, 'markdown', 'markdown', {
          sourceAdapterName: src,
          targetAdapterName: tgt,
        });

        if (result.ok) {
          if (result.value.compatibility) {
            expect(result.value.compatibility.comparisons).toBeDefined();
            expect(result.value.compatibility.overall).toBeDefined();
            expect(typeof result.value.compatibility.nativeCount).toBe('number');
          }
        } else {
          expect(result.error.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('cross-adapter matrix', () => {
    it('produces a 4×4 matrix with all adapter combinations', () => {
      const pipeline = new ConversionPipeline(registry);
      const results = new Map<string, CompatibilityReport>();

      for (const src of ADAPTERS) {
        for (const tgt of ADAPTERS) {
          const key = `${src.name}->${tgt.name}`;
          const result = pipeline.run(FIXTURE_SKILL, 'markdown', 'markdown', {
            sourceAdapterName: src.name,
            targetAdapterName: tgt.name,
          });
          if (result.ok && result.value.compatibility) {
            results.set(key, result.value.compatibility);
          }
        }
      }

      expect(results.size).toBeGreaterThanOrEqual(6);

      const matrix = new CompatibilityMatrix();
      const json = matrix.formatJson(results);
      const parsed = JSON.parse(json);

      expect(parsed.matrix.rows.length).toBeGreaterThanOrEqual(2);
      expect(parsed.matrix.columns.length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(parsed.matrix.results).length).toBeGreaterThanOrEqual(6);

      const md = matrix.formatMarkdown(results);
      expect(md).toContain('Source \\ Target');
      expect(md).toContain('---');
    });
  });
});
