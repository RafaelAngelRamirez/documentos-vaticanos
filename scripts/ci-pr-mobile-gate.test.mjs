#!/usr/bin/env node
/**
 * The pull-request job fails when the 390×844 smoke or the lector drive fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const yml = fs.readFileSync(path.join(root, '.github/workflows/pr-checks.yml'), 'utf8');
const gate = fs.readFileSync(path.join(root, 'scripts/ci-agent-gate.sh'), 'utf8');
const cheap = fs.readFileSync(path.join(root, 'scripts/ci-cheap.sh'), 'utf8');

function stepBlock(name) {
  const re = new RegExp(`- name: ${name}\\n([\\s\\S]*?)(?=\\n      - name:|\\n  [a-z])`);
  const match = yml.match(re);
  assert.ok(match, `missing step ${name}`);
  return match[1];
}

const mobile = stepBlock('Mobile 390');
assert.match(mobile, /bash scripts\/ci-agent-gate\.sh mobile/);
assert.doesNotMatch(mobile, /continue-on-error/);

const lector = stepBlock('Lector drive');
assert.match(lector, /bash scripts\/ci-agent-gate\.sh lector/);
assert.doesNotMatch(lector, /continue-on-error/);

assert.match(yml, /mobile-390 exit/);
assert.match(yml, /steps\.mobile\.outputs\.code/);
assert.match(yml, /steps\.lector\.outputs\.code/);
assert.match(yml, /if \[\[ "\$\{\{ steps\.mobile\.outputs\.code \}\}" != "0" \]\]; then/);
assert.match(yml, /if \[\[ "\$\{\{ steps\.lector\.outputs\.code \}\}" != "0" \]\]; then/);
assert.doesNotMatch(yml, /solo se registra/);

assert.match(gate, /--project=mobile-390/);
assert.match(gate, /usage: ci-agent-gate\.sh \[all\|map\|check\|evidence\|lector\|mobile\]/);
assert.match(gate, /seed_doc cic-en/);
assert.match(gate, /seed_doc dm-en/);
assert.match(gate, /seed_doc 20160815-sedula-mater-en/);
assert.match(cheap, /node scripts\/ci-pr-mobile-gate\.test\.mjs/);

console.log('ci-pr-mobile-gate.test.mjs ok');
