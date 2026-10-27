/**
 * Whether a pack unit already has a bookmark.
 * Pure. No Angular, no DOM, no second store.
 *
 * The address is the cite (`documentId` + `unitIndex`), not the label.
 */

export interface BookmarkMark {
  readonly documentId: string;
  readonly unitIndex: number;
  readonly kind: string;
}

/**
 * True when this pack unit already has a `marcador`.
 * Highlights and notes on the same unit do not count.
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
