import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'public/uploads/**'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
]
