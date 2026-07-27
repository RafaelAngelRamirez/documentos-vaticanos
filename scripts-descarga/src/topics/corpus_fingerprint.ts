/**
 * Content-aware corpus fingerprint for topic-search packs (design A.6 / A.6.1).
 *
 * Unlike reading-pack documentFingerprint (id|paths|unitCount), this hashes
 * actual content.json + index.json bytes so OCR/text repairs invalidate the
 * topic pack even when unitCount is stable.
 *
 * Pure-ish: only Node fs/path/crypto; no Angular.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface FingerprintDocMeta {
  id: string;
  locale?: string;
  bodyPath?: string;
  indexPath?: string;
  unitCount?: number;
}

export interface CorpusFingerprintResult {
  algo: 'sha256';
  /** Hex digest of the canonical multi-line document digest (full 64 chars). */
  value: string;
  /** Short form (first 16 hex) for compact manifests / logs. */
  valueShort: string;
  docCount: number;
  /** Number of body/index files that existed on disk. */
  filesHashed: number;
  /** Missing body/index paths (still contribute a MISSING marker). */
  missingFiles: string[];
}

function normalizeLocale(code?: string | null): string {
  if (!code) return '';
  return code.trim().toLowerCase().split(/[-_]/)[0] || '';
}

/**
 * Docs that belong to a content locale (meta.locale or id suffix -es / -en…).
 */
export function filterDocsForLocale(
  docs: FingerprintDocMeta[],
  locale: string,
): FingerprintDocMeta[] {
  const loc = normalizeLocale(locale);
  if (!loc) return [...docs];
  return docs.filter((d) => {
    const ml = normalizeLocale(d.locale);
    if (ml && ml === loc) return true;
    if (!ml && d.id.toLowerCase().endsWith(`-${loc}`)) return true;
    return false;
  });
}

export function resolveCorpusRelPath(
  corpusRoot: string,
  relOrAbs: string | undefined,
  fallbackRel: string,
): string {
  const raw = (relOrAbs || fallbackRel).replace(/^\//, '');
  if (raw.startsWith('assets/corpus/')) {
    return path.join(corpusRoot, raw.replace(/^assets\/corpus\//, ''));
  }
  return path.join(corpusRoot, raw);
}

export function sha256File(absPath: string): string {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * One canonical line per document (sorted later):
 *   id|unitCount|bodyRel|indexRel|contentSha256|indexSha256
 * Missing files use the sentinel `MISSING` instead of a hash.
 */
export function documentContentDigestLine(
  corpusRoot: string,
  doc: FingerprintDocMeta,
): { line: string; missing: string[] } {
  const bodyRel =
    doc.bodyPath?.replace(/^\//, '').replace(/^assets\/corpus\//, '') ||
    `documents/${doc.id}/content.json`;
  const indexRel =
    doc.indexPath?.replace(/^\//, '').replace(/^assets\/corpus\//, '') ||
    `documents/${doc.id}/index.json`;
  const bodyAbs = resolveCorpusRelPath(corpusRoot, doc.bodyPath, bodyRel);
  const indexAbs = resolveCorpusRelPath(corpusRoot, doc.indexPath, indexRel);
  const missing: string[] = [];
  let contentSha = 'MISSING';
  let indexSha = 'MISSING';
  if (fs.existsSync(bodyAbs) && fs.statSync(bodyAbs).isFile()) {
    contentSha = sha256File(bodyAbs);
  } else {
    missing.push(bodyAbs);
  }
  if (fs.existsSync(indexAbs) && fs.statSync(indexAbs).isFile()) {
    indexSha = sha256File(indexAbs);
  } else {
    missing.push(indexAbs);
  }
  const unitCount =
    doc.unitCount == null || !Number.isFinite(doc.unitCount)
      ? ''
      : String(doc.unitCount);
  const line = [
    doc.id,
    unitCount,
    bodyRel,
    indexRel,
    contentSha,
    indexSha,
  ].join('|');
  return { line, missing };
}

/**
 * Compute content-aware fingerprint for all docs of `locale` under corpusRoot.
 */
export function computeLocaleCorpusFingerprint(
  corpusRoot: string,
  docs: FingerprintDocMeta[],
  locale: string,
): CorpusFingerprintResult {
  const scoped = filterDocsForLocale(docs, locale).slice().sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const lines: string[] = [];
  const missingFiles: string[] = [];
  let filesHashed = 0;
  for (const d of scoped) {
    const { line, missing } = documentContentDigestLine(corpusRoot, d);
    lines.push(line);
    for (const m of missing) missingFiles.push(m);
    // Count non-MISSING hash slots (2 per doc max)
    const parts = line.split('|');
    if (parts[4] && parts[4] !== 'MISSING') filesHashed++;
    if (parts[5] && parts[5] !== 'MISSING') filesHashed++;
  }
  const payload = lines.join('\n');
  const value = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  return {
    algo: 'sha256',
    value,
    valueShort: value.slice(0, 16),
    docCount: scoped.length,
    filesHashed,
    missingFiles,
  };
}

/**
 * Load manifest.json documents[] from a corpus root.
 */
export function loadManifestDocs(corpusRoot: string): FingerprintDocMeta[] {
  const p = path.join(corpusRoot, 'manifest.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const docs = Array.isArray(raw?.documents) ? raw.documents : [];
  return docs.map(
    (d: Record<string, unknown>): FingerprintDocMeta => ({
      id: String(d.id || ''),
      locale: d.locale != null ? String(d.locale) : undefined,
      bodyPath: d.bodyPath != null ? String(d.bodyPath) : undefined,
      indexPath: d.indexPath != null ? String(d.indexPath) : undefined,
      unitCount:
        typeof d.unitCount === 'number' && Number.isFinite(d.unitCount)
          ? d.unitCount
          : undefined,
    }),
  );
}

/**
 * Convenience: fingerprint for locale from corpus root (reads manifest).
 */
export function fingerprintFromCorpusRoot(
  corpusRoot: string,
  locale: string,
): CorpusFingerprintResult {
  return computeLocaleCorpusFingerprint(
    corpusRoot,
    loadManifestDocs(corpusRoot),
    locale,
  );
}

/**
 * Compare pack fingerprint to live corpus.
 * Accepts full or short (16-char) stored values for backward compatibility
 * during migration; after rebuilds, both sides use full 64-char hex.
 */
export function fingerprintsMatch(
  stored: string | undefined | null,
  live: CorpusFingerprintResult,
): boolean {
  if (!stored) return false;
  const s = String(stored).trim().toLowerCase();
  const full = live.value.toLowerCase();
  const short = live.valueShort.toLowerCase();
  return s === full || s === short;
}
