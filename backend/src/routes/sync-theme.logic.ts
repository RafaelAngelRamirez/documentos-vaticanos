/**
 * Identidad de un tema en POST /sync/merge.
 * La única clave es el id. Un nombre repetido es otro tema.
 * Esta función no recibe el nombre: no hay con qué emparejarlo.
 */

export type ThemeIdOccupant = {
  id: string;
  ownerId: string;
};

export type ThemeMergeAction =
  | { action: 'update'; id: string }
  | { action: 'create'; id: string | null };

/** Id que manda el dispositivo. Vacío no es un id. */
export function themeDeviceId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return id.length > 0 ? id : null;
}

/**
 * Alta firmada y el merge que sigue.
 * La fila de la nube queda con el id del dispositivo.
 * El merge actualiza esa fila. No abre otra.
 */
export function signedCreateThenMerge(
  deviceId: string,
  ownerId: string,
): { cloudId: string; merge: ThemeMergeAction } {
  const created = themeMergeAction(deviceId, null, ownerId);
  if (created.action !== 'create' || created.id !== deviceId) {
    throw new Error('alta firmada sin el id del dispositivo');
  }
  return {
    cloudId: created.id,
    merge: themeMergeAction(deviceId, { id: created.id, ownerId }, ownerId),
  };
}

/**
 * El id que ya es de este dueño se actualiza.
 * Un id libre se crea con ese mismo id.
 * Un id de otro dueño no se toca: la fila nueva lleva id del servidor.
 * Sin id, la fila nueva también lleva id del servidor.
 */
export function themeMergeAction(
  incomingId: string | null,
  occupant: ThemeIdOccupant | null,
  ownerId: string,
): ThemeMergeAction {
  const id = typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : null;
  if (!id) return { action: 'create', id: null };
  if (occupant?.id === id && occupant.ownerId === ownerId) {
    return { action: 'update', id };
  }
  if (occupant?.id === id) return { action: 'create', id: null };
  return { action: 'create', id };
}
