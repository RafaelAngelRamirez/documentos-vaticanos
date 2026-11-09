import tsParser from '@typescript-eslint/parser';
import noMarginLeftAuto from './eslint-rules/no-margin-left-auto.mjs';
import textParser from './eslint-rules/text-parser.mjs';

const docvat = {
  meta: { name: 'docvat', version: '1.0.0' },
  rules: {
    'no-margin-left-auto': noMarginLeftAuto,
  },
};

const pushRule = {
  'docvat/no-margin-left-auto': 'error',
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'frontend/android/**',
      'frontend/eslint-rules/**',
      'frontend/src/assets/**',
    ],
  },
  {
    files: ['frontend/src/**/*.ts', 'src/**/*.ts', 'backend/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: { docvat },
    rules: {
      ...pushRule,
      'no-debugger': 'error',
    },
  },
  {
    files: ['frontend/electron/**/*.js', 'electron/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    plugins: { docvat },
    rules: {
      ...pushRule,
      'no-debugger': 'error',
    },
  },
  {
    files: [
      'frontend/src/**/*.css',
      'frontend/src/**/*.html',
      'src/**/*.css',
      'src/**/*.html',
    ],
    languageOptions: {
      parser: textParser,
    },
    plugins: { docvat },
    rules: pushRule,
  },
];
