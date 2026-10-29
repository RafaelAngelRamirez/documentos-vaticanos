/**
 * Diario local-first append-only (dv-sync-v1).
 * Reloj híbrido, lápidas y proyección. Sin red.
 * Ver docs/propuesta-sync.md · corte 1–2.
 */

export const SYNC_IDB_NAME = 'dv-sync-v1';
export const DVDELTA_FORMAT = 'dvdelta';
export const DVDELTA_VERSION = 1;

export type Coleccion =
  | 'subrayado'
  | 'nota'
  | 'marca'
  | 'tema'
  | 'paso'
  | 'favorito'
  | 'lectura'
  | 'leccion';

export type OpTipo = 'poner' | 'lapida' | 'campo' | 'orden';

export interface Hlc {
  wall: number;
  counter: number;
  peerId: string;
}

export interface Ancla {
  documentId: string;
  unitIndex: number;
  unitLabel?: string;
  excerpt?: string;
  contentHash?: string;
}

export interface Op {
  opId: string;
  peerId: string;
  seq: number;
  hlc: Hlc;
  groupId: string;
  coleccion: Coleccion;
  entityId: string;
  tipo: OpTipo;
  campo?: string;
  valor?: unknown;
  ancla?: Ancla;
}

export interface JournalMeta {
  peerId: string;
  groupId: string;
  /** Último seq emitido por este par. */
  seq: number;
  hlc: Hlc;
}

export type VectorClock = Record<string, number>;

export interface DvDeltaFile {
  format: typeof DVDELTA_FORMAT;
  version: typeof DVDELTA_VERSION;
  exportedAt: string;
  groupId: string;
  /** Reloj vectorial del exportador tras incluir estas ops. */
  vector: VectorClock;
  ops: Op[];
}

export interface EntityRow {
  entityId: string;
  coleccion: Coleccion;
  valor: unknown;
  ancla?: Ancla;
  hlc: Hlc;
  deleted: boolean;
  /** Redacciones concurrentes perdedoras (notas). */
  variantes?: unknown[];
}

export interface Projection {
  anotaciones: ProjectedAnotacion[];
  temas: ProjectedTema[];
  favoritos: string[];
  lecturas: ProjectedLectura[];
}

export interface ProjectedAnotacion {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel?: string;
  excerpt: string;
  nota?: string;
  kind: 'subrayado' | 'nota' | 'marcador';
  createdAt: number;
  updatedAt: string;
}

export interface ProjectedTemaStep {
  id?: string;
  order: number;
  documentId: string;
  unitIndex: number;
  unitLabel?: string | null;
  userComment?: string | null;
  updatedAt?: string;
}

export interface ProjectedTema {
  id: string;
  title: string;
  description?: string | null;
  coverImageKey?: string | null;
  visibility: string;
  reviewStatus?: string;
  steps: ProjectedTemaStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectedLectura {
  documentId: string;
  title: string;
  unitIndex: number;
  unitCount: number;
  label?: string;
  updatedAt: string;
}

/** Compara relojes híbridos: <0 a menor, 0 igual, >0 a mayor. */
export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  if (a.peerId === b.peerId) return 0;
  return a.peerId < b.peerId ? -1 : 1;
}

/** Avanza el reloj local antes de emitir una operación. */
export function tickHlc(local: Hlc, nowWall: number): Hlc {
  const wall = Math.max(local.wall, nowWall);
  const counter =
    wall === local.wall ? local.counter + 1 : wall > local.wall ? 0 : local.counter + 1;
  return { wall, counter, peerId: local.peerId };
}

/** Incorpora un reloj ajeno (tras aplicar ops remotas). */
export function receiveHlc(local: Hlc, remote: Hlc, nowWall: number): Hlc {
  const wall = Math.max(local.wall, remote.wall, nowWall);
  let counter = 0;
  if (wall === local.wall && wall === remote.wall) {
    counter = Math.max(local.counter, remote.counter) + 1;
  } else if (wall === local.wall) {
    counter = local.counter + 1;
  } else if (wall === remote.wall) {
    counter = remote.counter + 1;
  } else {
    counter = 0;
  }
  return { wall, counter, peerId: local.peerId };
}

