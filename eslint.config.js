import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'public/uploads/**'],
  },
  {
    // Server-side code (Node.js, ESM)
    files: ['server.js', 'src/**/*.js', 'db/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Client-side code (browser, ESM)
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
]
