'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const copies = [
  'frontend/src/styles/design-product.css',
  'frontend/src/styles/design-reading.css',
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

for (const rel of copies) {
  if (fs.existsSync(path.join(root, rel))) {
    fail('present ' + rel);
  }
}

const angular = JSON.parse(
  fs.readFileSync(path.join(root, 'frontend/angular.json'), 'utf8'),
);
const styleArrays = [];

function walk(node) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (key === 'styles' && Array.isArray(node[key])) {
      styleArrays.push(node[key]);
    } else {
      walk(node[key]);
    }
  }
}

walk(angular);

if (styleArrays.length === 0) {
  fail('no styles arrays');
}

for (const entries of styleArrays) {
  let sawAppStyle = false;
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      fail('styles entry is not a string');
    }
    if (entry.includes('design-product') || entry.includes('design-reading')) {
      fail('styles entry names a dead copy: ' + entry);
    }
    if (entry.startsWith('node_modules/')) continue;
    if (entry !== 'src/styles.css') {
      fail('styles entry is not src/styles.css: ' + entry);
    }
    sawAppStyle = true;
  }
  if (!sawAppStyle) {
    fail('styles array missing src/styles.css');
  }
}

console.log('OK dead-style-copies');
