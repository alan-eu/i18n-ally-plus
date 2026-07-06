/* eslint-disable @typescript-eslint/no-var-requires */
// Flat ESLint config (ESLint 9). A lean typescript-eslint setup that replaces the
// legacy @antfu/eslint-config (which pulled several unmaintained, vulnerable deps).
// Kept intentionally lenient: the goal here is to modernize the lint toolchain and
// clear its advisories, not to re-style the existing codebase.
const js = require('@eslint/js')
const globals = require('globals')
const tseslint = require('typescript-eslint')

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'out/**',
      'examples/**',
      '.cache/**',
      'res/**',
      'node_modules/**',
      'test-resources/**',
      'test/e2e-out/**',
      'test/e2e-fixtures-temp/**',
      'test/fixture-scripts-out/**',
      'test/fixtures/**',
      'test/fixtures-temp/**',
      'package.nls.*.json',
      // the webview is built/checked by Vite (Vue 2 SFCs); not linted here
      'src/webview/src/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // leftover inline eslint-disable comments from the old config are harmless
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    files: ['**/*.{ts,js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.mocha,
      },
    },
    rules: {
      // relaxed to avoid churning code that predates this config
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-console': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-async-promise-executor': 'off',
      'no-constant-binary-expression': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
)
