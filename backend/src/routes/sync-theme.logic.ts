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
  | { action: 'create'; id: string }
  | { action: 'mint' };

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
 * Un id de otro dueño, o ninguno, no se puede guardar: `mint`
 * pide un id nuevo. El plan de lote puede reenganchar esa alta
 * a la única fila de este dueño que el envío no nombra.
 */
export function themeMergeAction(
  incomingId: string | null,
  occupant: ThemeIdOccupant | null,
  ownerId: string,
): ThemeMergeAction {
  const id = typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : null;
  if (!id) return { action: 'mint' };
  if (occupant?.id === id && occupant.ownerId === ownerId) {
    return { action: 'update', id };
  }
  if (occupant?.id === id) return { action: 'mint' };
  return { action: 'create', id };
}

/**
 * Una sola alta (id nuevo o id que no se puede guardar) no se inserta
 * si a este dueño le queda una sola fila que el envío no nombra:
 * se actualiza esa fila. No se mira el nombre.
 * Con varias altas o varias filas así, cada id libre sigue siendo otro tema.
 */
export function planThemeMerges(
  ownerId: string,
  incomingIds: readonly (string | null)[],
  ownedIds: readonly string[],
  occupants: readonly (ThemeIdOccupant | null)[],
): ThemeMergeAction[] {
  const actions = incomingIds.map((incomingId, index) =>
    themeMergeAction(incomingId, occupants[index] ?? null, ownerId),
  );
  const named = new Set(
    incomingIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const unclaimed = ownedIds.filter((id) => !named.has(id));
  const insertAt = actions.flatMap((action, index) =>
    action.action === 'create' || action.action === 'mint' ? [index] : [],
  );
  if (insertAt.length === 1 && unclaimed.length === 1) {
    actions[insertAt[0]] = { action: 'update', id: unclaimed[0] };
  }
  return actions;
}
