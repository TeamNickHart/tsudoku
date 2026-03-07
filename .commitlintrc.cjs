module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'test', 'docs', 'refactor', 'chore', 'bench', 'adr', 'ci', 'style'],
    ],
    'scope-enum': [
      1,
      'always',
      ['core', 'cli', 'solver', 'generator', 'react-native', 'ml', 'docs', 'ci', 'benchmarks'],
    ],
  },
};
