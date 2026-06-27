import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Core hooks correctness rules only — eslint-plugin-react-hooks v7 also ships
      // a large set of React Compiler-oriented rules (purity, immutability, gating...)
      // that assume compiler-friendly code patterns this app doesn't use yet.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow plain .jsx/.js files to coexist during the incremental TS migration.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    rules: {
      // JS/JSX files aren't type-checked, so TS-only rules don't apply to them.
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
)
