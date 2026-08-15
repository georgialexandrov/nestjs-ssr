/**
 * Architectural boundaries for @nestjs-ssr/react.
 *
 * These rules encode invariants that TypeScript and tsup cannot check:
 * the bundler happily inlines whatever it is handed, so a stray server-side
 * import inside the client subgraph ships NestJS into the browser bundle
 * without a single build or test failure.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-server-code-in-client',
      severity: 'error',
      comment:
        'The /client entry and everything under src/react must stay browser-safe. ' +
        'Reaching into src/render, @nestjs/*, or a Node builtin leaks server code ' +
        'into the client bundle and breaks hydration.',
      from: { path: '^src/(client\\.ts|react/)' },
      to: {
        path: '^src/(render|cli)/',
        dependencyTypes: ['local'],
      },
    },
    {
      name: 'no-server-packages-in-client',
      severity: 'error',
      comment:
        'Browser-safe modules must not depend on NestJS, Express, Fastify or Node builtins.',
      from: { path: '^src/(client\\.ts|react/)' },
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'no-nest-in-client',
      severity: 'error',
      comment: 'NestJS must never appear in the client subgraph.',
      from: { path: '^src/(client\\.ts|react/)' },
      to: { path: 'node_modules/(@nestjs|express|fastify)' },
    },
    {
      name: 'templates-use-public-entry-only',
      severity: 'error',
      comment:
        'src/templates is shipped as source into user projects, so it may only ' +
        'import from the published entry points, never from library internals.',
      from: { path: '^src/templates/' },
      to: { path: '^src/(?!templates/)', dependencyTypes: ['local'] },
    },
    {
      name: 'cli-is-not-runtime',
      severity: 'error',
      comment:
        'The CLI is a build-time bin. Runtime code must not depend on it.',
      from: { path: '^src/(index\\.ts|client\\.ts|render/|react/|interfaces/)' },
      to: { path: '^src/cli/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies break tree-shaking and module init order.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'interfaces-stay-leaf',
      severity: 'error',
      comment:
        'src/interfaces is the type foundation; it must not depend on implementations.',
      from: { path: '^src/interfaces/' },
      to: { path: '^src/(render|react|cli)/', dependencyTypes: ['local'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(__tests__|\\.spec\\.tsx?$)' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)' },
      archi: {
        collapsePattern:
          '^src/(render/(adapters|renderers|error-pages)|react/(hooks|navigation)|interfaces|decorators|cli|templates)',
      },
    },
  },
};
