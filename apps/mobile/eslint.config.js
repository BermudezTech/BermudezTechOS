// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'node_modules/*'],
  },
  {
    // Las pantallas solo acceden a datos mediante los hooks del repositorio
    // (contracts/finance-repository.md, regla 1).
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/finance/data/local/*'],
              message: 'Las pantallas deben usar los hooks de @/modules/finance/hooks.',
            },
          ],
        },
      ],
    },
  },
]);
