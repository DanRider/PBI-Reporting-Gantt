// reporting-gantt v2.0 ESLint flat config (ESLint v9).
//
// Wave 0 adopts the cortex-matrix-lt2 discipline floor: ban `any`, ban
// `@ts-ignore`, ban default exports, warn on unused vars. The
// `import/no-restricted-paths` layer DAG lands in Wave 1 once the
// substrate-copied src/{primitives,model,kernel,pipeline,render/matrix,
// cards} directories exist; declaring zones for missing directories now
// would emit confusing config errors during the discipline transition.
//
// The powerbi-visuals plugin still contributes its PBI-specific rules.

import powerbiVisualsConfigs from 'eslint-plugin-powerbi-visuals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

export default [
  powerbiVisualsConfigs.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        node: {
          extensions: ['.ts'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      'import/no-default-export': 'error',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', '.vscode/**', '.tmp/**', 'scripts/**'],
  },
];
