/**
 * Repo-local download registry (documentos/registry/downloaded-documents.json).
 * Tracks what was scraped into the corpus pack and when refs were resolved.
 */
import fs from "fs";
import path from "path";

const REPO = path.resolve(__dirname, "../../..");

export const DEFAULT_REGISTRY_PATH = path.join(
  REPO,
  "documentos",
  "registry",
  "downloaded-documents.json",
);

export type DownloadStatus = "active" | "stale" | "pending" | "error";

export interface CorpusPaths {
  content: string;
  index: string;
  meta?: string;
}

export interface DownloadedDocumentEntry {
  id: string;
  sourceId: string;
  title: string;
  kind: string;
  locale: string;
  sourceUrls: string[];
  /** null when only migrated / first download time unknown */
  firstDownloadedAt: string | null;
  lastDownloadedAt: string;
  lastResolvedAt?: string;
  unitCount: number;
  status: DownloadStatus | string;
  corpusPaths: CorpusPaths;
  notes?: string;
}

export interface DownloadRegistry {
  version: number;
  updatedAt: string;
  documents: DownloadedDocumentEntry[];
}

export type UpsertDownloadInput = {
  id: string;
  sourceId: string;
  title: string;
  kind: string;
  locale: string;
  sourceUrls?: string[];
  unitCount: number;
  status?: DownloadStatus | string;
  corpusPaths?: Partial<CorpusPaths>;
  notes?: string;
  /** Override timestamps (tests / migration) */
  downloadedAt?: string;
  firstDownloadedAt?: string | null;
};

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyRegistry(): DownloadRegistry {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    documents: [],
  };
}

/**
 * Load registry from disk. Missing file → empty registry (not thrown).
 */
export function loadRegistry(
  registryPath: string = DEFAULT_REGISTRY_PATH,
): DownloadRegistry {
  if (!fs.existsSync(registryPath)) {
    return emptyRegistry();
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(registryPath, "utf-8"),
    ) as DownloadRegistry;
    if (!raw || !Array.isArray(raw.documents)) {
      console.warn(
        `[registry] invalid shape at ${registryPath}; using empty registry`,
      );
      return emptyRegistry();
    }
    return {
      version: raw.version ?? 1,
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
      documents: raw.documents,
    };
  } catch (err) {
    console.warn(
      `[registry] failed to parse ${registryPath}:`,
      (err as Error).message,
    );
    return emptyRegistry();
  }
}

/**
 * Persist registry (pretty JSON for git-friendly diffs).
 */
export function saveRegistry(
  registry: DownloadRegistry,
  registryPath: string = DEFAULT_REGISTRY_PATH,
): void {
  ensureDir(path.dirname(registryPath));
  registry.updatedAt = new Date().toISOString();
  if (!registry.version) registry.version = 1;
  // Stable order: by id
  registry.documents = [...registry.documents].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  fs.writeFileSync(
    registryPath,
    JSON.stringify(registry, null, 2) + "\n",
    "utf-8",
  );
}

function defaultCorpusPaths(docId: string): CorpusPaths {
  return {
    content: `documents/${docId}/content.json`,
    index: `documents/${docId}/index.json`,
  };
}

/**
 * Insert or update a document entry after a successful corpus write.
 * Preserves firstDownloadedAt when already set; bumps lastDownloadedAt.
 */
export function upsertDownload(
  input: UpsertDownloadInput,
  registryPath: string = DEFAULT_REGISTRY_PATH,
): DownloadedDocumentEntry {
  const registry = loadRegistry(registryPath);
  const now = input.downloadedAt ?? new Date().toISOString();
  const idx = registry.documents.findIndex((d) => d.id === input.id);

  const corpusPaths: CorpusPaths = {
    ...defaultCorpusPaths(input.id),
    ...input.corpusPaths,
  };

  if (idx >= 0) {
    const prev = registry.documents[idx];
    const next: DownloadedDocumentEntry = {
      ...prev,
      sourceId: input.sourceId,
      title: input.title,
      kind: input.kind,
      locale: input.locale,
      sourceUrls: input.sourceUrls ?? prev.sourceUrls ?? [],
      unitCount: input.unitCount,
      status: input.status ?? prev.status ?? "active",
      corpusPaths,
      lastDownloadedAt: now,
      firstDownloadedAt:
        input.firstDownloadedAt !== undefined
          ? input.firstDownloadedAt
          : prev.firstDownloadedAt ?? now,
      notes:
        input.notes !== undefined ? input.notes : prev.notes ?? "",
    };
    // keep lastResolvedAt if present
    if (prev.lastResolvedAt && !next.lastResolvedAt) {
      next.lastResolvedAt = prev.lastResolvedAt;
    }
    registry.documents[idx] = next;
    saveRegistry(registry, registryPath);
    console.log(`[✓] registry upsert ${next.id} (update)`);
    return next;
  }

  const created: DownloadedDocumentEntry = {
    id: input.id,
    sourceId: input.sourceId,
    title: input.title,
    kind: input.kind,
    locale: input.locale,
    sourceUrls: input.sourceUrls ?? [],
    firstDownloadedAt:
      input.firstDownloadedAt !== undefined
        ? input.firstDownloadedAt
        : now,
    lastDownloadedAt: now,
    unitCount: input.unitCount,
    status: input.status ?? "active",
    corpusPaths,
    notes: input.notes ?? "",
  };
  registry.documents.push(created);
  saveRegistry(registry, registryPath);
  console.log(`[✓] registry upsert ${created.id} (create)`);
  return created;
}

/**
 * Mark a document as reference-resolved (after resolve_refs).
 */
export function markResolved(
  docId: string,
  registryPath: string = DEFAULT_REGISTRY_PATH,
  resolvedAt?: string,
): DownloadedDocumentEntry | null {
  const registry = loadRegistry(registryPath);
  const entry = registry.documents.find((d) => d.id === docId);
  if (!entry) {
    console.warn(
      `[registry] markResolved: no entry for "${docId}" (skip)`,
    );
    return null;
  }
  entry.lastResolvedAt = resolvedAt ?? new Date().toISOString();
  saveRegistry(registry, registryPath);
  console.log(`[✓] registry markResolved ${docId}`);
  return entry;
}

/**
 * Convenience: mark several doc ids resolved in one save.
 */
export function markResolvedMany(
  docIds: string[],
  registryPath: string = DEFAULT_REGISTRY_PATH,
  resolvedAt?: string,
): void {
  if (!docIds.length) return;
  const registry = loadRegistry(registryPath);
  const at = resolvedAt ?? new Date().toISOString();
  let touched = 0;
  for (const id of docIds) {
    const entry = registry.documents.find((d) => d.id === id);
    if (!entry) {
      console.warn(`[registry] markResolved: no entry for "${id}" (skip)`);
      continue;
    }
    entry.lastResolvedAt = at;
    touched++;
  }
  if (touched) {
    saveRegistry(registry, registryPath);
    console.log(
      `[✓] registry markResolved ${touched} doc(s): ${docIds.join(", ")}`,
    );
  }
}
