/**
 * Caption for a citation that is still fetching its pack.
 * Unknown length stays on “Descargando…”. A known length shows 1–99
 * until the bytes are parsed and the passage can open.
 */
export interface DownloadBytes {
  loaded: number;
  total: number | null;
}

export function citedDownloadCaption(
  progress: DownloadBytes | null | undefined,
): string {
  const loaded = progress?.loaded;
  const total = progress?.total;
  if (
    typeof loaded === 'number' &&
    loaded > 0 &&
    typeof total === 'number' &&
    total > 0
  ) {
    const pct = Math.round((Math.min(loaded, total) / total) * 100);
    const shown = Math.min(99, Math.max(1, pct));
    return `Descargando… ${shown}%`;
  }
  return 'Descargando…';
}
