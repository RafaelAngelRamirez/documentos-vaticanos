/**
 * Structural + pure contract tests for local re-OCR (no download).
 * Run: node reocr_local_contract.test.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const SCRIPTS = path.join(REPO, "scripts-descarga");
const INV = path.join(
  REPO,
  "documentos/padres-source/inventory/agustin-volumes.json",
);
const PDF = path.join(REPO, "documentos/padres-source/pdf");
const DONE = new Set([1, 3, 5, 9, 15, 18]);

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`ok  ${msg}`);
  } else {
    failed += 1;
    console.error(`FAIL ${msg}`);
  }
}

// --- scripts exist and are executable ---
for (const name of [
  "reocr_local_volume.sh",
  "reocr_priority_batch.sh",
  "reocr_finish_all_pending.sh",
  "ocr_volume.sh",
]) {
  const p = path.join(SCRIPTS, name);
  ok(fs.existsSync(p), `exists ${name}`);
  const st = fs.statSync(p);
  ok((st.mode & 0o111) !== 0, `executable ${name}`);
}

// --- reocr_local_volume refuses download: dry-run resolves local PDF only ---
const inv = JSON.parse(fs.readFileSync(INV, "utf8"));
ok(Array.isArray(inv.volumes) && inv.volumes.length === 40, "40 agustin volumes");

const pending = [];
for (const v of inv.volumes) {
  const n = Number(v.n);
  if (DONE.has(n)) continue;
  const id = v.corpusDocId;
  const npad = String(n).padStart(2, "0");
  let pdfPath = null;
  for (const name of [`agustin-${npad}.pdf`, `agustin-${n}.pdf`]) {
    const cand = path.join(PDF, name);
    if (fs.existsSync(cand) && fs.statSync(cand).size >= 10000) {
      pdfPath = cand;
      break;
    }
  }
  ok(!!pdfPath, `pdf for pending ${id}`);
  pending.push({ n, id, pdfPath });
}
ok(pending.length === 34, `34 pending (got ${pending.length})`);

// dry-run must succeed for a known pending id without network
{
  const sample = pending.find((p) => p.n === 2) || pending[0];
  const out = execFileSync(
    path.join(SCRIPTS, "reocr_local_volume.sh"),
    ["--doc-id", sample.id, "--dry-run"],
    { encoding: "utf8", env: process.env },
  );
  ok(out.includes("local PDF ok"), "dry-run local PDF ok");
  ok(out.includes("dry-run"), "dry-run mode");
  ok(out.includes(sample.pdfPath) || out.includes(path.basename(sample.pdfPath)), "dry-run cites local pdf path");
  ok(!/download_drive|gdrive|drive\.google/i.test(out), "dry-run does not invoke download");
}

// script source must not call download helpers
{
  const src = fs.readFileSync(path.join(SCRIPTS, "reocr_local_volume.sh"), "utf8");
  ok(!src.includes("download_drive_pdf"), "reocr_local_volume has no download_drive_pdf");
  ok(src.includes("will NOT download") || src.includes("no download"), "documents no-download policy");
}

// completed done-set packs must already have dual content (regression gate)
for (const n of DONE) {
  const v = inv.volumes.find((x) => Number(x.n) === n);
  const id = v.corpusDocId;
  const c1 = path.join(REPO, "documentos/corpus/documents", id, "content.json");
  const c2 = path.join(
    REPO,
    "frontend/src/assets/corpus/documents",
    id,
    "content.json",
  );
  ok(fs.existsSync(c1) && fs.existsSync(c2), `done pack dual content ${id}`);
  const u1 = JSON.parse(fs.readFileSync(c1, "utf8"));
  const u2 = JSON.parse(fs.readFileSync(c2, "utf8"));
  ok(Array.isArray(u1) && u1.length > 0, `done pack units>0 ${id}`);
  ok(u1.length === u2.length, `done pack dual unitCount match ${id}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
