/**
 * Runner: shipped misal-liturgia pure functions (frontend core).
 * Run: node scripts-descarga/misal_liturgia_logic.test.js
 */
const path = require('path');
const { spawnSync } = require('child_process');

const testFile = path.join(
  __dirname,
  '../frontend/src/app/core/misal/misal-liturgia.logic.test.js',
);
const r = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    testFile,
  ],
  { encoding: 'utf8', cwd: path.join(__dirname, '..') },
);
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status == null ? 1 : r.status);
