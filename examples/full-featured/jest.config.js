module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.spec.ts',
    '**/?(*.)spec.ts',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          target: 'ES2023',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@users/(.*)$': '<rootDir>/src/users/$1',
    '^@view/(.*)$': '<rootDir>/src/view/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/view/**',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/test/e2e/',
    '/test/integration/', // Exclude integration tests - require SSR architecture updates
    '\\.test\\.tsx?$', // Exclude component tests (*.test.tsx) - those run with Vitest
  ],
  coverageDirectory: 'coverage',
};