export function makeOpId(peerId: string, seq: number): string {
  return `${peerId}:${seq}`;
}

export function newUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fallback abajo */
  }
  return (
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  );
}

export function createJournalMeta(
  nowWall: number = Date.now(),
  peerId: string = newUuid(),
  groupId: string = newUuid(),
): JournalMeta {
  return {
    peerId,
    groupId,
    seq: 0,
    hlc: { wall: nowWall, counter: 0, peerId },
  };
}

export interface EmitContext {
  meta: JournalMeta;
  nowWall: number;
}

/** Emite la siguiente operación local y avanza meta. */
export function emitOp(
  ctx: EmitContext,
  partial: Omit<Op, 'opId' | 'peerId' | 'seq' | 'hlc' | 'groupId'>,
): { op: Op; meta: JournalMeta } {
  const hlc = tickHlc(ctx.meta.hlc, ctx.nowWall);
  const seq = ctx.meta.seq + 1;
  const op: Op = {
    ...partial,
    opId: makeOpId(ctx.meta.peerId, seq),
    peerId: ctx.meta.peerId,
    seq,
    hlc,
    groupId: ctx.meta.groupId,
  };
  return {
    op,
    meta: { ...ctx.meta, seq, hlc },
  };
}

export function coleccionFromAnotacionKind(
  kind: 'subrayado' | 'nota' | 'marcador',
): Coleccion {
  if (kind === 'subrayado') return 'subrayado';
  if (kind === 'marcador') return 'marca';
  return 'nota';
}

export function kindFromColeccion(
  coleccion: Coleccion,
): 'subrayado' | 'nota' | 'marcador' | null {
  if (coleccion === 'subrayado') return 'subrayado';
  if (coleccion === 'marca') return 'marcador';
  if (coleccion === 'nota') return 'nota';
  return null;
}

/** Vector = último seq aplicado por peerId. */
export function vectorFromOps(ops: Op[]): VectorClock {
  const vector: VectorClock = {};
  for (const op of ops) {
    const prev = vector[op.peerId] ?? 0;
    if (op.seq > prev) vector[op.peerId] = op.seq;
  }
  return vector;
}

/**
 * Ops que el receptor aún no tiene (por encima de su vector).
 * Idempotencia: opId ya visto se ignora en apply.
 */
export function opsAboveVector(ops: Op[], vector: VectorClock): Op[] {
  return ops.filter((op) => op.seq > (vector[op.peerId] ?? 0));
}

/** Clave estable fila: colección + entityId (favorito y lectura pueden compartir documentId). */
export function entityKey(coleccion: Coleccion, entityId: string): string {
  return `${coleccion}:${entityId}`;
}

export interface ApplyState {
  /** Filas por `coleccion:entityId`. */
  entities: Map<string, EntityRow>;
  /** opIds ya aplicadas. */
  seen: Set<string>;
  /** Último seq por peer. */
  vector: VectorClock;
  /** Reloj local (peer receptor). */
  hlc: Hlc;
}

export function emptyApplyState(peerId: string, wall = 0): ApplyState {
  return {
    entities: new Map(),
    seen: new Set(),
    vector: {},
    hlc: { wall, counter: 0, peerId },
  };
}

/**
 * Aplica ops en orden de seq por autor. Autores distintos se combinan
 * con la regla de colección (reloj híbrido por fila/campo).
 */
