/**
 * Where a saved unit sits in the document index, and whether that unit
 * already has a bookmark. Pure. No Angular, no DOM, no second store.
 *
 * The resume card stays one cite (`dv.lastRead`: pack id + unit index).
 * Pixel scroll is not a place. Size and mode live in reader-prefs.logic.
 */

/** One index landmark. A section runs until the next landmark. */
export interface SectionMark {
  readonly unitIndex: number;
}

export interface BookmarkMark {
  readonly documentId: string;
  readonly unitIndex: number;
  readonly kind: string;
}

/**
 * Index row that contains `unitIndex`.
 * The match is the last landmark at or before that unit.
 * A unit before the first landmark is not inside a section.
 * Non-integers and empty indexes return null.
 * Tied landmarks: the later row in the list wins.
 */
export function sectionAt<T extends SectionMark>(
  sections: readonly T[] | null | undefined,
  unitIndex: number,
): T | null {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  if (!Number.isInteger(unitIndex) || unitIndex < 0) return null;
  let best: T | null = null;
  for (const entry of sections) {
    if (!entry || !Number.isInteger(entry.unitIndex) || entry.unitIndex < 0) {
      continue;
    }
    if (entry.unitIndex > unitIndex) continue;
    if (!best || entry.unitIndex >= best.unitIndex) best = entry;
  }
  return best;
}

/**
 * True when this pack unit already has a `marcador`.
 * Highlights and notes on the same unit do not count.
 * The address is the cite (`documentId` + `unitIndex`), not the label.
 */
export function unitHasBookmark(
  marks: readonly BookmarkMark[] | null | undefined,
  documentId: string,
  unitIndex: number,
): boolean {
  if (!documentId || !Array.isArray(marks)) return false;
  if (!Number.isInteger(unitIndex) || unitIndex < 0) return false;
  return marks.some(
    (mark) =>
      !!mark &&
      mark.kind === 'marcador' &&
      mark.documentId === documentId &&
      mark.unitIndex === unitIndex,
  );
}
