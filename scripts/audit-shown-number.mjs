#!/usr/bin/env node
/**
 * Cuenta, por documento, los cuerpos cuyo número inicial es exactamente
 * el versículo o párrafo que el lector ya muestra. No escribe el corpus.
 *
 *   bash scripts/node-strip-types.sh scripts/audit-shown-number.mjs
 *
 * Salida: una línea por documento con casos (`id`, `count`, ejemplo)
 * y un resumen. Falla si el recorte no es idempotente o cambia más que
 * el prefijo.
 */
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  import.meta.url,
);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const documentsDir = path.join(root, 'documentos', 'corpus', 'documents');
const logicUrl = pathToFileURL(
  path.join(root, 'frontend/src/app/core/text/strip-shown-number.logic.ts'),
).href;

function clip(text, max = 72) {
  const one = String(text ?? '').replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

const { displayBody } = await import(logicUrl);

const ids = fs
  .readdirSync(documentsDir)
  .filter((id) => fs.existsSync(path.join(documentsDir, id, 'content.json')))
  .sort();

let scanned = 0;
let units = 0;
let hits = 0;
let docsWithHits = 0;
/** @type {string[]} */
const lines = [];

for (const id of ids) {
  const file = path.join(documentsDir, id, 'content.json');
  let list;
  try {
    list = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`FAIL ${id}: ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(list)) continue;
  scanned += 1;
  let count = 0;
  let example = '';
  for (const unit of list) {
    if (!unit || typeof unit !== 'object') continue;
    units += 1;
    const before = String(unit.contenido ?? '');
    const after = displayBody(unit);
    if (after === before) continue;
    if (!before.endsWith(after)) {
      console.error(`FAIL ${id} index ${unit.index_array}: el recorte no es un prefijo`);
      console.error(`  before ${clip(before)}`);
      console.error(`  after  ${clip(after)}`);
      process.exit(1);
    }
    const again = displayBody({ ...unit, contenido: after });
    if (again !== after) {
      console.error(`FAIL ${id} index ${unit.index_array}: no es idempotente`);
      process.exit(1);
    }
    count += 1;
    if (!example) {
      const shown = unit.biblia?.consecutivo_versiculo || unit.consecutivo || '';
      example = `${unit.index_array ?? ''}\t${shown}\t${clip(before)}\t→\t${clip(after)}`;
    }
  }
  if (!count) continue;
  docsWithHits += 1;
  hits += count;
  lines.push(`${id}\t${count}\t${example}`);
}

console.log('id\tcasos\tejemplo');
for (const line of lines) console.log(line);
console.log(
  `# documentos ${scanned} con_casos ${docsWithHits} casos ${hits} unidades ${units}`,
);