export function applyOps(state: ApplyState, ops: Op[], nowWall = Date.now()): ApplyState {
  const next: ApplyState = {
    entities: new Map(state.entities),
    seen: new Set(state.seen),
    vector: { ...state.vector },
    hlc: { ...state.hlc },
  };

  // Agrupar por peer y ordenar por seq; luego intercalamos por HLC.
  const fresh = ops.filter((op) => {
    if (next.seen.has(op.opId)) return false;
    const need = (next.vector[op.peerId] ?? 0) + 1;
    // Solo aceptar si es la siguiente seq o ya tenemos hueco cubierto después
    // (deltas compactos llegan en orden; fuera de orden se pospone).
    return op.seq >= need;
  });

  const pending = [...fresh].sort((a, b) => {
    if (a.peerId === b.peerId) return a.seq - b.seq;
    return compareHlc(a.hlc, b.hlc);
  });

  // Aplicar respetando seq monótono por peer (cola por autor).
  const queues = new Map<string, Op[]>();
  for (const op of pending) {
    const q = queues.get(op.peerId) || [];
    q.push(op);
    queues.set(op.peerId, q);
  }
  for (const q of queues.values()) q.sort((a, b) => a.seq - b.seq);

  let progressed = true;
  while (progressed) {
    progressed = false;
    const ready: Op[] = [];
    for (const [peerId, q] of queues) {
      while (q.length && q[0].seq === (next.vector[peerId] ?? 0) + 1) {
        ready.push(q.shift()!);
      }
    }
    if (!ready.length) break;
    ready.sort((a, b) => compareHlc(a.hlc, b.hlc));
    for (const op of ready) {
      if (next.seen.has(op.opId)) {
        next.vector[op.peerId] = Math.max(next.vector[op.peerId] ?? 0, op.seq);
        progressed = true;
        continue;
      }
      applyOne(next, op);
      next.seen.add(op.opId);
      next.vector[op.peerId] = Math.max(next.vector[op.peerId] ?? 0, op.seq);
      next.hlc = receiveHlc(next.hlc, op.hlc, nowWall);
      progressed = true;
    }
  }

  return next;
}

function applyOne(state: ApplyState, op: Op): void {
  const key = entityKey(op.coleccion, op.entityId);
  const cur = state.entities.get(key);

  if (op.tipo === 'poner') {
    if (!cur || compareHlc(op.hlc, cur.hlc) > 0) {
      const variantes =
        cur && !cur.deleted && op.coleccion === 'nota' && cur.valor !== op.valor
          ? [...(cur.variantes || []), cur.valor]
          : cur?.variantes;
      state.entities.set(key, {
        entityId: op.entityId,
        coleccion: op.coleccion,
        valor: op.valor,
        ancla: op.ancla ?? cur?.ancla,
        hlc: op.hlc,
        deleted: false,
        variantes,
      });
    } else if (cur && op.coleccion === 'nota' && compareHlc(op.hlc, cur.hlc) < 0) {
      // Redacción perdedora: se conserva como variante.
      const variantes = [...(cur.variantes || [])];
      if (op.valor !== undefined) variantes.push(op.valor);
      state.entities.set(key, { ...cur, variantes });
    }
    return;
  }

  if (op.tipo === 'lapida') {
    if (!cur) {
      state.entities.set(key, {
        entityId: op.entityId,
        coleccion: op.coleccion,
        valor: null,
        ancla: op.ancla,
        hlc: op.hlc,
        deleted: true,
      });
      return;
    }
    if (compareHlc(op.hlc, cur.hlc) > 0) {
      state.entities.set(key, {
        ...cur,
        hlc: op.hlc,
        deleted: true,
      });
    }
    // Si la edición es posterior a la lápida, apply de `poner` ya la revivió.
    return;
  }

  if (op.tipo === 'campo') {
    if (!cur || cur.deleted) {
      if (!cur) {
        state.entities.set(key, {
          entityId: op.entityId,
          coleccion: op.coleccion,
          valor: op.campo ? { [op.campo]: op.valor } : op.valor,
          ancla: op.ancla,
          hlc: op.hlc,
          deleted: false,
        });
      } else if (compareHlc(op.hlc, cur.hlc) > 0) {
        // Edición tras ver lápida → revive.
        const base =
          cur.valor && typeof cur.valor === 'object' && !Array.isArray(cur.valor)
            ? { ...(cur.valor as Record<string, unknown>) }
            : {};
        if (op.campo) base[op.campo] = op.valor;
        state.entities.set(key, {
          ...cur,
          valor: op.campo ? base : op.valor,
          hlc: op.hlc,
          deleted: false,
          ancla: op.ancla ?? cur.ancla,
        });
      }
      return;
    }
    if (compareHlc(op.hlc, cur.hlc) >= 0) {
      const base =
        cur.valor && typeof cur.valor === 'object' && !Array.isArray(cur.valor)
          ? { ...(cur.valor as Record<string, unknown>) }
          : {};
      if (op.campo) base[op.campo] = op.valor;
      state.entities.set(key, {
        ...cur,
        valor: op.campo ? base : op.valor,
        hlc: op.hlc,
        ancla: op.ancla ?? cur.ancla,
      });
    }
    return;
  }

  if (op.tipo === 'orden') {
    if (!cur || compareHlc(op.hlc, cur.hlc) > 0) {
      state.entities.set(key, {
        entityId: op.entityId,
        coleccion: op.coleccion,
        valor: op.valor,
        ancla: op.ancla ?? cur?.ancla,
        hlc: op.hlc,
        deleted: false,
      });
    }
  }
}

