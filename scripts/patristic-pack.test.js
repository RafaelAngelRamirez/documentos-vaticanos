#!/usr/bin/env node
/**
 * Patristic pack: copy bytes, refuse canonical writes, keep the base ship.
 *   node scripts/patristic-pack.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PACK_ID,
  buildPatristicPack,
  verifyPatristicPack,
  detachPatristicFromShip,
  assertBaseHasNoPatristic,
  assertOutsideCanonical,
  isPatristicShipDoc,
} = require('./patristic-pack.js');

const ROOT = path.resolve(__dirname, '..');

function section(name) {
  console.log(`\n== ${name} ==`);
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function writeDoc(root, id, meta, units) {
  const dir = path.join(root, 'documents', id);
  fs.mkdirSync(dir, { recursive: true });
  const body = Buffer.from(JSON.stringify(units), 'utf8');
  fs.writeFileSync(path.join(dir, 'content.json'), body);
  fs.writeFileSync(
    path.join(dir, 'index.json'),
    JSON.stringify({ indice: { dios: [0] }, indice_por_punto: { 0: 1 } }),
  );
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
  return body;
}

function manifest(docs) {
  return { version: 1, documents: docs };
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-patristic-'));
  const canon = path.join(tmp, 'canon');
  const ship = path.join(tmp, 'ship');
  const pack = path.join(tmp, 'pack');
  try {
    section('selects ship patristics and copies bytes');
    fs.mkdirSync(canon, { recursive: true });
    const units = [
      { consecutivo: '1', contenido: 'En el principio\r\n' },
      { consecutivo: '2', contenido: 'el Verbo.' },
    ];
    const body = writeDoc(
      canon,
      'padre-es',
      { id: 'padre-es', kind: 'patristic', locale: 'es' },
      units,
    );
    writeDoc(
      canon,
      'padre-ai',
      {
        id: 'padre-ai',
        kind: 'patristic',
        locale: 'en',
        translationProvenance: 'ai',
      },
      [{ consecutivo: '1', contenido: 'AI text' }],
    );
    writeDoc(
      canon,
      'lg-es',
      { id: 'lg-es', kind: 'magisterium', locale: 'es' },
      [{ consecutivo: '1', contenido: 'Lumen gentium' }],
    );
    const docs = [
      {
        id: 'padre-es',
        title: 'Padre',
        kind: 'patristic',
        locale: 'es',
        bodyPath: 'documents/padre-es/content.json',
        indexPath: 'documents/padre-es/index.json',
        unitCount: 2,
      },
      {
        id: 'padre-ai',
        title: 'Padre AI',
        kind: 'patristic',
        locale: 'en',
        translationProvenance: 'ai',
        bodyPath: 'documents/padre-ai/content.json',
        indexPath: 'documents/padre-ai/index.json',
        unitCount: 1,
      },
      {
        id: 'lg-es',
        title: 'LG',
        kind: 'magisterium',
        locale: 'es',
        bodyPath: 'documents/lg-es/content.json',
        indexPath: 'documents/lg-es/index.json',
        unitCount: 1,
      },
    ];
    fs.writeFileSync(
      path.join(canon, 'manifest.json'),
      JSON.stringify(manifest(docs)),
    );
    assert.strictEqual(isPatristicShipDoc(docs[0]), true);
    assert.strictEqual(isPatristicShipDoc(docs[1]), false);
    assert.strictEqual(isPatristicShipDoc(docs[2]), false);

    const canonSha = sha(body);
    const built = buildPatristicPack({ canonicalRoot: canon, outDir: pack });
    assert.strictEqual(built.documentCount, 1);
    const copied = fs.readFileSync(
      path.join(pack, 'documents', 'padre-es', 'content.json'),
    );
    assert.ok(copied.equals(body), 'pack content.json is the canonical bytes');
    assert.strictEqual(sha(copied), canonSha);
    assert.ok(
      !fs.existsSync(path.join(pack, 'documents', 'padre-ai')),
      'AI patristic stays out of the pack',
    );
    assert.ok(
      !fs.existsSync(path.join(pack, 'documents', 'lg-es')),
      'magisterium stays out of the pack',
    );
    const verified = verifyPatristicPack(pack);
    assert.strictEqual(verified.ok, true, verified.reason);
    const man = JSON.parse(
      fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'),
    );
    assert.strictEqual(man.id, PACK_ID);
    assert.strictEqual(man.documents[0].contentSha256, canonSha);
    assert.strictEqual(man.documents[0].packId, PACK_ID);

    section('tampered content is refused');
    const contentPath = path.join(pack, 'documents', 'padre-es', 'content.json');
    const original = fs.readFileSync(contentPath);
    const tampered = Buffer.from(original);
    tampered[0] = tampered[0] ^ 0xff;
    fs.writeFileSync(contentPath, tampered);
    const bad = verifyPatristicPack(pack);
    assert.strictEqual(bad.ok, false);
    assert.ok(bad.reason.includes('hash') || bad.reason.includes('coincide'));
    fs.writeFileSync(contentPath, original);
    assert.strictEqual(verifyPatristicPack(pack).ok, true);

    section('detach edits the ship copy and refuses the canonical tree');
    fs.cpSync(canon, ship, { recursive: true });
    assert.throws(
      () => detachPatristicFromShip(canon, canon),
      /canonical/,
    );
    assert.throws(
      () => assertOutsideCanonical(path.join(canon, 'documents'), canon),
      /canonical/,
    );
    const beforeCanon = sha(
      fs.readFileSync(path.join(canon, 'documents', 'padre-es', 'content.json')),
    );
    const detached = detachPatristicFromShip(ship, canon);
    assert.strictEqual(detached.dropped, 2);
    assert.strictEqual(detached.kept, 1);
    assert.ok(!fs.existsSync(path.join(ship, 'documents', 'padre-es')));
    assert.ok(!fs.existsSync(path.join(ship, 'documents', 'padre-ai')));
    assert.ok(fs.existsSync(path.join(ship, 'documents', 'lg-es', 'content.json')));
    const shipMan = JSON.parse(
      fs.readFileSync(path.join(ship, 'manifest.json'), 'utf8'),
    );
    assert.deepStrictEqual(
      shipMan.documents.map((d) => d.id),
      ['lg-es'],
    );
    assert.deepStrictEqual(assertBaseHasNoPatristic(ship, canon), { kept: 1 });
    assert.strictEqual(
      sha(fs.readFileSync(path.join(canon, 'documents', 'padre-es', 'content.json'))),
      beforeCanon,
      'canonical content.json was not rewritten',
    );
    assert.ok(
      fs.readFileSync(path.join(canon, 'documents', 'padre-es', 'content.json')).equals(
        body,
      ),
    );

    section('apk and aab split the pack; web and electron do not');
    const apk = fs.readFileSync(path.join(ROOT, 'scripts', 'package-apk.sh'), 'utf8');
    const aab = fs.readFileSync(path.join(ROOT, 'scripts', 'package-aab.sh'), 'utf8');
    const web = fs.readFileSync(path.join(ROOT, 'scripts', 'package-web.sh'), 'utf8');
    const electron = fs.readFileSync(
      path.join(ROOT, 'scripts', 'package-electron.sh'),
      'utf8',
    );
    for (const [label, bodyText] of [
      ['package-apk.sh', apk],
      ['package-aab.sh', aab],
    ]) {
      assert.ok(
        bodyText.includes('patristic-pack.js'),
        `${label} builds the patristic pack`,
      );
      assert.ok(bodyText.includes('split'), `${label} runs split`);
      assert.ok(
        bodyText.includes('assets/public'),
        `${label} detaches the Android asset copy, not the web dist`,
      );
    }
    assert.ok(!web.includes('patristic-pack.js'), 'PWA keeps patristics');
    assert.ok(
      !electron.includes('patristic-pack.js'),
      'Electron keeps patristics',
    );
    console.log('  package scripts OK');
    console.log('\npatristic-pack.test.js OK');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
