module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies between workspace packages are forbidden',
      from: {},
      to: { circular: true },
    },

    {
      name: 'core-not-adapters',
      severity: 'error',
      comment: 'packages/core must not import from adapters or commercial',
      from: { path: 'packages/core' },
      to: { path: ['adapters', 'commercial'] },
    },

    {
      name: 'schema-not-adapters',
      severity: 'error',
      comment: 'packages/schema must not import from adapters or commercial',
      from: { path: 'packages/schema' },
      to: { path: ['adapters', 'commercial'] },
    },

    {
      name: 'ir-not-adapters',
      severity: 'error',
      comment: 'packages/ir must not import from adapters or commercial',
      from: { path: 'packages/ir' },
      to: { path: ['adapters', 'commercial'] },
    },

    {
      name: 'parser-not-adapters',
      severity: 'error',
      comment: 'packages/parser must not import from adapters or commercial',
      from: { path: 'packages/parser' },
      to: { path: ['adapters', 'commercial'] },
    },

    {
      name: 'compatibility-not-adapters',
      severity: 'error',
      comment: 'packages/compatibility must not import from adapters or commercial',
      from: { path: 'packages/compatibility' },
      to: { path: ['adapters', 'commercial'] },
    },

    {
      name: 'compiler-not-adapters',
      severity: 'error',
      comment: 'packages/compiler must not import from adapters or commercial',
      from: { path: 'packages/compiler' },
      to: { path: ['adapters', 'commercial'] },
    },

    {
      name: 'conversion-no-concrete-adapters',
      severity: 'error',
      comment: 'packages/conversion may depend on adapter-sdk interfaces but not concrete adapters',
      from: { path: 'packages/conversion' },
      to: { path: 'adapters/(portable|claude|codex|opencode)' },
    },

    {
      name: 'no-commercial-imports',
      severity: 'error',
      comment: 'No open-source package may import from commercial/ directory',
      from: { pathNot: 'commercial' },
      to: { path: 'commercial' },
    },

    {
      name: 'no-adapter-cross-import',
      severity: 'error',
      comment: 'Adapters must not import from other adapters',
      from: { path: 'adapters' },
      to: { path: 'adapters' },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: [
        'npm-dev',
        'npm-optional',
        'npm-peer',
        'npm-bundled',
        'npm-no-pkg',
      ],
    },

    includeOnly: '^(packages|adapters|apps|commercial)',

    exclude: {
      path: '\\.test\\.(ts|tsx)$',
    },

    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default'],
    },
  },
};