/** Proyecta el estado del diario a las claves que la UI ya lee. */
export function projectEntities(entities: Map<string, EntityRow>): Projection {
  const anotaciones: ProjectedAnotacion[] = [];
  const temas: ProjectedTema[] = [];
  const favoritos: string[] = [];
  const lecturas: ProjectedLectura[] = [];
  const pasosByTema = new Map<string, ProjectedTemaStep[]>();

  for (const row of entities.values()) {
    if (row.deleted) continue;
    const kind = kindFromColeccion(row.coleccion);
    if (kind) {
      const v = (row.valor || {}) as Record<string, unknown>;
      const ancla = row.ancla;
      const documentId =
        (typeof v['documentId'] === 'string' && v['documentId']) ||
        ancla?.documentId ||
        '';
      const unitIndex =
        typeof v['unitIndex'] === 'number'
          ? (v['unitIndex'] as number)
          : ancla?.unitIndex ?? 0;
      const excerpt =
        (typeof v['excerpt'] === 'string' && v['excerpt']) ||
        ancla?.excerpt ||
        '';
      const unitLabel =
        (typeof v['unitLabel'] === 'string' && v['unitLabel']) ||
        ancla?.unitLabel;
      const nota =
        typeof v['nota'] === 'string'
          ? (v['nota'] as string)
          : typeof v['body'] === 'string'
            ? (v['body'] as string)
            : undefined;
      const createdAt =
        typeof v['createdAt'] === 'number' ? (v['createdAt'] as number) : row.hlc.wall;
      anotaciones.push({
        id: row.entityId,
        documentId,
        unitIndex,
        unitLabel,
        excerpt,
        nota,
        kind,
        createdAt,
        updatedAt: new Date(row.hlc.wall).toISOString(),
      });
      continue;
    }

    if (row.coleccion === 'tema') {
      const v = (row.valor || {}) as Record<string, unknown>;
      temas.push({
        id: row.entityId,
        title: typeof v['title'] === 'string' ? (v['title'] as string) : '',
        description:
          typeof v['description'] === 'string' || v['description'] === null
            ? (v['description'] as string | null)
            : null,
        coverImageKey:
          typeof v['coverImageKey'] === 'string' || v['coverImageKey'] === null
            ? (v['coverImageKey'] as string | null)
            : null,
        visibility:
          typeof v['visibility'] === 'string' ? (v['visibility'] as string) : 'private',
        reviewStatus:
          typeof v['reviewStatus'] === 'string'
            ? (v['reviewStatus'] as string)
            : 'none',
        steps: [],
        createdAt:
          typeof v['createdAt'] === 'string'
            ? (v['createdAt'] as string)
            : new Date(row.hlc.wall).toISOString(),
        updatedAt: new Date(row.hlc.wall).toISOString(),
      });
      continue;
    }

    if (row.coleccion === 'paso') {
      const v = (row.valor || {}) as Record<string, unknown>;
      const temaId = typeof v['temaId'] === 'string' ? (v['temaId'] as string) : '';
      if (!temaId) continue;
      const step: ProjectedTemaStep = {
        id: row.entityId,
        order: typeof v['order'] === 'number' ? (v['order'] as number) : 0,
        documentId:
          typeof v['documentId'] === 'string' ? (v['documentId'] as string) : '',
        unitIndex: typeof v['unitIndex'] === 'number' ? (v['unitIndex'] as number) : 0,
        unitLabel:
          typeof v['unitLabel'] === 'string' || v['unitLabel'] === null
            ? (v['unitLabel'] as string | null)
            : null,
        userComment:
          typeof v['userComment'] === 'string' || v['userComment'] === null
            ? (v['userComment'] as string | null)
            : null,
        updatedAt: new Date(row.hlc.wall).toISOString(),
      };
      const list = pasosByTema.get(temaId) || [];
      list.push(step);
      pasosByTema.set(temaId, list);
      continue;
    }

    if (row.coleccion === 'favorito') {
      const docId =
        typeof row.valor === 'string'
          ? row.valor
          : row.entityId;
      if (docId && !favoritos.includes(docId)) favoritos.push(docId);
      continue;
    }

    if (row.coleccion === 'lectura') {
      const v = (row.valor || {}) as Record<string, unknown>;
      lecturas.push({
        documentId: row.entityId,
        title: typeof v['title'] === 'string' ? (v['title'] as string) : '',
        unitIndex: typeof v['unitIndex'] === 'number' ? (v['unitIndex'] as number) : 0,
        unitCount: typeof v['unitCount'] === 'number' ? (v['unitCount'] as number) : 0,
        label: typeof v['label'] === 'string' ? (v['label'] as string) : undefined,
        updatedAt: new Date(row.hlc.wall).toISOString(),
      });
    }
  }

  for (const tema of temas) {
    const steps = (pasosByTema.get(tema.id) || []).slice();
    steps.sort((a, b) => a.order - b.order);
    tema.steps = steps;
  }

  anotaciones.sort((a, b) => b.createdAt - a.createdAt);
  return { anotaciones, temas, favoritos, lecturas };
}

