#!/usr/bin/env node
/**
 * Evidence policy for a functional pull request.
 *
 * A change under frontend/src/app (tests excluded) must attach
 * .cursor/skills/verify-documentos-vaticanos/evidence/<feature>.txt
 * or the job must regenerate that drive (DV_EVIDENCE_REGENERATED).
 *
 * Page folders follow the feature map. A path the map does not name
 * (shared core, unmapped pages such as clases) stands in with lector,
 * the critical drive. This file does not edit the map.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FEATURES_DIR = path.join(
  repoRoot,
  '.cursor/skills/verify-documentos-vaticanos/features',
);
export const EVIDENCE_DIR = path.join(
  repoRoot,
  '.cursor/skills/verify-documentos-vaticanos/evidence',
);
export const EVIDENCE_PREFIX = '.cursor/skills/verify-documentos-vaticanos/evidence/';

/** Folder under frontend/src/app/pages → feature id. Unlisted folders use lector. */
export const PAGE_FEATURE = {
  about: 'about',
  'admin-revision': 'admin-revision',
  'admin-revision-detalle': 'admin-revision',
  ajustes: 'ajustes',
  aprendizaje: 'aprendizaje',
  buscar: 'buscar',
  cuenta: 'cuenta',
  'doctor-detalle': 'doctores',
  doctores: 'doctores',
  'documento-detalle': 'documento',
  'estudio-detalle': 'estudios',
  'estudio-editar': 'estudios',
  estudios: 'estudios',
  explorar: 'explorar',
  inicio: 'inicio',
  lectio: 'lectio',
  'list-documents-pages': 'biblioteca',
  'mis-referencias': 'referencias',
  'mis-temas': 'temas',
  notas: 'notas',
  'padre-detalle': 'padres',
  padres: 'padres',
  'papa-detalle': 'papas',
  papas: 'papas',
  'santo-detalle': 'santoral',
  santoral: 'santoral',
  'tema-detalle': 'temas',
  'topico-detalle': 'explorar',
};

export function knownFeatureIds(featuresDir = FEATURES_DIR) {
  return new Set(
    fs
      .readdirSync(featuresDir)
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map((name) => name.slice(0, -3)),
  );
}

export function isTestPath(file) {
  return /(?:^|\/)[^/]+\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file);
}

export function isFunctionalPath(file) {
  if (isTestPath(file)) return false;
  return file.startsWith('frontend/src/app/');
}

export function featureForPath(file, known) {
  if (!isFunctionalPath(file)) return null;
  if (!known.has('lector')) return null;
  const page = file.match(/^frontend\/src\/app\/pages\/([^/]+)\//);
  if (page) {
    const id = PAGE_FEATURE[page[1]];
    if (id && known.has(id)) return id;
    return 'lector';
  }
  if (
    file.startsWith('frontend/src/app/components/lector/') ||
    file.startsWith('frontend/src/app/components/punto/')
  ) {
    return 'lector';
  }
  return 'lector';
}

function evidenceTextOk(evidenceDir, id) {
  const file = path.join(evidenceDir, `${id}.txt`);
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, 'utf8').includes(`feature ${id}`);
}

export function evaluate({ files, regenerated, evidenceDir, known }) {
  const regen = new Set(regenerated);
  const demands = new Set();
  let functional = false;
  for (const file of files) {
    const id = featureForPath(file, known);
    if (!id) continue;
    functional = true;
    demands.add(id);
  }
  const missing = [];
  const satisfied = [];
  for (const id of [...demands].sort()) {
    const attached = files.includes(`${EVIDENCE_PREFIX}${id}.txt`);
    const rebuilt = regen.has(id) && evidenceTextOk(evidenceDir, id);
    if (attached) satisfied.push(`${id} attached`);
    else if (rebuilt) satisfied.push(`${id} regenerated`);
    else missing.push(id);
  }
  return { ok: missing.length === 0, functional, missing, satisfied };
}

export function changedFiles(env = process.env) {
  if (env.DV_EVIDENCE_CHANGED_FILE) {
    return fs
      .readFileSync(env.DV_EVIDENCE_CHANGED_FILE, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  let args;
  if (env.DV_EVIDENCE_BASE) {
    args = ['diff', '--name-only', `${env.DV_EVIDENCE_BASE}...HEAD`];
  } else if (env.GITHUB_BASE_SHA) {
    args = ['diff', '--name-only', env.GITHUB_BASE_SHA, 'HEAD'];
  } else {
    args = ['diff', '--name-only', 'origin/master...HEAD'];
  }
  const out = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function regeneratedIds(env = process.env) {
  return (env.DV_EVIDENCE_REGENERATED || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function main() {
  const files = changedFiles();
  const known = knownFeatureIds();
  const result = evaluate({
    files,
    regenerated: regeneratedIds(),
    evidenceDir: EVIDENCE_DIR,
    known,
  });
  if (!result.functional) {
    console.log('evidence policy n/a');
    return;
  }
  for (const line of result.satisfied) console.log(`ok evidence ${line}`);
  for (const id of result.missing) {
    console.log(
      `FAIL evidence ${id}: attach ${EVIDENCE_PREFIX}${id}.txt or regenerate that drive`,
    );
  }
  if (!result.ok) process.exit(1);
  console.log('evidence policy ok');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
