#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_CHROME = 7;
const META_FILES = [
  'scripts-descarga/models/corpus.model.ts',
  'frontend/src/app/core/corpus/corpus.models.ts',
  'frontend/src/app/core/corpus/corpus-load.logic.ts',
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function documentMetaFields(source, file) {
  const marker = 'export interface DocumentMeta {';
  const start = source.indexOf(marker);
  if (start < 0) fail('missing DocumentMeta in ' + file);
  let depth = 0;
  let end = -1;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) fail('unclosed DocumentMeta in ' + file);
  const body = source
    .slice(source.indexOf('{', start) + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const names = new Set();
  const re = /^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??\s*:/gm;
  let match;
  while ((match = re.exec(body))) names.add(match[1]);
  if (names.size === 0) fail('no DocumentMeta fields in ' + file);
  return names;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const name of a) {
    if (!b.has(name)) return false;
  }
  return true;
}

function walkHtml(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
}

function chromeDivCount() {
  const files = [];
  walkHtml(path.join(ROOT, 'frontend', 'src'), files);
  let count = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const wbars = text.match(/<div class="wbar"/g);
    const fbars = text.match(/<div class="fbar/g);
    count += (wbars ? wbars.length : 0) + (fbars ? fbars.length : 0);
  }
  return count;
}

const sets = META_FILES.map((rel) => {
  const abs = path.join(ROOT, rel);
  return documentMetaFields(fs.readFileSync(abs, 'utf8'), rel);
});
if (!sameSet(sets[0], sets[1]) || !sameSet(sets[0], sets[2])) {
  fail('meta-fields=mismatch');
}

const chrome = chromeDivCount();
if (chrome !== EXPECTED_CHROME) {
  fail('chrome-divs=' + chrome);
}

console.log('meta-fields=ok chrome-divs=7');