export function buildDvDelta(
  ops: Op[],
  groupId: string,
  exportedAt: string = new Date().toISOString(),
): DvDeltaFile {
  return {
    format: DVDELTA_FORMAT,
    version: DVDELTA_VERSION,
    exportedAt,
    groupId,
    vector: vectorFromOps(ops),
    ops: ops.slice(),
  };
}

export function serializeDvDelta(delta: DvDeltaFile): string {
  return JSON.stringify(delta, null, 2);
}

export function parseDvDelta(raw: unknown): DvDeltaFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El archivo no tiene el formato .dvdelta.');
  }
  const d = raw as Partial<DvDeltaFile>;
  if (d.format !== DVDELTA_FORMAT) {
    throw new Error('El archivo no es un diario .dvdelta de Documentos Vaticanos.');
  }
  if (d.version !== DVDELTA_VERSION) {
    throw new Error(`Versión de .dvdelta no admitida (v${String(d.version)}).`);
  }
  if (typeof d.groupId !== 'string' || !d.groupId) {
    throw new Error('El .dvdelta no indica groupId.');
  }
  if (!Array.isArray(d.ops)) {
    throw new Error('El .dvdelta no contiene operaciones.');
  }
  // El delta no debe arrastrar sesión ni voz del narrador.
  const forbidden = ['auth.accessToken', 'auth.refreshToken', 'xaiApiKey', 'voiceId'];
  const blob = JSON.stringify(d);
  for (const key of forbidden) {
    if (blob.includes(`"${key}"`)) {
      throw new Error(`El .dvdelta contiene datos de aparato prohibidos (${key}).`);
    }
  }
  return {
    format: DVDELTA_FORMAT,
    version: DVDELTA_VERSION,
    exportedAt:
      typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    groupId: d.groupId,
    vector:
      d.vector && typeof d.vector === 'object' && !Array.isArray(d.vector)
        ? (d.vector as VectorClock)
        : vectorFromOps(d.ops as Op[]),
    ops: d.ops as Op[],
  };
}

