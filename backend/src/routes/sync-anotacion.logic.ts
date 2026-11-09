/**
 * Marca y empate de una anotación en POST /sync/merge.
 * Si falta `updatedAt`, la marca es `createdAt`.
 * Un reloj más nuevo gana. En empate, el texto distinto del dispositivo
 * se escribe: no se descarta en silencio.
 */

export type AnotacionRow = {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel: string | null;
  excerpt: string;
  nota: string | null;
  kind: string;
  updatedAt: Date;
};

export type AnotacionMergeAction = 'create' | 'update' | 'keep';

export function resolveAnotacionStamp(
  updatedAt: Date | null,
  createdAt: Date | null,
): Date | null {
  if (isStamp(updatedAt)) return updatedAt;
  if (isStamp(createdAt)) return createdAt;
  return null;
}

/**
 * Sin fila previa: crear.
 * Reloj local mayor: actualizar.
 * Reloj local menor: conservar la nube.
 * Mismo reloj y mismo texto: conservar.
 * Mismo reloj y texto distinto: escribir el dispositivo.
 */
export function anotacionMergeAction(
  incoming: AnotacionRow,
  current: AnotacionRow | null,
): AnotacionMergeAction {
  if (!current) return 'create';
  const inMs = incoming.updatedAt.getTime();
  const curMs = current.updatedAt.getTime();
  if (Number.isNaN(inMs) || Number.isNaN(curMs)) return 'keep';
  if (inMs > curMs) return 'update';
  if (inMs < curMs) return 'keep';
  return sameAnotacionText(incoming, current) ? 'keep' : 'update';
}

/** Una fila por id. Las nuevas y las que pisan van en lotes distintos. */
export function anotacionMergePlan(
  incoming: readonly AnotacionRow[],
  cloudRows: readonly AnotacionRow[],
): { create: AnotacionRow[]; update: AnotacionRow[] } {
  const cloud = new Map(cloudRows.map((row) => [row.id, row]));
  const create = new Map<string, AnotacionRow>();
  const update = new Map<string, AnotacionRow>();

  for (const row of incoming) {
    const current = create.get(row.id) ?? update.get(row.id) ?? cloud.get(row.id) ?? null;
    const action = anotacionMergeAction(row, current);
    if (action === 'keep') continue;
    if (cloud.has(row.id) || update.has(row.id)) {
      create.delete(row.id);
      update.set(row.id, row);
      continue;
    }
    create.set(row.id, row);
  }

  return { create: [...create.values()], update: [...update.values()] };
}

function isStamp(d: Date | null): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function sameAnotacionText(a: AnotacionRow, b: AnotacionRow): boolean {
  return (
    a.documentId === b.documentId &&
    a.unitIndex === b.unitIndex &&
    a.unitLabel === b.unitLabel &&
    a.excerpt === b.excerpt &&
    a.nota === b.nota &&
    a.kind === b.kind
  );
}
