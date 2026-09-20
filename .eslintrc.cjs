module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // @tsudoku/game is the framework-free state layer. If a UI framework
      // leaks in here, the React Native port stops being a re-render and
      // becomes a rewrite — so make it a build failure rather than a
      // convention someone has to remember.
      files: ['packages/game/src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              { name: 'react', message: '@tsudoku/game must stay framework-free.' },
              { name: 'react-dom', message: '@tsudoku/game must stay framework-free.' },
              { name: 'react-native', message: '@tsudoku/game must stay framework-free.' },
            ],
            patterns: ['react/*', 'react-dom/*', 'react-native/*'],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.cjs',
    '*.mjs',
    'vitest.config.ts',
    'tsup.config.ts',
    'benchmarks/',
    'docs/',
  ],
};
