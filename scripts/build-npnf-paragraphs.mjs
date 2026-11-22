#!/usr/bin/env node
/**
 * Build the public-domain NPNF paragraph files for Confessions and De Trinitate.
 *
 * Reads the CCEL plain text of NPNF1-01 and NPNF1-03 (rights: public domain)
 * and writes two new corpus documents. It does not rewrite the BAC OCR.
 *
 *   node scripts/build-npnf-paragraphs.mjs \
 *     --conf /tmp/npnf/npnf101.txt --trin /tmp/npnf/npnf103.txt
 *
 * Refuses to write when the gzip of the new files would pass 10% of the
 * canonical corpus gzip measured on 2026-11-22 (410766700 bytes).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CANON = path.join(ROOT, 'documentos/corpus');
const ASSETS_MANIFEST = path.join(ROOT, 'frontend/src/assets/corpus/manifest.json');
/** Gzip of documentos/corpus, level 9, one stream per file, 2026-11-22. */
const CORPUS_GZ_BYTES = 410766700;
const MAX_RATIO = 0.1;

const ROMAN_VAL = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}

function roman(token) {
  const s = String(token || '').trim().toUpperCase();
  if (!/^[IVXLCDM]+$/.test(s)) return 0;
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = ROMAN_VAL[s[i]];
    if (!v) return 0;
    if (v < prev) total -= v;
    else {
      total += v;
      prev = v;
    }
  }
  return total > 0 && total < 400 ? total : 0;
}

function classify(line) {
  const t = line.trim();
  if (!t) return { k: 'blank' };
  if (/^_{5,}$/.test(t) || /^-{5,}$/.test(t)) return { k: 'rule' };
  let m = t.match(/^Book ([IVXLCDM]+)\.$/);
  if (m && roman(m[1])) return { k: 'book', n: roman(m[1]) };
  m = t.match(/^Chapter ([IVXLCDM]+|\d{1,3})\.--\s*(.*)$/);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : roman(m[1]);
    if (n) return { k: 'chapter', n, title: m[2] };
  }
  m = t.match(/^(\d+)\.\s+(.*)$/);
  if (m) return { k: 'para', n: Number(m[1]), text: m[2] };
  if (/^\[\d+\]/.test(t)) return { k: 'note' };
  return { k: 'cont', text: t };
}

