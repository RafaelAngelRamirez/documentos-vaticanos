/**
 * Reading address. Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/reading/cite.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'cite.ts')).href
  );
  const {
    parseUnitIndex,
    parseResumeCard,
    parseStack,
    resumeUnitFor,
    matchesPackId,
    parseDocumentId,
    parseArrival,
    documentIdKey,
    cite,
    adoptSpiedUnit,
    isReaderUrl,
    unitToSave,
    unitToReportAfterFill,
  } = mod;

  assert.strictEqual(parseUnitIndex('2'), 2);
  assert.strictEqual(parseUnitIndex(2), 2);
  assert.strictEqual(parseUnitIndex('0'), 0);
  assert.strictEqual(parseUnitIndex(0), 0);
  assert.strictEqual(parseUnitIndex('027'), null);
  assert.strictEqual(parseUnitIndex('Gn 1,1'), null);
  assert.strictEqual(parseUnitIndex('LG 16'), null);

  assert.strictEqual(parseResumeCard(null), null);
  assert.strictEqual(parseResumeCard('{'), null);
  assert.strictEqual(parseResumeCard('{"title":"CIC"}'), null);
  assert.strictEqual(parseResumeCard('{"documentId":"cic-es","unitIndex":"Gn 1,1"}'), null);

  const card = parseResumeCard(
    '{"documentId":"cic-es","unitIndex":4,"title":"Catecismo","unitCount":5092,"label":"LG 16"}',
  );
  assert.ok(card);
  assert.strictEqual(card.cite.unitIndex, 4);
  assert.strictEqual(documentIdKey(card.cite.documentId), 'cic-es');

  const zero = parseResumeCard(
    '{"documentId":"cic-es","unitIndex":0,"title":"Catecismo","unitCount":10}',
  );
  const cic = parseDocumentId('cic-es');
  assert.ok(cic);
  assert.strictEqual(resumeUnitFor(zero, cic), 0);
  assert.strictEqual(resumeUnitFor(card, cic), 4);
  assert.strictEqual(resumeUnitFor(null, cic), 0);

  const stack = parseStack(
    JSON.stringify([
      {
        documentId: 'cic-es',
        actual_index: 4,
        consecutivo: 'LG 16',
      },
      {
        documentId: 'lg-es',
        actual_index: 'no-index',
        consecutivo: 'LG 16',
      },
    ]),
  );
  assert.strictEqual(stack.length, 1);
  assert.strictEqual(stack[0].unitIndex, 4);
  assert.strictEqual(documentIdKey(stack[0].documentId), 'cic-es');
  assert.strictEqual(JSON.stringify(stack[0]).includes('LG 16'), false);

  assert.strictEqual(matchesPackId('cic-es', 'cic-es'), true);
  assert.strictEqual(
    matchesPackId('cic-es', 'Catecismo de la Iglesia Católica'),
    false,
  );
  assert.strictEqual(matchesPackId('cic-es', 'CIC'), false);
  assert.strictEqual(parseDocumentId('CIC'), null);
  assert.strictEqual(parseDocumentId('Catecismo de la Iglesia Católica'), null);

  const legacyIndex = parseArrival({
    documentId: 'cic-es',
    unit: null,
    legacyUser: '2',
    resume: card,
  });
  assert.strictEqual(legacyIndex.kind, 'redirect');
  assert.strictEqual(legacyIndex.cite.unitIndex, 2);

  const legacyLabel = parseArrival({
    documentId: 'cic-es',
    unit: null,
    legacyUser: 'Gn 1,1',
    resume: card,
  });
  assert.strictEqual(legacyLabel.kind, 'redirect');
  assert.strictEqual(legacyLabel.cite.unitIndex, 4);

  const bare = parseArrival({
    documentId: 'lg-es',
    unit: null,
    legacyUser: null,
    resume: card,
  });
  assert.strictEqual(bare.kind, 'redirect');
  assert.strictEqual(bare.cite.unitIndex, 0);

  const canon = parseArrival({
    documentId: 'cic-es',
    unit: '2',
    legacyUser: null,
    resume: null,
  });
  assert.strictEqual(canon.kind, 'cite');
  assert.deepStrictEqual(canon.cite, cite(cic, parseUnitIndex(2)));

  const saint = parseDocumentId('santoral:alejandrina');
  assert.ok(saint);
  assert.strictEqual(saint.kind, 'santoral');
  assert.strictEqual(documentIdKey(saint), 'santoral:alejandrina');

  const pin = parseUnitIndex(2);
  const earlier = parseUnitIndex(0);
  const later = parseUnitIndex(5);
  assert.ok(pin != null && earlier != null && later != null);
  assert.strictEqual(adoptSpiedUnit(pin, earlier, 'pending'), null);
  assert.strictEqual(adoptSpiedUnit(pin, earlier, 'visible'), null);
  assert.strictEqual(adoptSpiedUnit(pin, later, 'visible'), null);
  assert.strictEqual(adoptSpiedUnit(pin, earlier, 'hidden'), 0);
  assert.strictEqual(adoptSpiedUnit(pin, later, 'hidden'), 5);
  assert.strictEqual(adoptSpiedUnit(null, earlier, 'hidden'), 0);
  assert.strictEqual(adoptSpiedUnit(null, later, 'pending'), 5);

  const six = parseUnitIndex(6);
  const seven = parseUnitIndex(7);
  const eight = parseUnitIndex(8);
  assert.ok(six != null && seven != null && eight != null);
  assert.strictEqual(unitToSave(pin, six, true), 2);
  assert.strictEqual(unitToSave(pin, seven, true), 2);
  assert.strictEqual(unitToSave(pin, six, false), 6);
  assert.strictEqual(unitToSave(pin, seven, false), 7);
  assert.strictEqual(unitToSave(null, seven, false), 7);
  assert.strictEqual(unitToReportAfterFill(eight, pin), 8);
  assert.strictEqual(unitToReportAfterFill(pin, pin), 2);

  assert.strictEqual(isReaderUrl('/leyendo/cic-es/u/2'), true);
  assert.strictEqual(isReaderUrl('/leyendo/cic-es/punto/2'), true);
  assert.strictEqual(isReaderUrl('/leyendo/cic-es/u/2?q=1'), true);
  assert.strictEqual(isReaderUrl('/leyendo/santoral:alejandrina/u/0'), true);
  assert.strictEqual(isReaderUrl('/documento/cic-es'), false);
  assert.strictEqual(isReaderUrl('/inicio'), false);

  console.log('cite ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