export function dvDeltaHasSecrets(delta: DvDeltaFile): boolean {
  const blob = serializeDvDelta(delta);
  return (
    blob.includes('auth.accessToken') ||
    blob.includes('auth.refreshToken') ||
    blob.includes('xaiApiKey') ||
    /"voiceId"\s*:/.test(blob)
  );
}

/** Migración one-shot de claves LS actuales → ops del par local. */
export function migrateLocalKeysToOps(
  meta: JournalMeta,
  input: {
    anotaciones?: Array<Record<string, unknown>>;
    temas?: Array<Record<string, unknown>>;
    favoritos?: string[];
    lastRead?: Record<string, unknown> | null;
  },
  nowWall: number = Date.now(),
): { ops: Op[]; meta: JournalMeta } {
  let cur = meta;
  const ops: Op[] = [];

  const push = (
    partial: Omit<Op, 'opId' | 'peerId' | 'seq' | 'hlc' | 'groupId'>,
    wallHint?: number,
  ) => {
    const wall = wallHint && Number.isFinite(wallHint) ? wallHint : nowWall;
    const emitted = emitOp({ meta: cur, nowWall: wall }, partial);
    ops.push(emitted.op);
    cur = emitted.meta;
  };

  for (const a of input.anotaciones || []) {
    if (!a || typeof a['id'] !== 'string') continue;
    const kind = a['kind'];
    if (kind !== 'subrayado' && kind !== 'nota' && kind !== 'marcador') continue;
    const wall =
      Date.parse(typeof a['updatedAt'] === 'string' ? (a['updatedAt'] as string) : '') ||
      (typeof a['createdAt'] === 'number' ? (a['createdAt'] as number) : nowWall);
    push(
      {
        coleccion: coleccionFromAnotacionKind(kind),
        entityId: a['id'] as string,
        tipo: 'poner',
        valor: {
          documentId: a['documentId'],
          unitIndex: a['unitIndex'],
          unitLabel: a['unitLabel'],
          excerpt: a['excerpt'] ?? '',
          nota: a['nota'],
          kind,
          createdAt: a['createdAt'],
        },
        ancla: {
          documentId: String(a['documentId'] || ''),
          unitIndex: typeof a['unitIndex'] === 'number' ? (a['unitIndex'] as number) : 0,
          unitLabel:
            typeof a['unitLabel'] === 'string' ? (a['unitLabel'] as string) : undefined,
          excerpt: typeof a['excerpt'] === 'string' ? (a['excerpt'] as string) : '',
        },
      },
      wall,
    );
  }

  for (const t of input.temas || []) {
    if (!t || typeof t['id'] !== 'string') continue;
    const wall =
      Date.parse(typeof t['updatedAt'] === 'string' ? (t['updatedAt'] as string) : '') ||
      nowWall;
    push(
      {
        coleccion: 'tema',
        entityId: t['id'] as string,
        tipo: 'poner',
        valor: {
          title: t['title'],
          description: t['description'] ?? null,
          coverImageKey: t['coverImageKey'] ?? null,
          visibility: t['visibility'] ?? 'private',
          reviewStatus: t['reviewStatus'] ?? 'none',
          createdAt: t['createdAt'],
        },
      },
      wall,
    );
    const steps = Array.isArray(t['steps']) ? (t['steps'] as Array<Record<string, unknown>>) : [];
    steps.forEach((s, i) => {
      const stepId =
        typeof s['id'] === 'string' && s['id']
          ? (s['id'] as string)
          : `${t['id'] as string}:paso:${i}`;
      const sWall =
        Date.parse(typeof s['updatedAt'] === 'string' ? (s['updatedAt'] as string) : '') ||
        wall;
      push(
        {
          coleccion: 'paso',
          entityId: stepId,
          tipo: 'poner',
          valor: {
            temaId: t['id'],
            order: typeof s['order'] === 'number' ? s['order'] : i,
            documentId: s['documentId'],
            unitIndex: s['unitIndex'],
            unitLabel: s['unitLabel'] ?? null,
            userComment: s['userComment'] ?? null,
          },
        },
        sWall,
      );
    });
  }

  for (const docId of input.favoritos || []) {
    if (typeof docId !== 'string' || !docId) continue;
    push({
      coleccion: 'favorito',
      entityId: docId,
      tipo: 'poner',
      valor: docId,
    });
  }

  const lr = input.lastRead;
  if (lr && typeof lr['documentId'] === 'string') {
    const wall =
      Date.parse(typeof lr['updatedAt'] === 'string' ? (lr['updatedAt'] as string) : '') ||
      nowWall;
    push(
      {
        coleccion: 'lectura',
        entityId: lr['documentId'] as string,
        tipo: 'poner',
        valor: {
          title: lr['title'],
          unitIndex: lr['unitIndex'],
          unitCount: lr['unitCount'],
          label: lr['label'],
        },
      },
      wall,
    );
  }

  return { ops, meta: cur };
}

