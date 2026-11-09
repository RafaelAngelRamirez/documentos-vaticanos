/**
 * documentId stored by POST /me/references.
 * The three forms are parseDocumentId in frontend/src/app/core/reading/cite.ts.
 */

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function referenceDocumentId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let decoded = raw.trim();
  if (!decoded) return null;
  if (decoded.includes('%')) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
  }
  if (decoded.startsWith('santoral:')) {
    const saintId = decoded.slice('santoral:'.length).trim();
    return saintId ? `santoral:${saintId}` : null;
  }
  if (decoded.startsWith('papacy:')) {
    const popeId = decoded.slice('papacy:'.length).trim();
    return popeId ? `papacy:${popeId}` : null;
  }
  if (!SLUG.test(decoded)) return null;
  return decoded;
}
