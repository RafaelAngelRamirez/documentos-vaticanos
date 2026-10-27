'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const emitWarning = process.emitWarning;
process.emitWarning = function (warning, type, code, ctor) {
  const name = typeof warning === 'string' ? type : warning && warning.name;
  if (name === 'ExperimentalWarning' || type === 'ExperimentalWarning') return;
  return emitWarning.call(process, warning, type, code, ctor);
};

const { stripTypeScriptTypes } = require('node:module');

function resolveSpec(spec, fromFile) {
  if (!spec.startsWith('.')) return spec;
  const dir = path.dirname(fromFile);
  const abs = path.resolve(dir, spec);
  const candidates = [
    abs,
    `${abs}.ts`,
    `${abs}.js`,
    `${abs}.json`,
    path.join(abs, 'index.ts'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      let rel = path.relative(dir, candidate);
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return rel.split(path.sep).join('/');
    }
  }
  return spec;
}

function toCjs(src, filename) {
  let out = src.replace(
    /import\s+\{([^}]+)\}\s+from\s+(['"])([^'"]+)\2\s*;?/g,
    (_, names, quote, spec) =>
      `const {${names}} = require(${quote}${resolveSpec(spec, filename)}${quote});`,
  );
  out = out.replace(
    /import\s+(\w+)\s+from\s+(['"])([^'"]+)\2\s*;?/g,
    (_, name, quote, spec) =>
      `const ${name} = require(${quote}${resolveSpec(spec, filename)}${quote});`,
  );
  const names = [];
  out = out.replace(
    /export\s+(async\s+)?function\s+([A-Za-z0-9_]+)/g,
    (_, asyncKw, name) => {
      names.push(name);
      return `${asyncKw || ''}function ${name}`;
    },
  );
  out = out.replace(/export\s+const\s+([A-Za-z0-9_]+)/g, (_, name) => {
    names.push(name);
    return `const ${name}`;
  });
  out = out.replace(/export\s+\{([^}]+)\}\s*;?/g, (_, exported) =>
    exported
      .split(',')
      .map((part) => {
        const bit = part.trim();
        if (!bit) return '';
        const sides = bit.split(/\s+as\s+/);
        const local = sides[0].trim();
        const pub = (sides[1] || sides[0]).trim();
        return `exports.${pub} = ${local};`;
      })
      .join('\n'),
  );
  return `${out}\n${names.map((name) => `exports.${name} = ${name};`).join('\n')}\n`;
}

require.extensions['.ts'] = function loadTs(module, filename) {
  const js = toCjs(
    stripTypeScriptTypes(fs.readFileSync(filename, 'utf8')),
    filename,
  );
  try {
    module._compile(js, filename);
  } catch (err) {
    const dump = path.join(os.tmpdir(), `${path.basename(filename)}.cjs-dump`);
    fs.writeFileSync(dump, js);
    err.message = `${err.message}\ncompiled dump ${dump}`;
    throw err;
  }
};

const writer = require('./src/pipeline/write_corpus.ts');

function fail(message) {
  throw new Error(message);
}

function filesUnder(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) {
        out.push(path.relative(dir, abs).split(path.sep).join('/'));
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}

function run() {
  const canon = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-sync-canon-'));
  const assets = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-sync-assets-'));
  const brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-manifest-'));
  const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-sync-link-'));
  const realCanon = path.resolve(writer.CANONICAL_CORPUS_ROOT);
  const realAssets = path.resolve(__dirname, '../frontend/src/assets/corpus');
  const corpusLink = path.join(linkDir, 'corpus-link');
  try {
    if (
      path.resolve(canon).startsWith(realCanon) ||
      path.resolve(assets).startsWith(realAssets) ||
      path.resolve(brokenDir).startsWith(realCanon) ||
      path.resolve(linkDir).startsWith(realCanon)
    ) {
      fail('temp dirs landed on the real corpus');
    }
    const roots = { canonicalRoot: canon, assetsRoot: assets };
    const rel = path.join('documents', 'fixture-es');
    fs.mkdirSync(path.join(canon, rel), { recursive: true });
    fs.writeFileSync(path.join(canon, rel, 'content.json'), '{"ok":true}\n');
    fs.mkdirSync(path.join(assets, 'documents'), { recursive: true });
    fs.writeFileSync(path.join(assets, 'documents', 'sibling.txt'), 'keep\n');
    const dest = path.join(assets, rel);
    fs.mkdirSync(path.join(dest, 'c'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'chunks.json'), 'stale\n');
    fs.writeFileSync(path.join(dest, 'c', '0.json'), 'stale\n');
    fs.writeFileSync(path.join(dest, 'content.json'), 'old\n');

    writer.syncCorpusPathToAssets(rel, roots);
    const once = filesUnder(dest);
    const onceBytes = fs.readFileSync(path.join(dest, 'content.json'));
    writer.syncCorpusPathToAssets(rel, roots);
    const twice = filesUnder(dest);
    const twiceBytes = fs.readFileSync(path.join(dest, 'content.json'));
    if (once.join() !== twice.join() || !onceBytes.equals(twiceBytes)) {
      fail(`second copy changed files ${twice.join(',')}`);
    }
    const extras = twice.filter((file) => file !== 'content.json');
    if (extras.length !== 0 || twice.length !== 1) {
      fail(`extras ${extras.length} files ${twice.join(',')}`);
    }
    const srcBytes = fs.readFileSync(path.join(canon, rel, 'content.json'));
    if (!srcBytes.equals(twiceBytes)) fail('content bytes differ');
    if (fs.readFileSync(path.join(assets, 'documents', 'sibling.txt'), 'utf8') !== 'keep\n') {
      fail('parent sibling removed');
    }

    for (const name of ['papacy', 'santoral', 'search', 'context']) {
      fs.mkdirSync(path.join(canon, name), { recursive: true });
      fs.writeFileSync(path.join(canon, name, 'keep.json'), '{}\n');
      fs.mkdirSync(path.join(assets, name), { recursive: true });
      fs.writeFileSync(path.join(assets, name, 'keep.json'), 'old\n');
      fs.writeFileSync(path.join(assets, name, 'stale.json'), 'stale\n');
      writer.syncCorpusPathToAssets(name, roots);
      writer.syncCorpusPathToAssets(name, roots);
      const left = filesUnder(path.join(assets, name));
      if (left.join(',') !== 'keep.json') fail(`${name} left ${left.join(',')}`);
    }

    const stamp = '{"generatedAt":"2026-09-12T01:34:13.541Z","documents":[]}\n';
    fs.writeFileSync(path.join(canon, 'manifest.json'), stamp);
    fs.writeFileSync(path.join(assets, 'manifest.json'), '{"generatedAt":"changed"}\n');
    fs.writeFileSync(path.join(assets, 'sibling.txt'), 'keep\n');
    writer.syncCorpusPathToAssets('manifest.json', roots);
    if (fs.readFileSync(path.join(assets, 'manifest.json'), 'utf8') !== stamp) {
      fail('manifest file copy changed bytes');
    }
    if (fs.readFileSync(path.join(assets, 'sibling.txt'), 'utf8') !== 'keep\n') {
      fail('manifest copy removed a sibling');
    }

    const ghost = path.join('documents', 'missing-es');
    fs.mkdirSync(path.join(assets, ghost), { recursive: true });
    fs.writeFileSync(path.join(assets, ghost, 'chunks.json'), 'keep\n');
    let missingThrew = false;
    try {
      writer.syncCorpusPathToAssets(ghost, roots);
    } catch (err) {
      missingThrew = String(err.message).includes('missing');
    }
    if (!missingThrew) fail('missing source should throw');
    if (fs.readFileSync(path.join(assets, ghost, 'chunks.json'), 'utf8') !== 'keep\n') {
      fail('missing source deleted the destination');
    }

    const added = {
      id: 'added-es',
      title: 'Added',
      shortTitle: 'A',
      kind: 'magisterium',
      locale: 'es',
    };
    const broken = path.join(brokenDir, 'manifest.json');
    fs.writeFileSync(broken, '{');
    let threw = false;
    try {
      writer.mergeDocumentIntoManifest(broken, added);
    } catch {
      threw = true;
    }
    const kept = fs.readFileSync(broken);
    if (!threw || kept.toString() !== '{') {
      fail(`manifest not kept threw=${threw} bytes=${kept.toString()}`);
    }

    const valid = path.join(brokenDir, 'valid.json');
    const keptDoc = {
      id: 'kept-es',
      title: 'Kept',
      shortTitle: 'K',
      kind: 'magisterium',
      locale: 'es',
    };
    fs.writeFileSync(
      valid,
      JSON.stringify({
        version: '1.0.0',
        generatedAt: '2026-09-12T01:34:13.541Z',
        documents: [keptDoc],
      }),
    );
    writer.mergeDocumentIntoManifest(valid, added);
    const catalog = JSON.parse(fs.readFileSync(valid, 'utf8'));
    const ids = (catalog.documents || []).map((doc) => doc.id);
    if (
      !Array.isArray(catalog.documents) ||
      catalog.documents.length !== 2 ||
      ids.indexOf('kept-es') < 0 ||
      ids.indexOf('added-es') < 0
    ) {
      fail(`manifest merge ${JSON.stringify(ids)}`);
    }

    const manifestPath = path.join(realCanon, 'manifest.json');
    const manifestBefore = fs.statSync(manifestPath);
    const corpusParent = path.dirname(realCanon);
    let parentThrew = false;
    try {
      writer.assertSyncDestinationOutsideCanonical(
        path.join(corpusParent, 'corpus'),
        corpusParent,
      );
    } catch (err) {
      parentThrew = String(err && err.message).includes(
        'refusing to replace canonical corpus',
      );
    }
    if (!parentThrew) fail('parent plus corpus did not throw');

    fs.symlinkSync(realCanon, corpusLink);
    let linkThrew = false;
    try {
      writer.assertSyncDestinationOutsideCanonical(
        path.join(corpusLink, 'documents', 'not-a-real-sync'),
        corpusLink,
      );
    } catch (err) {
      linkThrew = String(err && err.message).includes(
        'refusing to replace canonical corpus',
      );
    }
    if (!linkThrew) fail('canonical symlink did not throw');
    const manifestAfter = fs.statSync(manifestPath);
    if (
      manifestBefore.ino !== manifestAfter.ino ||
      manifestBefore.size !== manifestAfter.size ||
      manifestBefore.mtimeMs !== manifestAfter.mtimeMs
    ) {
      fail('canonical manifest changed');
    }

    const calls = [];
    const onDemand = writer.applyShipCopy(
      { packaging: 'on-demand', corpusDocId: 'later-es' },
      {
        copyDoc: (id) => calls.push(`copy:${id}`),
        copyManifest: () => calls.push('manifest'),
        dropDoc: (id) => calls.push(`drop:${id}`),
        stripManifest: () => calls.push('strip'),
      },
    );
    if (onDemand !== 'on-demand' || calls.join(',') !== 'drop:later-es,manifest,strip') {
      fail(`on-demand ship copy ${onDemand} ${calls.join(',')}`);
    }
    calls.length = 0;
    const shipped = writer.applyShipCopy(
      { packaging: 'ship', corpusDocId: 'keep-es' },
      {
        copyDoc: (id) => calls.push(`copy:${id}`),
        copyManifest: () => calls.push('manifest'),
        dropDoc: (id) => calls.push(`drop:${id}`),
        stripManifest: () => calls.push('strip'),
      },
    );
    if (shipped !== 'ship' || calls.join(',') !== 'copy:keep-es,manifest') {
      fail(`ship copy ${shipped} ${calls.join(',')}`);
    }

    console.log('extras=0');
    console.log('manifest-kept');
  } finally {
    try {
      if (fs.lstatSync(corpusLink).isSymbolicLink()) fs.unlinkSync(corpusLink);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    fs.rmSync(canon, { recursive: true, force: true });
    fs.rmSync(assets, { recursive: true, force: true });
    fs.rmSync(brokenDir, { recursive: true, force: true });
    fs.rmSync(linkDir, { recursive: true, force: true });
  }
}

run();
