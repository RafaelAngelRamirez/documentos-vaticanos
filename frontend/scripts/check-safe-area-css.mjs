#!/usr/bin/env node
/**
 * Contrato Fase 0: tokens env/bridge + chrome fijo usa --safe-area-inset-*.
 * No pisa env(); no anula insets a 1024px dentro del APK.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const lectorCss = readFileSync(
  join(root, 'src/app/components/lector/lector.component.css'),
  'utf8'
);
const java = readFileSync(join(root, '../docs/android/MainActivity.java'), 'utf8');

const must = [
  '--safe-area-env-bottom: env(safe-area-inset-bottom, 0px)',
  '--safe-area-bridge-bottom: 0px',
  '--safe-area-inset-bottom: max(var(--safe-area-env-bottom), var(--safe-area-bridge-bottom))',
  '--reader-chrome-bottom:',
  '.reader-dock',
  'padding-bottom: var(--safe-area-inset-bottom)',
  "html:not([data-shell='android'])",
];

const fail = [];
for (const token of must) {
  if (!css.includes(token)) fail.push(`styles.css falta: ${token}`);
}

if (/html\[data-shell='android'\][^{]*\{[^}]*--safe-area-inset-bottom:\s*0/.test(css)) {
  fail.push('APK no debe anular --safe-area-inset-bottom a 0');
}

if (!java.includes('getInsetsIgnoringVisibility')) {
  fail.push('MainActivity debe usar getInsetsIgnoringVisibility');
}
if (!java.includes('--safe-area-bridge-bottom')) {
  fail.push('MainActivity debe escribir --safe-area-bridge-*, no --safe-area-inset-*');
}
if (java.includes("setProperty('--safe-area-inset-")) {
  fail.push('MainActivity no debe pisar --safe-area-inset-*');
}
if (/\.narr\s*\{[^}]*position:\s*sticky/.test(css + lectorCss)) {
  fail.push('.narr no debe ser sticky al final del documento');
}
if (!lectorCss.includes('var(--reader-chrome-bottom)') || !lectorCss.includes('var(--safe-area-inset-bottom)')) {
  fail.push('lector .reader debe usar --reader-chrome-bottom + --safe-area-inset-bottom');
}

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('safe-area CSS/bridge contract OK');
