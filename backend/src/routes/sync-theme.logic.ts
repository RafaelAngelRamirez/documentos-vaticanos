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
