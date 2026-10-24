/**
 * Pure immersive-route predicate (no Angular).
 * Home, library, full-text search, and the reader have no product chrome.
 */

const READER_PREFIX = '/leyendo';
const HOME = '/inicio';
const LIB_LEGACY = 'documentos/listar';
const LIB = '/biblioteca';
const SEARCH = '/buscar';

export function pathFromUrl(url: string): string {
  return (url || '').split('?')[0].split('#')[0];
}

/** True for inicio, biblioteca, buscar, and /leyendo/… */
export function isImmersivePath(url: string): boolean {
  const path = pathFromUrl(url);
  const isReader = path === READER_PREFIX || path.startsWith(`${READER_PREFIX}/`);
  const isHome = path === HOME || path === '/' || path === '';
  const isLib = path.includes(LIB_LEGACY) || path.startsWith(LIB);
  const isSearch = path.startsWith(SEARCH);
  return isReader || isHome || isLib || isSearch;
}
