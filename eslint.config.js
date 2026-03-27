import js from '@eslint/js';
import ts from 'typescript-eslint';

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: ts.parser,
    },
    extends: [js.configs.recommended, ...ts.configs.recommended],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
