import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

// No eslint-plugin-jsdoc: `npm run typecheck` (tsc with checkJs) already
// validates every JSDoc annotation against the code, which is strictly stronger
// than the plugin's rules — and the plugin currently fails to load at all.

export default [
  { ignores: ['dist/**', 'node_modules/**', 'examples/**/dist/**', 'coverage/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'object-shorthand': 'warn',

      // ESM in Node needs the extension in relative specifiers. Without TS's
      // rewriting, nothing else catches a missing one until runtime.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^\\.{1,2}\\//]:not([source.value=/\\.(js|jsx|css|json)$/])',
          message: 'Relative imports must include the file extension (ESM requires it in Node).',
        },
      ],

      // Without this, every component referenced only inside JSX reads as an
      // unused variable to `no-unused-vars`.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // The architectural guardrail: core/ must stay React-free so a Vue/Svelte
  // port stays cheap. Enforced, not documented.
  {
    files: ['src/core/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/core/ must stay React-free.' },
            { name: 'react-dom', message: 'src/core/ must stay React-free.' },
            { name: 'react/jsx-runtime', message: 'src/core/ must stay React-free.' },
            { name: '@dnd-kit/core', message: 'src/core/ must stay UI-free.' },
          ],
        },
      ],
    },
  },

  {
    files: ['tests/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Build scripts and examples report progress on stdout; that is their job.
  {
    files: ['scripts/**/*.mjs', 'examples/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
]
