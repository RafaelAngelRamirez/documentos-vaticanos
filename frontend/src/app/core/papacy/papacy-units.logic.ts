/**
 * Pope life sheet → reading units (same lector as santoral).
 * documentId namespace: `papacy:{popeId}` — never collides with pack ids.
 */
import type { PopeRecord } from './papacy.models';
import type {
  Article,
  DocumentMeta,
  Indice,
  LoadedDocument,
} from '../corpus/corpus.models';

export const PAPACY_DOC_PREFIX = 'papacy:';

export function popeDocumentId(popeId: string): string {
  return `${PAPACY_DOC_PREFIX}${popeId}`;
}

export function parsePopeDocumentId(
  documentId: string | undefined | null,
): string | null {
  let raw = String(documentId || '').trim();
  if (!raw) return null;
  try {
    if (raw.includes('%')) raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  if (!raw.startsWith(PAPACY_DOC_PREFIX)) return null;
  const id = raw.slice(PAPACY_DOC_PREFIX.length).trim();
  return id || null;
}

export function isPopeDocumentId(
  documentId: string | undefined | null,
): boolean {
  return parsePopeDocumentId(documentId) != null;
}

function bioToUnits(bio: string | undefined | null): Article[] {
  const text = String(bio || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!text) return [];
  let parts = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/[ \t]+\n/g, '\n').trim())
    .filter((p) => p.length > 0);
  if (parts.length === 1 && text.length > 1200) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 4) {
      const chunkSize = Math.max(2, Math.min(5, Math.ceil(lines.length / 12)));
      parts = [];
      for (let i = 0; i < lines.length; i += chunkSize) {
        parts.push(lines.slice(i, i + chunkSize).join('\n'));
      }
    }
  }
  return parts.map((contenido, index_array) => ({
    index_array,
    consecutivo: `§${index_array + 1}`,
    contenido,
  }));
}

function buildIndice(units: Article[]): Indice {
  const indice: { [key: string]: number[] } = {};
  const indice_por_punto: { [key: number]: number | null } = {};
  for (const u of units) {
    const key = u.consecutivo || String(u.index_array);
    if (!indice[key]) indice[key] = [];
    indice[key].push(u.index_array);
    indice_por_punto[u.index_array] = u.index_array + 1;
  }
  return { indice, indice_por_punto };
}

export function popeToReadingDocument(
  pope: PopeRecord,
): LoadedDocument | null {
  if (!pope?.id) return null;
  const units = bioToUnits(pope.bio);
  const documento: Article[] =
    units.length > 0
      ? units
      : [
          {
            index_array: 0,
            consecutivo: '§1',
            contenido:
              'No hay ficha de vida disponible en el pack offline para este papa.',
          },
        ];
  const title = pope.displayName || pope.name || pope.id;
  const id = popeDocumentId(pope.id);
  const meta: DocumentMeta = {
    id,
    title,
    shortTitle: title.length > 28 ? title.slice(0, 26) + '…' : title,
    kind: 'pope-bio',
    locale: pope.locale || 'es',
    sourceUrl: pope.sourceUrl,
    author: title,
    sourceNote:
      'Ficha de pontífice (lista vatican.va + santoral). No es documento magisterial.',
    bodyPath: `papacy/synthetic/${pope.id}`,
    indexPath: `papacy/synthetic/${pope.id}.index`,
    unitCount: documento.length,
  };
  return {
    meta,
    documento,
    indice: buildIndice(documento),
  };
}

export function canContinuePopeReading(
  lastRead: { documentId?: string; unitIndex?: number } | null | undefined,
  popeId: string,
): boolean {
  if (!lastRead || lastRead.unitIndex == null) return false;
  return (
    lastRead.documentId === popeDocumentId(popeId) && lastRead.unitIndex > 0
  );
}
