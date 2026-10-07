import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const see = 'See CLAUDE.md > Hard rules > Boundaries.';

const demoPatterns = [
  {
    group: ['demo', 'demo/**', '**/demo', '**/demo/**'],
    message: `Library code must not import app code. ${see}`,
  },
];

const fetchMessage = `No fetch in src/. HTTP goes through the openapi-fetch client the app passes in; in the demo only demo/api/** may call fetch. ${see}`;

const noFetch = {
  'no-restricted-globals': ['error', { name: 'fetch', message: fetchMessage }],
  'no-restricted-properties': [
    'error',
    { object: 'window', property: 'fetch', message: fetchMessage },
    { object: 'globalThis', property: 'fetch', message: fetchMessage },
  ],
};

const forbid = (names, why) => names.map((name) => ({ name, message: `${why} ${see}` }));
const forbidDirs = (dirs, why) =>
  dirs.map((dir) => ({ group: [`../${dir}`, `../${dir}/**`], message: `${why} ${see}` }));

const restrictImports = (paths, patterns) => ({
  'no-restricted-imports': ['error', { paths, patterns: [...demoPatterns, ...patterns] }],
});

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'demo/dist', 'coverage', 'docs/spike'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['src/**', 'demo/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.ts', '*.js', '**/*.mjs', 'tests/**', 'demo/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**'],
    rules: {
      ...noFetch,
      ...restrictImports(forbid(['vue', 'vue-router'], 'No UI framework code in src/.'), []),
    },
  },
  {
    files: ['src/core/**'],
    rules: restrictImports(
      forbid(['vue', 'vue-router', 'openapi-fetch'], 'core/ has zero runtime dependencies.'),
      forbidDirs(['openapi'], 'core/ must not import the OpenAPI entry.'),
    ),
  },
  {
    files: ['src/openapi/**'],
    rules: restrictImports(forbid(['vue', 'vue-router'], 'openapi/ is framework-agnostic.'), []),
  },
  {
    files: ['demo/**'],
    rules: noFetch,
  },
  {
    files: ['demo/api/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  prettier,
);
