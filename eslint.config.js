// file: eslint.config.js
// description: ESLint configuration for ClawKeeper enforcing snake_case conventions
// reference: CLAUDE.md, package.json

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      // Naming conventions:
      // ClawKeeper uses snake_case (per CLAUDE.md), so the default `camelcase`
      // rule must be disabled. Snake_case is the enforced project standard.
      'camelcase': 'off',

      // TypeScript declares `const X = z.xxx; type X = z.infer<typeof X>;`
      // legitimately in the same scope (value vs. type namespace). Default
      // `no-redeclare` cannot distinguish these and produces false positives.
      'no-redeclare': 'off',

      // Code quality
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': 'off', // We use console for logging
      'prefer-const': 'error',
      'no-var': 'error',

      // Best practices
      'eqeqeq': ['error', 'always'],
      'no-throw-literal': 'error',
      // `no-return-await` is deprecated; modern V8 has no perf penalty and
      // explicit `return await` improves stack traces inside try/catch.
      'no-return-await': 'off',

      // TypeScript-specific (handled by tsc)
      'no-undef': 'off', // TypeScript handles this
    },
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      'dashboard/**', // Dashboard has its own config
      'db/**',
      'scripts/**',
      'memory/**',
      'src/demo/**', // Demo data can have any naming
    ],
  },
];
