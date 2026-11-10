#!/usr/bin/env node
/**
 * Root check: TypeScript (strict as committed), the cheap tests from
 * .ci-build.sh, then ESLint.
 *
 * Yarn 1 treats `yarn check` as its lockfile builtin. Run `yarn run check`.
 *
 * `node scripts/check-map.mjs` is not included. On master that path is
 * missing (exit 1, MODULE_NOT_FOUND). The checker that does exist,
 * `.cursor/skills/verify-documentos-vaticanos/scripts/check-map.mjs`,
 * exits 1 because the feature map is missing route tokens. That file
 * belongs to another block.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : 'all';

function run(title, cmd, args, cwd, env) {
  console.log(`\n==> ${title}`);
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  const code = result.status === null ? 1 : result.status;
  console.log(`exit ${code} · ${title}`);
  if (code !== 0) process.exit(code);
}

const frontend = path.join(root, 'frontend');
const backend = path.join(root, 'backend');
const node = process.execPath;

function typecheck() {
  run(
    'frontend typecheck',
    path.join(frontend, 'node_modules/.bin/tsc'),
    ['-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'],
    frontend,
  );
  run(
    'backend prisma generate',
    path.join(backend, 'node_modules/.bin/prisma'),
    ['generate'],
    backend,
  );
  run(
    'backend typecheck',
    path.join(backend, 'node_modules/.bin/tsc'),
    ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'],
    backend,
  );
}

function cheapTests() {
  const env = { DV_CI: '1' };
  const commands = [
    ['frontend test:open-reading', 'npm', ['--prefix', 'frontend', 'run', 'test:open-reading']],
    ['frontend test:reader-prefs', 'npm', ['--prefix', 'frontend', 'run', 'test:reader-prefs']],
    ['frontend test:unit-bookmark', 'npm', ['--prefix', 'frontend', 'run', 'test:unit-bookmark']],
    ['frontend test:review', 'npm', ['--prefix', 'frontend', 'run', 'test:review']],
    ['frontend test:reader-bars', 'npm', ['--prefix', 'frontend', 'run', 'test:reader-bars']],
    ['frontend test:mobile-flows', 'npm', ['--prefix', 'frontend', 'run', 'test:mobile-flows']],
    ['frontend test:speech-prep', 'npm', ['--prefix', 'frontend', 'run', 'test:speech-prep']],
    ['frontend test:speech-lang', 'npm', ['--prefix', 'frontend', 'run', 'test:speech-lang']],
    ['frontend test:read-aloud', 'npm', ['--prefix', 'frontend', 'run', 'test:read-aloud']],
    ['frontend test:ui-i18n', 'npm', ['--prefix', 'frontend', 'run', 'test:ui-i18n']],
    ['frontend test:clases', 'npm', ['--prefix', 'frontend', 'run', 'test:clases']],
    ['frontend test:sync-journal', 'npm', ['--prefix', 'frontend', 'run', 'test:sync-journal']],
    ['frontend test:unpack-ship-index', 'npm', ['--prefix', 'frontend', 'run', 'test:unpack-ship-index']],
    ['frontend test:shelf-search', 'npm', ['--prefix', 'frontend', 'run', 'test:shelf-search']],
    ['corpus structure contract', node, ['scripts-descarga/corpus_structure_contract.test.js']],
    ['corpus sync assets', node, ['scripts/corpus-sync-assets.test.js']],
    ['patristic pack test', node, ['scripts/patristic-pack.test.js']],
    [
      'patristic pack proof',
      node,
      [
        'scripts/patristic-pack.js',
        'proof',
        '--canonical',
        'documentos/corpus',
        '--check',
        '--out',
        'scripts/proof/patristic-pack-hash.ndjson',
      ],
    ],
    [
      'patristic pack logic',
      'bash',
      ['scripts/node-strip-types.sh', 'frontend/src/app/core/corpus/patristic-pack.logic.test.js'],
    ],
    ['on-demand sources', node, ['scripts/on-demand-sources.test.js']],
    ['on-demand ship', 'bash', ['scripts/on-demand-ship.test.sh']],
    ['dead style copies', node, ['scripts/dead-style-copies.test.js']],
    ['corpus copy', node, ['scripts-descarga/write_corpus_copy.test.js']],
    ['reference documentId', 'bash', ['scripts/node-strip-types.sh', 'backend/src/routes/references-document-id.logic.test.js']],
    ['agent structure', node, ['scripts/agent-structure.test.js']],
    ['ci release guard', 'bash', ['scripts/ci-release-guard.test.sh']],
    ['sync theme id', 'npm', ['--prefix', 'backend', 'run', 'test:sync-theme']],
  ];
  for (const [title, cmd, args] of commands) {
    run(title, cmd, args, root, env);
  }
}

function lint() {
  const eslint = path.join(root, 'node_modules/eslint/bin/eslint.js');
  run(
    'eslint',
    node,
    [
      eslint,
      '-c',
      'frontend/eslint.config.mjs',
      'frontend/src/**/*.ts',
      'frontend/src/**/*.html',
      'frontend/src/**/*.css',
      'frontend/electron/**/*.js',
      'backend/src/**/*.ts',
    ],
    root,
  );
  run(
    'eslint rule',
    node,
    ['frontend/eslint-rules/no-margin-left-auto.test.mjs'],
    root,
  );
}

if (only === 'typecheck') typecheck();
else if (only === 'lint') lint();
else if (only === 'all') {
  typecheck();
  cheapTests();
  lint();
} else {
  console.error('unknown --only ' + only);
  process.exit(2);
}

console.log('\nyarn check ok');
