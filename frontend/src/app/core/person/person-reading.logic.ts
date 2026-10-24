/**
 * First corpus pack linked from a Padre / Doctor / Santo works list.
 * Ficha CTAs open this document; do not invent a pack when none is linked.
 */

export interface PersonWorkRef {
  documentId?: string | null;
}

export function primaryWorkDocumentId(
  works: PersonWorkRef[] | null | undefined,
): string | null {
  if (!works?.length) return null;
  for (const w of works) {
    const id = typeof w?.documentId === 'string' ? w.documentId.trim() : '';
    if (id) return id;
  }
  return null;
}
