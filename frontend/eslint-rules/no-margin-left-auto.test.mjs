import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rule, { MESSAGE, findMarginLeftAuto } from './no-margin-left-auto.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const eslintBin = path.join(root, 'node_modules/eslint/bin/eslint.js');

assert.equal(rule.meta.messages.useInlineStart, MESSAGE);
assert.ok(MESSAGE.includes('.cursor/skills/verify-documentos-vaticanos/features/buscar.md'));

assert.equal(
  findMarginLeftAuto('.wsearch {\n  margin-left: auto;\n}\n').length,
  1,
);
assert.equal(
  findMarginLeftAuto('<span style="margin-left: auto">x</span>\n').length,
  1,
);
assert.equal(
  findMarginLeftAuto('.box {\n  margin-left: auto;\n  margin-right: auto;\n}\n').length,
  0,
);
assert.equal(
  findMarginLeftAuto('.wsearch {\n  margin-inline-start: auto;\n}\n').length,
  0,
);
assert.equal(findMarginLeftAuto('/* margin-left: auto */\n').length, 0);

const mixed = [
  '@Component({',
  '  template: `<span style="margin-left: auto"></span>`,',
  '  styles: [`.box { margin-left: auto; margin-right: auto; }`],',
  '})',
  '',
].join('\n');
assert.equal(findMarginLeftAuto(mixed).length, 1);

function lintStdin(code, filename) {
  return spawnSync(
    process.execPath,
    [
      eslintBin,
      '-c',
      'frontend/eslint.config.mjs',
      '--stdin',
      '--stdin-filename',
      filename,
    ],
    { cwd: root, input: code, encoding: 'utf8' },
  );
}

const badTs = 'export const sample = `\n.wsearch {\n  margin-left: auto;\n}\n`;\n';
const bad = lintStdin(badTs, 'frontend/src/app/eslint-fixture.ts');
assert.equal(bad.status, 1, bad.stdout + bad.stderr);
assert.ok(
  (bad.stdout + bad.stderr).includes(MESSAGE),
  bad.stdout + bad.stderr,
);

const goodTs = 'export const sample = `\n.wsearch {\n  margin-inline-start: auto;\n}\n`;\n';
const good = lintStdin(goodTs, 'frontend/src/app/eslint-fixture.ts');
assert.equal(good.status, 0, good.stdout + good.stderr);

const centerTs =
  'export const sample = `\n.box {\n  margin-left: auto;\n  margin-right: auto;\n}\n`;\n';
const center = lintStdin(centerTs, 'frontend/src/app/eslint-fixture.ts');
assert.equal(center.status, 0, center.stdout + center.stderr);

console.log('OK no-margin-left-auto');
