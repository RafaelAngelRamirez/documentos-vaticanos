#!/usr/bin/env node
/**
 * Policy cases plus the n8n opt-in guard.
 * check-map is required from scripts/ci-cheap.sh. `yarn run check` is a
 * separate gate step (it needs installed toolchains).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
  EVIDENCE_PREFIX,
  PAGE_FEATURE,
  evaluate,
  knownFeatureIds,
} from './ci-evidence-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const known = knownFeatureIds();

for (const id of new Set(Object.values(PAGE_FEATURE))) {
  assert.ok(known.has(id), `page map names missing feature ${id}`);
}
assert.ok(known.has('lector'));

function run(files, regenerated, evidenceDir) {
  return evaluate({ files, regenerated, evidenceDir, known });
}

const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-evidence-'));
const none = run(['README.md', 'scripts/ci-cheap.sh'], [], emptyDir);
assert.equal(none.functional, false);
assert.equal(none.ok, true);

const testsOnly = run(
  ['frontend/src/app/pages/buscar/buscar.component.spec.ts'],
  [],
  emptyDir,
);
assert.equal(testsOnly.functional, false);

const buscar = run(['frontend/src/app/pages/buscar/buscar.component.ts'], [], emptyDir);
assert.deepEqual(buscar.missing, ['buscar']);
assert.equal(buscar.ok, false);

const attached = run(
  [
    'frontend/src/app/pages/buscar/buscar.component.ts',
    `${EVIDENCE_PREFIX}buscar.txt`,
  ],
  [],
  emptyDir,
);
assert.equal(attached.ok, true);
assert.deepEqual(attached.satisfied, ['buscar attached']);

const wrongDrive = run(
  ['frontend/src/app/pages/buscar/buscar.component.ts'],
  ['lector'],
  emptyDir,
);
assert.deepEqual(wrongDrive.missing, ['buscar']);

fs.writeFileSync(path.join(emptyDir, 'buscar.txt'), 'feature buscar\naction GET /buscar\n');
const rebuilt = run(
  ['frontend/src/app/pages/buscar/buscar.component.ts'],
  ['buscar'],
  emptyDir,
);
assert.equal(rebuilt.ok, true);
assert.deepEqual(rebuilt.satisfied, ['buscar regenerated']);

const notas = run(
  ['frontend/src/app/pages/notas/repaso/repaso.component.ts'],
  [],
  emptyDir,
);
assert.deepEqual(notas.missing, ['notas']);

const clases = run(
  ['frontend/src/app/pages/clase-detalle/clase-detalle.component.ts'],
  [],
  emptyDir,
);
assert.deepEqual(clases.missing, ['lector']);

const shared = run(['frontend/src/app/core/search/shelf-search.logic.ts'], [], emptyDir);
assert.deepEqual(shared.missing, ['lector']);

const ci = fs.readFileSync(path.join(root, '.ci-build.sh'), 'utf8');
const guard =
  /if \[\[ "\$\{DV_AGENT_GATE:-0\}" == "1" \]\]; then[\s\S]*?bash scripts\/ci-agent-gate\.sh[\s\S]*?\nfi/;
assert.match(ci, guard);
assert.equal(ci.replace(guard, '').includes('ci-agent-gate.sh'), false);
assert.match(ci, /bash scripts\/ci-cheap\.sh/);
assert.doesNotMatch(ci, /DV_AGENT_GATE:-1/);

const cheap = fs.readFileSync(path.join(root, 'scripts/ci-cheap.sh'), 'utf8');
assert.match(cheap, /bash scripts\/ci-agent-gate\.sh map/);
const gateSh = fs.readFileSync(path.join(root, 'scripts/ci-agent-gate.sh'), 'utf8');
assert.match(gateSh, /^\s*yarn run check$/m);
assert.equal(/\nyarn check\n/.test(gateSh), false);

function gate(args, env) {
  try {
    const stdout = execFileSync('bash', ['scripts/ci-agent-gate.sh', ...args], {
      cwd: root,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: `${err.stdout || ''}` };
  }
}

const list = path.join(emptyDir, 'files.txt');
fs.writeFileSync(list, 'docs/build-fallos.md\n');
const skip = gate(['evidence'], { DV_EVIDENCE_CHANGED_FILE: list });
assert.equal(skip.code, 0);
assert.match(skip.stdout, /evidence policy n\/a/);
assert.match(skip.stdout, /exit evidence 0/);

fs.writeFileSync(list, 'frontend/src/app/pages/inicio/inicio.component.ts\n');
const need = gate(['evidence'], { DV_EVIDENCE_CHANGED_FILE: list, DV_EVIDENCE_REGENERATED: '' });
assert.equal(need.code, 1);
assert.match(need.stdout, /FAIL evidence inicio/);

const usage = gate(['nope'], {});
assert.equal(usage.code, 2);

fs.rmSync(emptyDir, { recursive: true, force: true });
console.log('ci-evidence-policy.test.mjs ok');
