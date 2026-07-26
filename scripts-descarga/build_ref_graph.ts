/**
 * Build offline unit citation graph (ref-only edges) for the topic-search pack.
 *
 * Scans content.json for referencias.local → edges documentId:unitIndex → targets.
 * Dual-writes under documentos/corpus/search/{locale}/ and frontend assets.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts-descarga/build_ref_graph.ts --locale es
 *   npm run topics:build-graph -- --locale es
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const CORPUS_ROOTS = [
  path.join(REPO, 'documentos', 'corpus'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus'),
];

interface ManifestDoc {
  id: string;
  locale?: string;
  bodyPath?: string;
  unitCount?: number;
}

interface LocalRef {
  idDocumento?: string;
  idPunto?: string;
}

interface UnitGraphEdge {
  documentId: string;
  unitIndex: number;
  weight: number;
  type: 'ref' | 'ref-reciprocal';
}

function parseArgs(argv: string[]) {
  let locale = 'es';
  let reciprocal = true;
  let maxDegree = 32;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--locale' && argv[i + 1]) locale = argv[++i];
    else if (a === '--no-reciprocal') reciprocal = false;
    else if (a === '--max-degree' && argv[i + 1])
      maxDegree = Math.max(1, parseInt(argv[++i], 10) || 32);
    else if (a === '--help') {
      console.log(`Usage: build_ref_graph.ts [--locale es] [--no-reciprocal] [--max-degree 32]`);
      process.exit(0);
    }
  }
  return { locale, reciprocal, maxDegree };
}

function unitKey(documentId: string, unitIndex: number): string {
  return `${documentId}:${unitIndex}`;
}

function parseUnitIndex(idPunto: string | undefined, unitCount: number): number | null {
  if (idPunto == null || idPunto === '') return null;
  const n = Number(String(idPunto).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n >= unitCount) return null;
  return n;
}

function loadManifest(root: string): { version: string | number; documents: ManifestDoc[] } {
  const p = path.join(root, 'manifest.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    version: raw.version ?? '0',
    documents: Array.isArray(raw.documents) ? raw.documents : [],
  };
}

function resolveBodyPath(root: string, meta: ManifestDoc): string {
  if (meta.bodyPath) {
    const cleaned = meta.bodyPath.replace(/^\//, '');
    if (cleaned.startsWith('assets/corpus/')) {
      return path.join(root, cleaned.replace(/^assets\/corpus\//, ''));
    }
    return path.join(root, cleaned);
  }
  return path.join(root, 'documents', meta.id, 'content.json');
}

function main() {
  const { locale, reciprocal, maxDegree } = parseArgs(process.argv.slice(2));
  const primary = CORPUS_ROOTS[0];
  if (!fs.existsSync(path.join(primary, 'manifest.json'))) {
    console.error(`Missing manifest under ${primary}`);
    process.exit(1);
  }

  const man = loadManifest(primary);
  const docs = man.documents.filter((d) => {
    const loc = (d.locale || '').toLowerCase();
    if (loc === locale) return true;
    return d.id.toLowerCase().endsWith(`-${locale}`);
  });

  /** target doc unit counts for bounds checks */
  const unitCounts = new Map<string, number>();
  /** edges: sourceKey → edge[] */
  const edges = new Map<string, UnitGraphEdge[]>();
  let rawEdgeCount = 0;
  let skippedBadTarget = 0;

  for (const meta of docs) {
    const bodyPath = resolveBodyPath(primary, meta);
    if (!fs.existsSync(bodyPath)) {
      console.warn(`skip missing body ${meta.id}: ${bodyPath}`);
      continue;
    }
    let units: unknown[];
    try {
      units = JSON.parse(fs.readFileSync(bodyPath, 'utf8'));
    } catch (e) {
      console.warn(`skip parse ${meta.id}`, e);
      continue;
    }
    if (!Array.isArray(units)) continue;
    unitCounts.set(meta.id, units.length);

    for (let i = 0; i < units.length; i++) {
      const u = units[i] as { referencias?: unknown[] };
      const refs = Array.isArray(u?.referencias) ? u.referencias : [];
      for (const r of refs) {
        if (!r || typeof r !== 'object') continue;
        const local = (r as { local?: LocalRef }).local;
        if (!local?.idDocumento) continue;
        const targetId = String(local.idDocumento);
        // Target must exist in same-locale set or full corpus (bible may be es)
        const targetMeta =
          docs.find((d) => d.id === targetId) ||
          man.documents.find((d) => d.id === targetId);
        if (!targetMeta) {
          skippedBadTarget++;
          continue;
        }
        let tCount = unitCounts.get(targetId);
        if (tCount == null) {
          const tp = resolveBodyPath(primary, targetMeta);
          if (!fs.existsSync(tp)) {
            skippedBadTarget++;
            continue;
          }
          try {
            const tu = JSON.parse(fs.readFileSync(tp, 'utf8'));
            tCount = Array.isArray(tu) ? tu.length : 0;
            unitCounts.set(targetId, tCount);
          } catch {
            skippedBadTarget++;
            continue;
          }
        }
        const tIdx = parseUnitIndex(local.idPunto, tCount);
        if (tIdx == null) {
          skippedBadTarget++;
          continue;
        }
        // Skip self-loop same unit
        if (targetId === meta.id && tIdx === i) continue;

        const sk = unitKey(meta.id, i);
        const list = edges.get(sk) || [];
        // de-dupe same target
        if (list.some((e) => e.documentId === targetId && e.unitIndex === tIdx)) {
          continue;
        }
        list.push({
          documentId: targetId,
          unitIndex: tIdx,
          weight: 1,
          type: 'ref',
        });
        edges.set(sk, list);
        rawEdgeCount++;
      }
    }
  }

  if (reciprocal) {
    const snapshot = [...edges.entries()];
    for (const [sk, list] of snapshot) {
      const [srcDoc, srcIdxStr] = sk.split(':');
      const srcIdx = Number(srcIdxStr);
      for (const e of list) {
        if (e.type !== 'ref') continue;
        const tk = unitKey(e.documentId, e.unitIndex);
        const back = edges.get(tk) || [];
        if (
          back.some(
            (b) => b.documentId === srcDoc && b.unitIndex === srcIdx,
          )
        ) {
          continue;
        }
        back.push({
          documentId: srcDoc,
          unitIndex: srcIdx,
          weight: 0.85,
          type: 'ref-reciprocal',
        });
        edges.set(tk, back);
      }
    }
  }

  // Cap degree per node
  const edgesOut: Record<string, UnitGraphEdge[]> = {};
  let capped = 0;
  for (const [k, list] of edges) {
    // Prefer direct ref over reciprocal, then weight desc
    list.sort((a, b) => {
      const ta = a.type === 'ref' ? 1 : 0;
      const tb = b.type === 'ref' ? 1 : 0;
      return tb - ta || b.weight - a.weight || a.documentId.localeCompare(b.documentId);
    });
    if (list.length > maxDegree) {
      capped += list.length - maxDegree;
      edgesOut[k] = list.slice(0, maxDegree);
    } else {
      edgesOut[k] = list;
    }
  }

  const edgeCount = Object.values(edgesOut).reduce((n, a) => n + a.length, 0);
  const nodeCount = Object.keys(edgesOut).length;

  const graphFile = {
    version: 1,
    locale,
    edges: edgesOut,
  };

  // Update locale pack manifests
  const fingerprintDocs = docs
    .map((d) => `${d.id}|${d.unitCount ?? ''}|${d.bodyPath || ''}`)
    .sort()
    .join('\n');
  const fp = crypto.createHash('sha256').update(fingerprintDocs).digest('hex').slice(0, 16);

  for (const root of CORPUS_ROOTS) {
    const searchRoot = path.join(root, 'search');
    const locDir = path.join(searchRoot, locale);
    fs.mkdirSync(locDir, { recursive: true });

    // root search-manifest
    const rootManPath = path.join(searchRoot, 'search-manifest.json');
    let rootMan: {
      version: string;
      schema: number;
      locales: Record<string, string>;
      sourceNote?: string;
    } = {
      version: '0.2.0',
      schema: 1,
      locales: { [locale]: locale },
      sourceNote: 'Topic-search pack with ref citation graph (PR3).',
    };
    if (fs.existsSync(rootManPath)) {
      try {
        rootMan = { ...rootMan, ...JSON.parse(fs.readFileSync(rootManPath, 'utf8')) };
        rootMan.locales = { ...(rootMan.locales || {}), [locale]: locale };
        rootMan.version = rootMan.version || '0.2.0';
        rootMan.sourceNote =
          'Topic-search pack with ref citation graph (PR3).';
      } catch {
        /* use default */
      }
    }
    fs.writeFileSync(rootManPath, JSON.stringify(rootMan, null, 2) + '\n');

    // locale manifest
    const locManPath = path.join(locDir, 'manifest.json');
    let locMan: Record<string, unknown> = {
      version: '0.2.0',
      schema: 1,
      locale,
      generatedAt: new Date().toISOString(),
      corpusFingerprint: {
        algo: 'sha256',
        value: fp,
        docCount: docs.length,
      },
      caps: {
        maxTopics: 250,
        maxPostingsPerTopic: 200,
        maxRawBytes: 12_000_000,
      },
      topicCount: 0,
      edgeCount,
      files: {
        topics: 'topics.json',
        postings: 'topic-postings.json',
        termTopics: 'term-topics.json',
        graph: 'unit-graph.json',
      },
      sourceNote: `Ref-only unit graph for locale ${locale}. nodes=${nodeCount} edges=${edgeCount}.`,
    };
    if (fs.existsSync(locManPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(locManPath, 'utf8'));
        locMan = {
          ...prev,
          ...locMan,
          files: {
            ...(prev.files || {}),
            topics: prev.files?.topics || 'topics.json',
            postings: prev.files?.postings || 'topic-postings.json',
            termTopics: prev.files?.termTopics || 'term-topics.json',
            graph: 'unit-graph.json',
          },
          edgeCount,
          corpusFingerprint: locMan.corpusFingerprint,
          generatedAt: locMan.generatedAt,
          sourceNote: locMan.sourceNote,
        };
      } catch {
        /* keep */
      }
    }
    fs.writeFileSync(locManPath, JSON.stringify(locMan, null, 2) + '\n');

    // ensure empty companions exist
    for (const [name, body] of [
      ['topics.json', { topics: [] }],
      ['topic-postings.json', { version: 1, locale, postings: {} }],
      ['term-topics.json', { version: 1, locale, terms: {} }],
    ] as const) {
      const p = path.join(locDir, name);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, JSON.stringify(body, null, 2) + '\n');
      }
    }

    const graphPath = path.join(locDir, 'unit-graph.json');
    fs.writeFileSync(graphPath, JSON.stringify(graphFile) + '\n');
    const bytes = fs.statSync(graphPath).size;
    console.log(
      `wrote ${path.relative(REPO, graphPath)} (${(bytes / 1024).toFixed(1)} KiB)`,
    );
  }

  console.log(
    JSON.stringify(
      {
        locale,
        docsScanned: docs.length,
        nodes: nodeCount,
        edges: edgeCount,
        rawEdgesBeforeCap: rawEdgeCount,
        reciprocal,
        maxDegree,
        degreeCappedDropped: capped,
        skippedBadTarget,
        fingerprint: fp,
      },
      null,
      2,
    ),
  );
}

main();
