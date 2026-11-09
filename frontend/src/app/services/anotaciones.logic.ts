/**
 * Marca local de una anotación.
 * Si falta `updatedAt`, se reutiliza `createdAt` (epoch ms o ISO).
 * El reloj de esta carga solo entra cuando `createdAt` tampoco se puede leer.
 */

export function isoFromCreatedAt(createdAt: unknown): string | null {
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) {
    return isoOrNull(new Date(createdAt));
  }
  if (typeof createdAt !== 'string') return null;
  const trimmed = createdAt.trim();
  if (!trimmed) return null;
  if (/^-?\d+$/.test(trimmed)) return isoOrNull(new Date(Number(trimmed)));
  return isoOrNull(new Date(trimmed));
}

/**
 * Conserva un `updatedAt` ya escrito.
 * Si no hay, devuelve el ISO de `createdAt`.
 */
export function fillAnotacionUpdatedAt(
  updatedAt: unknown,
  createdAt: unknown,
  now: () => string = () => new Date().toISOString(),
): string {
  if (typeof updatedAt === 'string' && updatedAt.length > 0) return updatedAt;
  return isoFromCreatedAt(createdAt) ?? now();
}

function isoOrNull(d: Date): string | null {
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
