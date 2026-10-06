#!/usr/bin/env node
/**
 * Confirm the feature index matches the files, the four H2s, and every pages route.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const featuresDir = path.join(skillDir, 'features');
const repoRoot = path.resolve(skillDir, '../../..');
const routingPath = path.join(repoRoot, 'frontend/src/app/pages/pages-routing.module.ts');
const readme = fs.readFileSync(path.join(featuresDir, 'README.md'), 'utf8');
const H2 = [
  '## Sub-features',
  '## How to get to it (user POV)',
  '## Driving it with dv-verify',
  '## Gotchas',
];

const files = fs
  .readdirSync(featuresDir)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .sort();

let failed = false;
function fail(msg) {
  failed = true;
  console.log(`FAIL ${msg}`);
}

const linked = [...readme.matchAll(/\]\(\.\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
const linkedSet = new Set(linked);
for (const file of files) {
  if (!linkedSet.has(file)) fail(`README missing ${file}`);
}
for (const link of linkedSet) {
  if (!files.includes(link)) fail(`README extra ${link}`);
}
const dupes = linked.filter((item, i) => linked.indexOf(item) !== i);
const featureSection = readme.split('## Features')[1] || '';
const featureLinks = [...featureSection.matchAll(/\]\(\.\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
const featureDupes = featureLinks.filter((item, i) => featureLinks.indexOf(item) !== i);
if (featureDupes.length) fail(`duplicate feature links ${[...new Set(featureDupes)].join(' ')}`);
if (dupes.length && featureDupes.length) fail(`duplicate links ${[...new Set(dupes)].join(' ')}`);

const routeSource = fs.readFileSync(routingPath, 'utf8');
const mapText = files.map((file) => fs.readFileSync(path.join(featuresDir, file), 'utf8')).join('\n') + '\n' + readme;
const literals = [...routeSource.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);
const exprs = [...routeSource.matchAll(/path:\s*(ROUTE\.[A-Za-z0-9_]+)/g)].map((m) => m[1]);
const templates = [...routeSource.matchAll(/path:\s*(`[^`]+`)/g)].map((m) => m[1]);
for (const token of [...literals, ...exprs, ...templates]) {
  if (!mapText.includes(token)) fail(`route token missing from map: ${token}`);
}
const resolved = ['inicio', 'about', 'documentos/listar', 'leyendo/:documento', 'leyendo/:id/punto/:user', 'ROUTE.punto', 'ROUTE.leyendo'];
for (const token of resolved) {
  if (!mapText.includes(token)) fail(`resolved path missing: ${token}`);
}

for (const file of files) {
  const text = fs.readFileSync(path.join(featuresDir, file), 'utf8');
  const positions = H2.map((heading) => text.indexOf(heading));
  if (positions.some((pos) => pos < 0)) {
    fail(`${file} missing an H2`);
    continue;
  }
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i] < positions[i - 1]) fail(`${file} H2 order`);
  }
  if (!text.startsWith('# ')) fail(`${file} missing H1`);
}

if (failed) process.exit(1);
console.log(`map ok files ${files.length}`);
console.log(`literals ${literals.length} exprs ${exprs.length} templates ${templates.length}`);
console.log(files.join('\n'));
