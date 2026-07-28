import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.spec.ts',
        'adapters/*/src/**/*.test.ts',
        'adapters/*/src/**/*.spec.ts',
      ],
      exclude: ['**/integration/**', '**/roundtrip/**', '**/conversion/**'],
    },
  },
  {
    test: {
      name: 'integration',
      include: [
        'packages/*/src/**/integration/**/*.test.ts',
        'packages/*/src/**/integration/**/*.spec.ts',
        'adapters/*/src/**/integration/**/*.test.ts',
        'adapters/*/src/**/integration/**/*.spec.ts',
      ],
    },
  },
  {
    test: {
      name: 'roundtrip',
      include: [
        'packages/*/src/**/roundtrip/**/*.test.ts',
        'packages/*/src/**/roundtrip/**/*.spec.ts',
        'adapters/*/src/**/roundtrip/**/*.test.ts',
        'adapters/*/src/**/roundtrip/**/*.spec.ts',
      ],
    },
  },
  {
    test: {
      name: 'conversion',
      include: [
        'packages/*/src/**/conversion/**/*.test.ts',
        'packages/*/src/**/conversion/**/*.spec.ts',
        'adapters/*/src/**/conversion/**/*.test.ts',
        'adapters/*/src/**/conversion/**/*.spec.ts',
      ],
    },
  },
]);
