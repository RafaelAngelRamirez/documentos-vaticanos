/**
 * E2E for download/scrape scripts (offline fixtures only — no network required).
 * Run from repo root: node e2e/scrape-e2e.mjs
 * Or: npm run test:scrape -w e2e
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts-descarga');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('OK:', msg);
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    timeout: 120_000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  return r.stdout + r.stderr;
}

console.log('=== scrape e2e (offline) ===');

// 1) ref parser unit tests
{
  const out = run('npx', ['ts-node', '--transpile-only', 'ref_parser.test.ts'], SCRIPTS);
  assert(out.includes('passed') || out.includes('OK') || out.includes('asserts'), 'ref_parser tests');
}

// 2) offline scrape LG from fixture
{
  const out = run(
    'npx',
    ['ts-node', '--transpile-only', 'scrape_source.ts', '--source', 'lg', '--offline'],
    SCRIPTS,
  );
  assert(out.includes('final units') || out.includes('wrote'), 'scrape lg offline');
  const content = path.join(
    ROOT,
    'frontend/src/assets/corpus/documents/lg-es/content.json',
  );
  assert(fs.existsSync(content), 'lg-es content.json exists');
  const units = JSON.parse(fs.readFileSync(content, 'utf8'));
  assert(Array.isArray(units) && units.length >= 60, `lg units >= 60 (got ${units.length})`);
}

// 3) registry file updated
{
  const regPath = path.join(ROOT, 'documentos/registry/downloaded-documents.json');
  if (fs.existsSync(regPath)) {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    assert(Array.isArray(reg.documents), 'registry has documents[]');
    const lg = reg.documents.find((d) => d.id === 'lg-es' || d.sourceId === 'lg');
    assert(lg, 'registry includes lg');
    assert(lg.lastDownloadedAt || lg.unitCount, 'registry lg has metadata');
  } else {
    console.warn('WARN: registry not found yet (write_corpus may not be wired)');
  }
}

// 4) resolve refs does not crash
{
  const out = run('npx', ['ts-node', '--transpile-only', 'resolve_refs.ts'], SCRIPTS);
  assert(out.includes('resolve') || out.includes('summary') || out.includes('Wrote'), 'resolve_refs runs');
}

// 5) fixture sources gs offline if present
const gsFixture = path.join(SCRIPTS, 'fixtures/gs-es/source.html');
if (fs.existsSync(gsFixture)) {
  const out = run(
    'npx',
    ['ts-node', '--transpile-only', 'scrape_source.ts', '--source', 'gs', '--offline'],
    SCRIPTS,
  );
  assert(out.includes('final units') || out.includes('wrote'), 'scrape gs offline');
}

console.log('=== scrape e2e DONE ===');
