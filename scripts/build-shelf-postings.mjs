/**
 * Construye el índice invertido compacto de cada paquete.
 *
 * Lee index.json (no reescribe el texto) y escribe
 * documentos/corpus/search/packages/ y la copia de assets.
 * El gzip −9 se mide y no se embarca: el APK ya comprime el archivo.
 *
 *   node --experimental-strip-types scripts/build-shelf-postings.mjs
 */

import { createRequire, register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';

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
  pathToFileURL('./scripts/build-shelf-postings.mjs'),
);

const require = createRequire(import.meta.url);
const { unpackIndex } = require('./index-pack.js');
const logicUrl = pathToFileURL(
  path.resolve(
    'frontend/src/app/core/search/shelf-search.logic.ts',
  ),
).href;
const L = await import(logicUrl);

const ROOT = path.resolve('documentos/corpus');
const OUT_DIRS = [
  path.join(ROOT, 'search/packages'),
  path.resolve('frontend/src/assets/corpus/search/packages'),
];
const LOCALE = 'es';
const PACKAGES = ['base', 'padres'];

function postingsOf(value) {
  if (Array.isArray(value)) {
    return value.filter((n) => Number.isInteger(n) && n >= 0);
  }
  if (typeof value === 'string' && value.length) {
    const out = [];
    let n = 0;
    for (const part of value.split(',')) {
      const delta = Number(part);
      if (!Number.isFinite(delta)) return [];
      n += delta;
      if (n >= 0) out.push(n);
    }
    return out;
  }
  return [];
}

function readIndex(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (raw && raw.v === 2) {
    const unpacked = unpackIndex(raw);
    if (!unpacked) throw new Error(`índice empaquetado ilegible: ${file}`);
    return unpacked.indice || {};
  }
  return (raw && raw.indice) || {};
}

function absPack(rel) {
  if (!rel) return '';
  if (path.isAbsolute(rel)) return rel;
  return path.join(ROOT, String(rel).replace(/^assets\/corpus\//, ''));
}

function avgTokensFor(docs) {
  const acc = new Map();
  for (const doc of docs) {
    const shelf = L.shelfOf(doc);
    const file = absPack(doc.bodyPath);
    if (!file || !fs.existsSync(file)) continue;
    let units;
    try {
      units = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(units)) continue;
    let slot = acc.get(shelf);
    if (!slot) {
      slot = { sum: 0, n: 0 };
      acc.set(shelf, slot);
    }
    for (const unit of units) {
      const text = unit && unit.contenido;
      if (!text) continue;
      const n = L.tokenCount(text);
      if (!n) continue;
      slot.sum += n;
      slot.n += 1;
    }
  }
  const avg = {};
  for (const doc of docs) {
    const shelf = L.shelfOf(doc);
    if (avg[shelf] != null) continue;
    const slot = acc.get(shelf);
    avg[shelf] =
      slot && slot.n
        ? Math.round((slot.sum / slot.n) * 10) / 10
        : L.MEASURED_AVG_TOKENS[shelf] || 80;
  }
  return avg;
}

function buildPackage(metas, packageId) {
  const docs = L.docsForPackage(metas, LOCALE, packageId);
  const t0 = performance.now();
  console.log(`==> ${packageId}: ${docs.length} obras`);
  const avgTokens = avgTokensFor(docs);
  console.log(`    medias`, avgTokens);
  const terms = new Map();
  let kept = 0;
  let droppedDigits = 0;
  for (let ordinal = 0; ordinal < docs.length; ordinal++) {
    const doc = docs[ordinal];
    const file = absPack(doc.indexPath);
    if (!file || !fs.existsSync(file)) {
      console.warn(`    sin índice ${doc.id}`);
      continue;
    }
    const indice = readIndex(file);
    for (const term of Object.keys(indice)) {
      if (!L.keepIndexTerm(term, packageId)) {
        if (L.termHasDigit(term)) droppedDigits += 1;
        continue;
      }
      const units = postingsOf(indice[term]);
      if (!units.length) continue;
      let byDoc = terms.get(term);
      if (!byDoc) {
        byDoc = new Map();
        terms.set(term, byDoc);
      }
      byDoc.set(ordinal, units);
      kept += units.length;
    }
    if ((ordinal + 1) % 40 === 0 || ordinal + 1 === docs.length) {
      console.log(
        `    índices ${ordinal + 1}/${docs.length} términos ${terms.size} postings ${kept}`,
      );
    }
  }
  const shelfDocs = docs.map((doc) => ({
    id: doc.id,
    shelf: L.shelfOf(doc),
    official: true,
    ai: false,
    unitCount: doc.unitCount || 0,
  }));
  const tEncode = performance.now();
  const bytes = L.encodeShelfPackage({
    locale: LOCALE,
    packageId,
    avgTokens,
    docs: shelfDocs,
    terms,
  });
  const encodeMs = performance.now() - tEncode;
  const tDecode = performance.now();
  const decoded = L.decodeShelfPackage(bytes);
  const decodeMs = performance.now() - tDecode;
  const loops = 200;
  const tLook = performance.now();
  let units = 0;
  for (let i = 0; i < loops; i++) {
    units = L.postingUnitCount(decoded, 'eucaristia').units;
  }
  const lookupUs = ((performance.now() - tLook) * 1000) / loops;
  const gz = zlib.gzipSync(bytes, { level: 9 });
  const buildMs = Math.round(performance.now() - t0);
  const info = {
    id: packageId,
    file: `${LOCALE}-${packageId}.dvix`,
    docs: decoded.docCount,
    terms: decoded.terms.size,
    rawBytes: bytes.length,
    gzipBytes: gz.length,
    buildMs,
    encodeMs: Math.round(encodeMs),
    decodeMs: Math.round(decodeMs),
    lookupUs: Math.round(lookupUs),
    eucaristia: L.postingUnitCount(decoded, 'eucaristia'),
    droppedDigitKeys: droppedDigits,
    avgTokens,
    postings: kept,
  };
  console.log(
    `    ${info.file} raw ${info.rawBytes} gzip ${info.gzipBytes} build ${info.buildMs} ms lookup ${info.lookupUs} µs eucaristia ${units}`,
  );
  return { bytes, info };
}

function writeBoth(name, data) {
  for (const dir of OUT_DIRS) {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    if (typeof data === 'string') fs.writeFileSync(file, data);
    else fs.writeFileSync(file, data);
  }
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'),
);
const metas = manifest.documents || [];
const built = [];
for (const packageId of PACKAGES) {
  const { bytes, info } = buildPackage(metas, packageId);
  writeBoth(info.file, bytes);
  built.push(info);
}

const medicion = {
  version: 1,
  locale: LOCALE,
  measuredAt: new Date().toISOString(),
  node: process.version,
  note: 'El gzip −9 es la medida. El archivo que lee la app es el crudo.',
  packages: built,
};
writeBoth(`${LOCALE}.json`, JSON.stringify({
  version: 1,
  locale: LOCALE,
  packages: built.map((info) => ({
    id: info.id,
    file: info.file,
    docs: info.docs,
    terms: info.terms,
    rawBytes: info.rawBytes,
  })),
}, null, 2) + '\n');
writeBoth('medicion.json', JSON.stringify(medicion, null, 2) + '\n');
console.log('ok', built.map((info) => `${info.id} ${info.rawBytes}`).join(', '));