function cleanText(text) {
  return text
    .replace(/\s*\[\d{1,4}\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @param {{ startBook: number, endBook: number, anchor: RegExp, endLine: RegExp }} opts
 */
function parseWork(text, opts) {
  const lines = text.split(/\r?\n/);
  let origin = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = classify(lines[i]);
    if (row.k !== 'book' || row.n !== opts.startBook) continue;
    const window = lines.slice(i, i + 80).join('\n');
    if (opts.anchor.test(window)) {
      origin = i;
      break;
    }
  }
  if (origin < 0) throw new Error('work start not found');

  /** @type {{ book: number, chapter: number, paragraph: number, text: string, title?: string, role: string }[]} */
  const units = [];
  let book = 0;
  let chapter = 0;
  let lastPara = 0;
  let mode = 'seek';
  let buf = '';
  let chapterTitle = '';

  function flushPara() {
    const text = cleanText(buf);
    buf = '';
    if (mode !== 'para' || !text || !book || !chapter || !lastPara) return;
    units.push({
      role: 'paragraph',
      book,
      chapter,
      paragraph: lastPara,
      text,
    });
  }

  function flushChapter() {
    const title = cleanText(chapterTitle);
    chapterTitle = '';
    if (!book || !chapter) return;
    units.push({
      role: 'chapter',
      book,
      chapter,
      paragraph: 0,
      title,
      text: title,
    });
  }

  for (let i = origin; i < lines.length; i++) {
    const row = classify(lines[i]);
    if (opts.endLine && opts.endLine.test(lines[i].trim())) {
      flushPara();
      break;
    }
    if (row.k === 'chapter' && chapter && row.n < chapter) {
      flushPara();
      break;
    }
    if (row.k === 'book') {
      flushPara();
      if (book && row.n <= book) break;
      if (row.n > opts.endBook) break;
      book = row.n;
      chapter = 0;
      lastPara = 0;
      mode = 'book';
      units.push({
        role: 'book',
        book,
        chapter: 0,
        paragraph: 0,
        text: '',
      });
      continue;
    }
    if (!book) continue;
    if (row.k === 'chapter') {
      flushPara();
      chapter = row.n;
      mode = 'chapter';
      chapterTitle = row.title || '';
      flushChapter();
      continue;
    }
    if (row.k === 'para') {
      const jump = row.n - lastPara;
      if (mode === 'note' && jump > 4) continue;
      if (row.n > lastPara) {
        flushPara();
        lastPara = row.n;
        mode = 'para';
        buf = row.text;
        continue;
      }
      if (mode === 'para') buf += ' ' + row.n + '. ' + row.text;
      continue;
    }
    if (row.k === 'rule' || row.k === 'note') {
      flushPara();
      mode = 'note';
      continue;
    }
    if (row.k === 'cont') {
      if (mode === 'para') buf += ' ' + row.text;
      else if (mode === 'chapter') {
        /* title already flushed; ignore wrapped title tail by appending to last chapter unit */
        const last = units[units.length - 1];
        if (last && last.role === 'chapter') {
          last.title = cleanText(`${last.title} ${row.text}`);
          last.text = last.title;
        }
      }
      continue;
    }
  }
  flushPara();
  return units;
}

function toArticles(parsed) {
  return parsed.map((unit) => {
    let contenido = '';
    if (unit.role === 'book') contenido = `Book ${unit.book}.`;
    else if (unit.role === 'chapter') {
      contenido = unit.title
        ? `Chapter ${unit.chapter}. ${unit.title}`
        : `Chapter ${unit.chapter}.`;
    } else contenido = `${unit.paragraph}. ${unit.text}`;
    return {
      consecutivo: String(unit.paragraph || unit.chapter || unit.book),
      contenido,
      referencias: [],
    };
  });
}

function eliminarDiacriticos(texto) {
  return texto
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize();
}

function buildIndex(documento) {
  const indice = {};
  const indicePorPunto = {};
  let i = -1;
  for (const punto of documento) {
    let modificado = punto.contenido ?? '';
    modificado = eliminarDiacriticos(modificado);
    modificado = modificado
      .replace(/[,".«»“”:;!¡¿?—']/gi, '')
      .replace(/\( \[\+\[\d*\]\+\] \)/gi, '')
      .replace(/\s/gi, '###')
      .replace(/#{3,21}/gi, ' ')
      .replace(/[\[\]”]/gi, '')
      .replace(/[-()*\/`‘–…]/gi, '')
      .trim();
    modificado = modificado.toLowerCase();
    const consec = String(punto.consecutivo);
    if (modificado.startsWith(consec.toLowerCase() + ' ')) {
      modificado = modificado.slice(consec.length + 1);
    }
    i++;
    if (punto.consecutivo !== 'no-encontrado') {
      const n = parseInt(punto.consecutivo, 10);
      if (!Number.isNaN(n)) indicePorPunto[i] = n;
    }
    if (!modificado.length) continue;
    for (const palabra of modificado.split(' ')) {
      if (!palabra) continue;
      if (!indice[palabra]) indice[palabra] = [];
      const arr = indice[palabra];
      if (arr[arr.length - 1] !== i) arr.push(i);
    }
  }
  return { indice, indice_por_punto: indicePorPunto };
}

function gzipLen(buf) {
  return zlib.gzipSync(buf, { level: 9 }).length;
}

function findParagraph(parsed, book, chapter, paragraph) {
  return parsed.find(
    (u) =>
      u.role === 'paragraph' &&
      u.book === book &&
      u.chapter === chapter &&
      u.paragraph === paragraph,
  );
}

function assertPassage(parsed, book, chapter, paragraph, needle, label) {
  const unit = findParagraph(parsed, book, chapter, paragraph);
  if (!unit) {
    throw new Error(`${label}: missing ${book}.${chapter}.${paragraph}`);
  }
  if (!unit.text.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(
      `${label}: ${book}.${chapter}.${paragraph} does not contain “${needle}”: ${unit.text.slice(0, 180)}`,
    );
  }
  return unit;
}

function writeDoc(id, meta, articles) {
  const dir = path.join(CANON, 'documents', id);
  fs.mkdirSync(dir, { recursive: true });
  const body = JSON.stringify(articles);
  const bodyPath = path.join(dir, 'content.json');
  fs.writeFileSync(bodyPath, body);
  const index = buildIndex(articles);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  const contentHash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12);
  const entry = {
    id,
    title: meta.title,
    shortTitle: meta.shortTitle,
    kind: 'patristic',
    locale: 'en',
    sourceUrl: meta.sourceUrl,
    bodyPath: `documents/${id}/content.json`,
    indexPath: `documents/${id}/index.json`,
    unitCount: articles.length,
    author: 'Augustine of Hippo',
    compiler: 'NPNF / CCEL (public domain)',
    sourceNote: meta.sourceNote,
    contentHash,
  };
  return { entry, bytes: Buffer.byteLength(body), gz: gzipLen(Buffer.from(body)) };
}

function insertManifest(file, entries) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.endsWith(']}')) throw new Error(`unexpected manifest ending: ${file}`);
  const man = JSON.parse(raw);
  const have = new Set(man.documents.map((d) => d.id));
  const fresh = entries.filter((e) => !have.has(e.id));
  if (!fresh.length) return;
  const insert = fresh.map((e) => JSON.stringify(e)).join(',');
  const next = raw.slice(0, -2) + ',' + insert + raw.slice(-2);
  JSON.parse(next);
  fs.writeFileSync(file, next);
}

function main() {
  const confPath = arg('--conf');
  const trinPath = arg('--trin');
  if (!confPath || !trinPath) {
    console.error('need --conf and --trin');
    process.exit(2);
  }
  const confText = fs.readFileSync(confPath, 'utf8');
  const trinText = fs.readFileSync(trinPath, 'utf8');
  const conf = parseWork(confText, {
    startBook: 1,
    endBook: 13,
    anchor: /Great art Thou/,
    endLine: /^Letter [IVXLCDM]+\.$/,
  });
  const trin = parseWork(trinText, {
    startBook: 1,
    endBook: 15,
    anchor: /following dissertation concerning the Trinity/,
    endLine: /^Enchiridion\b/,
  });

  const confBooks = new Set(conf.filter((u) => u.role === 'book').map((u) => u.book));
  const trinBooks = new Set(trin.filter((u) => u.role === 'book').map((u) => u.book));
  if (confBooks.size !== 13) throw new Error(`confessions books ${confBooks.size}`);
  if (trinBooks.size !== 15) throw new Error(`trinity books ${trinBooks.size}`);

  assertPassage(conf, 1, 1, 1, 'Great art Thou', 'confessions');
  assertPassage(conf, 8, 12, 29, 'Take up and read', 'confessions tolle');
  const c837 = assertPassage(conf, 8, 3, 7, 'delights at finding', 'confessions 8.3.7');
  assertPassage(trin, 15, 26, 47, 'word', 'trinity 15.26.47');
  const t8812 = assertPassage(trin, 8, 8, 12, 'love', 'trinity 8.8.12');
  assertPassage(trin, 14, 15, 21, 'mind', 'trinity 14.15.21');
  assertPassage(trin, 2, 1, 2, 'God', 'trinity 2.1.2');

  const confArticles = toArticles(conf);
  const trinArticles = toArticles(trin);
  const confBody = Buffer.from(JSON.stringify(confArticles));
  const trinBody = Buffer.from(JSON.stringify(trinArticles));
  const confIndex = Buffer.from(JSON.stringify(buildIndex(confArticles)));
  const trinIndex = Buffer.from(JSON.stringify(buildIndex(trinArticles)));
  const raw = confBody.length + trinBody.length + confIndex.length + trinIndex.length;
  const gz =
    gzipLen(confBody) + gzipLen(trinBody) + gzipLen(confIndex) + gzipLen(trinIndex);
  const ratio = gz / CORPUS_GZ_BYTES;

  const volGz = [101, 102, 103, 104, 105, 106, 107, 108].map((n) => {
    const file = path.join(path.dirname(confPath), `npnf${n}.txt`);
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    return { n, raw: buf.length, gz: gzipLen(buf) };
  }).filter(Boolean);
  const volRaw = volGz.reduce((s, r) => s + r.raw, 0);
  const volCompressed = volGz.reduce((s, r) => s + r.gz, 0);

  const report = {
    corpusGzBytes: CORPUS_GZ_BYTES,
    corpusGzMiB: CORPUS_GZ_BYTES / 1024 / 1024,
    newRawBytes: raw,
    newGzBytes: gz,
    newGzMiB: gz / 1024 / 1024,
    ratio,
    threshold: MAX_RATIO,
    confUnits: confArticles.length,
    confParagraphs: conf.filter((u) => u.role === 'paragraph').length,
    trinUnits: trinArticles.length,
    trinParagraphs: trin.filter((u) => u.role === 'paragraph').length,
    sample837: c837.text.slice(0, 220),
    sample8812: t8812.text.slice(0, 220),
    sample152647: findParagraph(trin, 15, 26, 47).text.slice(0, 220),
    npnf1Volumes: volGz,
    npnf1RawBytes: volRaw,
    npnf1GzBytes: volCompressed,
    npnf1Ratio: volCompressed / CORPUS_GZ_BYTES,
  };
  console.log(JSON.stringify(report, null, 2));
  if (ratio > MAX_RATIO) {
    console.error(`REFUSE integrate: gzip ratio ${ratio.toFixed(4)} > ${MAX_RATIO}`);
    process.exit(3);
  }

  const confWritten = writeDoc('npnf-agustin-confesiones-en', {
    title: 'The Confessions',
    shortTitle: 'Confessiones',
    sourceUrl: 'https://www.ccel.org/ccel/schaff/npnf101.vi.html',
    sourceNote:
      'English public-domain translation (Nicene and Post-Nicene Fathers, First Series, vol. 1; Philip Schaff, ed.) as published by CCEL. Each numbered paragraph is the book, chapter and paragraph of that edition, so a citation can open that paragraph alone. Not an official Holy See translation. The Spanish BAC OCR stays in its own file.',
  }, confArticles);
  const trinWritten = writeDoc('npnf-agustin-de-trinitate-en', {
    title: 'On the Holy Trinity',
    shortTitle: 'De Trinitate',
    sourceUrl: 'https://www.ccel.org/ccel/schaff/npnf103.iv.i.html',
    sourceNote:
      'English public-domain translation (Nicene and Post-Nicene Fathers, First Series, vol. 3; Arthur West Haddan, revised by William G. T. Shedd; Philip Schaff, ed.) as published by CCEL. Each numbered paragraph is the book, chapter and paragraph of that edition, so a citation can open that paragraph alone. Not an official Holy See translation. The Spanish BAC OCR stays in its own file.',
  }, trinArticles);
  insertManifest(path.join(CANON, 'manifest.json'), [confWritten.entry, trinWritten.entry]);
  insertManifest(ASSETS_MANIFEST, [confWritten.entry, trinWritten.entry]);
  console.log('wrote', confWritten.entry.id, trinWritten.entry.id);
}

main();