/**
 * Importar copia v3: une por id. Lo que falta en el archivo NO es lápida.
 * Gana el updatedAt mayor; si empatan, conserva el local.
 */
export function mergeBackupById<T extends { id?: unknown; updatedAt?: unknown }>(
  local: T[],
  incoming: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const item of local) {
    if (item && typeof item.id === 'string') byId.set(item.id, item);
  }
  for (const item of incoming) {
    if (!item || typeof item.id !== 'string') continue;
    const mine = byId.get(item.id);
    if (!mine) {
      byId.set(item.id, item);
      continue;
    }
    const inTime = Date.parse(String(item.updatedAt || '')) || 0;
    const locTime = Date.parse(String(mine.updatedAt || '')) || 0;
    if (inTime > locTime) byId.set(item.id, item);
  }
  return [...byId.values()];
}

export const ANOTACIONES_KEY = 'dv_anotaciones_v1';
export const TEMAS_KEY = 'themes.user';
export const FAVS_KEY = 'dv.favs';
export const LAST_READ_KEY = 'dv.lastRead';

/** Escribe la proyección en un store tipo localStorage (sin borrar ausentes del diario). */
export function writeProjectionToStore(
  store: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  },
  projection: Projection,
): void {
  store.setItem(ANOTACIONES_KEY, JSON.stringify(projection.anotaciones));
  store.setItem(TEMAS_KEY, JSON.stringify(projection.temas));
  store.setItem(FAVS_KEY, JSON.stringify(projection.favoritos));
  // Una ranura legacy: la lectura con reloj mayor.
  if (projection.lecturas.length) {
    const best = projection.lecturas.slice().sort((a, b) => {
      const at = Date.parse(a.updatedAt) || 0;
      const bt = Date.parse(b.updatedAt) || 0;
      return bt - at;
    })[0];
    store.setItem(LAST_READ_KEY, JSON.stringify(best));
  }
}
