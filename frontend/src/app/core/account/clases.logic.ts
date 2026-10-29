/**
 * Clase en el aparato: plan de lectura, archivo y avance.
 * Privada o pública: el mismo JSON. El texto del corpus no entra.
 * Abrir una copia guardada no llama a la API.
 */

import {
  documentIdKey,
  parseDocumentId,
  parseUnitIndex,
} from '../reading/cite';

export const CLASES_STORAGE_KEY = 'dv.clases.v1';
export const PROGRESO_STORAGE_KEY = 'dv.clase.progreso.v1';
export const LEGACY_PROGRESO_PREFIX = 'dv.lesson.';

export const MAX_PASOS = 40;
export const MAX_ARCHIVO_BYTES = 256 * 1024;

const TITULO_MAX = 200;
const DESCRIPCION_MAX = 4000;
const ROTULO_MAX = 200;
const NOTA_MAX = 4000;
const REVISION_MAX = 1_000_000;
const PASO_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/;
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const CLASE_KEYS = [
  'id',
  'audiencia',
  'titulo',
  'descripcion',
  'revision',
  'pasos',
  'actualizadaEn',
] as const;

const PASO_KEYS = ['id', 'documentId', 'unitIndex', 'rotulo', 'nota'] as const;

export type Audiencia = 'privada' | 'publica';
export type PapelClase = 'maestro' | 'alumno';

export interface PasoClase {
  id: string;
  documentId: string;
  unitIndex: number;
  rotulo?: string;
  nota?: string;
}

export interface ClaseLocal {
  id: string;
  audiencia: Audiencia;
  titulo: string;
  descripcion?: string;
  revision: number;
  pasos: PasoClase[];
  actualizadaEn: string;
}

export interface ClaseEnAparato {
  clase: ClaseLocal;
  papel: PapelClase;
  listaParaAlumnos: boolean;
  pendiente?: ClaseLocal;
}

export type CodigoClase =
  | 'titulo'
  | 'paso'
  | 'tope'
  | 'vacia'
  | 'alumno'
  | 'orden'
  | 'nolista'
  | 'invalida'
  | 'grande'
  | 'propia'
  | 'antigua'
  | 'misma'
  | 'nueva'
  | 'pendiente';

export interface CuerpoClase {
  titulo: string;
  descripcion?: string;
  pasos: PasoClase[];
}

export interface PasoNuevo {
  documentId: string;
  unitIndex: number;
  rotulo?: string;
  nota?: string;
}

type Ok<T> = { ok: true } & T;
type Err = { ok: false; codigo: CodigoClase };

function soloClaves(obj: object, allowed: readonly string[]): boolean {
  return Object.keys(obj).every((k) => allowed.includes(k));
}

interface CrudoPaso {
  id?: unknown;
  documentId?: unknown;
  unitIndex?: unknown;
  rotulo?: unknown;
  nota?: unknown;
}

interface CrudoClase {
  id?: unknown;
  audiencia?: unknown;
  titulo?: unknown;
  descripcion?: unknown;
  revision?: unknown;
  pasos?: unknown;
  actualizadaEn?: unknown;
}

interface CrudoEntrada {
  clase?: unknown;
  papel?: unknown;
  listaParaAlumnos?: unknown;
  pendiente?: unknown;
}

function texto(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length > max) return null;
  return t;
}

function clonPaso(p: PasoClase): PasoClase {
  const out: PasoClase = {
    id: p.id,
    documentId: p.documentId,
    unitIndex: p.unitIndex,
  };
  if (p.rotulo) out.rotulo = p.rotulo;
  if (p.nota) out.nota = p.nota;
  return out;
}

export function clonClase(c: ClaseLocal): ClaseLocal {
  const out: ClaseLocal = {
    id: c.id,
    audiencia: c.audiencia,
    titulo: c.titulo,
    revision: c.revision,
    pasos: c.pasos.map(clonPaso),
    actualizadaEn: c.actualizadaEn,
  };
  if (c.descripcion) out.descripcion = c.descripcion;
  return out;
}

export function clonEntrada(e: ClaseEnAparato): ClaseEnAparato {
  const out: ClaseEnAparato = {
    clase: clonClase(e.clase),
    papel: e.papel,
    listaParaAlumnos: e.papel === 'maestro' && e.listaParaAlumnos,
  };
  if (e.pendiente) out.pendiente = clonClase(e.pendiente);
  return out;
}

function pasoDesde(raw: unknown): PasoClase | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as CrudoPaso;
  if (!soloClaves(o, PASO_KEYS)) return null;
  if (typeof o.id !== 'string' || !PASO_ID.test(o.id)) return null;
  if (typeof o.documentId !== 'string') return null;
  const doc = parseDocumentId(o.documentId);
  if (!doc) return null;
  const unit = parseUnitIndex(
    typeof o.unitIndex === 'number' ? o.unitIndex : null,
  );
  if (unit == null) return null;
  const paso: PasoClase = {
    id: o.id,
    documentId: documentIdKey(doc),
    unitIndex: unit,
  };
  if (o.rotulo !== undefined) {
    const rotulo = texto(o.rotulo, ROTULO_MAX);
    if (rotulo == null) return null;
    if (rotulo) paso.rotulo = rotulo;
  }
  if (o.nota !== undefined) {
    const nota = texto(o.nota, NOTA_MAX);
    if (nota == null) return null;
    if (nota) paso.nota = nota;
  }
  return paso;
}

/** Normaliza una clase ya validada en forma (privada o pública). */
export function claseDesde(raw: unknown): ClaseLocal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as CrudoClase;
  if (!soloClaves(o, CLASE_KEYS)) return null;
  if (o.audiencia !== 'privada' && o.audiencia !== 'publica') return null;
  if (typeof o.id !== 'string' || !PASO_ID.test(o.id)) return null;
  const titulo = texto(o.titulo, TITULO_MAX);
  if (!titulo) return null;
  if (typeof o.revision !== 'number' || !Number.isInteger(o.revision)) return null;
  if (o.revision < 1 || o.revision > REVISION_MAX) return null;
  if (typeof o.actualizadaEn !== 'string' || !ISO_Z.test(o.actualizadaEn)) {
    return null;
  }
  if (!Array.isArray(o.pasos) || o.pasos.length > MAX_PASOS) return null;
  const pasos: PasoClase[] = [];
  const ids = new Set<string>();
  for (const p of o.pasos) {
    const paso = pasoDesde(p);
    if (!paso || ids.has(paso.id)) return null;
    ids.add(paso.id);
    pasos.push(paso);
  }
  const clase: ClaseLocal = {
    id: o.id,
    audiencia: o.audiencia,
    titulo,
    revision: o.revision,
    pasos,
    actualizadaEn: o.actualizadaEn,
  };
  if (o.descripcion !== undefined) {
    const descripcion = texto(o.descripcion, DESCRIPCION_MAX);
    if (descripcion == null) return null;
    if (descripcion) clase.descripcion = descripcion;
  }
  return clase;
}

/** @deprecated Preferir claseDesde; solo acepta audiencia privada. */
export function clasePrivadaDesde(raw: unknown): ClaseLocal | null {
  const clase = claseDesde(raw);
  if (!clase || clase.audiencia !== 'privada') return null;
  return clase;
}

export function esPublica(clase: { audiencia?: unknown } | null | undefined): boolean {
  return clase?.audiencia === 'publica';
}

export type ParseoArchivo =
  | { ok: true; clase: ClaseLocal }
  | { ok: false; codigo: 'invalida' | 'grande' };

export function parsearArchivo(raw: string): ParseoArchivo {
  if (typeof raw !== 'string' || raw.length > MAX_ARCHIVO_BYTES) {
    return { ok: false, codigo: 'grande' };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, codigo: 'invalida' };
  }
  const clase = claseDesde(data);
  if (!clase) return { ok: false, codigo: 'invalida' };
  return { ok: true, clase };
}

export function serializarClase(clase: ClaseLocal): string {
  const cuerpo: ClaseLocal = {
    id: clase.id,
    audiencia: clase.audiencia,
    titulo: clase.titulo,
    revision: clase.revision,
    pasos: clase.pasos.map(clonPaso),
    actualizadaEn: clase.actualizadaEn,
  };
  if (clase.descripcion) cuerpo.descripcion = clase.descripcion;
  return JSON.stringify(cuerpo, null, 2);
}

export function nombreArchivo(clase: ClaseLocal): string {
  const base = clase.titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'clase'}.dv-clase.json`;
}

function firma(c: CuerpoClase): string {
  return JSON.stringify({
    titulo: c.titulo,
    descripcion: c.descripcion || '',
    pasos: c.pasos.map((p) => ({
      id: p.id,
      documentId: p.documentId,
      unitIndex: p.unitIndex,
      rotulo: p.rotulo || '',
      nota: p.nota || '',
    })),
  });
}

function firmaDe(c: ClaseLocal): string {
  return firma({
    titulo: c.titulo,
    descripcion: c.descripcion,
    pasos: c.pasos,
  });
}

function conCuerpo(
  entry: ClaseEnAparato,
  cuerpo: CuerpoClase,
  now: string,
): ClaseEnAparato {
  const next = clonEntrada(entry);
  const igual = firmaDe(next.clase) === firma(cuerpo);
  next.clase.titulo = cuerpo.titulo;
  if (cuerpo.descripcion) next.clase.descripcion = cuerpo.descripcion;
  else delete next.clase.descripcion;
  next.clase.pasos = cuerpo.pasos.map(clonPaso);
  if (!igual) {
    next.clase.revision += 1;
    next.clase.actualizadaEn = now;
    next.listaParaAlumnos = false;
  }
  return next;
}

export function puedeArmarClase(auth: {
  isLoggedIn: boolean;
  isTeacher: boolean;
}): boolean {
  return !auth.isLoggedIn || auth.isTeacher;
}

export function crearMaestro(
  tituloRaw: string,
  now: string,
  id: string,
  descripcionRaw?: string,
): Ok<{ entry: ClaseEnAparato }> | Err {
  const titulo = texto(tituloRaw, TITULO_MAX);
  if (!titulo || !PASO_ID.test(id)) return { ok: false, codigo: 'titulo' };
  const clase: ClaseLocal = {
    id,
    audiencia: 'privada',
    titulo,
    revision: 1,
    pasos: [],
    actualizadaEn: now,
  };
  if (descripcionRaw !== undefined) {
    const descripcion = texto(descripcionRaw, DESCRIPCION_MAX);
    if (descripcion == null) return { ok: false, codigo: 'titulo' };
    if (descripcion) clase.descripcion = descripcion;
  }
  return {
    ok: true,
    entry: { clase, papel: 'maestro', listaParaAlumnos: false },
  };
}

export function guardarMeta(
  entry: ClaseEnAparato,
  tituloRaw: string,
  descripcionRaw: string,
  now: string,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  const titulo = texto(tituloRaw, TITULO_MAX);
  if (!titulo) return { ok: false, codigo: 'titulo' };
  const descripcion = texto(descripcionRaw, DESCRIPCION_MAX);
  if (descripcion == null) return { ok: false, codigo: 'titulo' };
  return {
    ok: true,
    entry: conCuerpo(
      entry,
      {
        titulo,
        descripcion: descripcion || undefined,
        pasos: entry.clase.pasos,
      },
      now,
    ),
  };
}

export function pasoNuevo(
  input: PasoNuevo,
  pasoId: string,
): Ok<{ paso: PasoClase }> | Err {
  if (!PASO_ID.test(pasoId)) return { ok: false, codigo: 'paso' };
  const doc = parseDocumentId(input.documentId);
  const unit = parseUnitIndex(input.unitIndex);
  if (!doc || unit == null) return { ok: false, codigo: 'paso' };
  const paso: PasoClase = {
    id: pasoId,
    documentId: documentIdKey(doc),
    unitIndex: unit,
  };
  if (input.rotulo !== undefined) {
    const rotulo = texto(input.rotulo, ROTULO_MAX);
    if (rotulo == null) return { ok: false, codigo: 'paso' };
    if (rotulo) paso.rotulo = rotulo;
  }
  if (input.nota !== undefined) {
    const nota = texto(input.nota, NOTA_MAX);
    if (nota == null) return { ok: false, codigo: 'paso' };
    if (nota) paso.nota = nota;
  }
  return { ok: true, paso };
}

export function agregarPaso(
  entry: ClaseEnAparato,
  input: PasoNuevo,
  now: string,
  pasoId: string,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  if (entry.clase.pasos.length >= MAX_PASOS) return { ok: false, codigo: 'tope' };
  const hecho = pasoNuevo(input, pasoId);
  if (!hecho.ok) return hecho;
  if (entry.clase.pasos.some((p) => p.id === hecho.paso.id)) {
    return { ok: false, codigo: 'paso' };
  }
  return {
    ok: true,
    entry: conCuerpo(
      entry,
      {
        titulo: entry.clase.titulo,
        descripcion: entry.clase.descripcion,
        pasos: [...entry.clase.pasos, hecho.paso],
      },
      now,
    ),
  };
}

export function quitarPaso(
  entry: ClaseEnAparato,
  pasoId: string,
  now: string,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  if (!entry.clase.pasos.some((p) => p.id === pasoId)) {
    return { ok: false, codigo: 'paso' };
  }
  return {
    ok: true,
    entry: conCuerpo(
      entry,
      {
        titulo: entry.clase.titulo,
        descripcion: entry.clase.descripcion,
        pasos: entry.clase.pasos.filter((p) => p.id !== pasoId),
      },
      now,
    ),
  };
}

export function reordenar(
  entry: ClaseEnAparato,
  ids: string[],
  now: string,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  if (ids.length !== entry.clase.pasos.length) {
    return { ok: false, codigo: 'orden' };
  }
  const byId = new Map(entry.clase.pasos.map((p) => [p.id, p]));
  const pasos: PasoClase[] = [];
  const vistos = new Set<string>();
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || vistos.has(id)) return { ok: false, codigo: 'orden' };
    vistos.add(id);
    pasos.push(p);
  }
  return {
    ok: true,
    entry: conCuerpo(
      entry,
      {
        titulo: entry.clase.titulo,
        descripcion: entry.clase.descripcion,
        pasos,
      },
      now,
    ),
  };
}

export function marcarLista(
  entry: ClaseEnAparato,
  lista: boolean,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  if (lista && entry.clase.pasos.length === 0) {
    return { ok: false, codigo: 'vacia' };
  }
  const next = clonEntrada(entry);
  next.listaParaAlumnos = lista;
  return { ok: true, entry: next };
}

/**
 * Publicar: misma clase con audiencia pública. Sube la revisión una vez.
 * «Lista para mis alumnos» no la vuelve pública.
 */
export function publicar(
  entry: ClaseEnAparato,
  now: string,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  if (entry.clase.pasos.length === 0) return { ok: false, codigo: 'vacia' };
  if (entry.clase.audiencia === 'publica') {
    return { ok: true, entry: clonEntrada(entry) };
  }
  const next = clonEntrada(entry);
  next.clase.audiencia = 'publica';
  next.clase.revision += 1;
  next.clase.actualizadaEn = now;
  return { ok: true, entry: next };
}

export function archivoExportable(
  entry: ClaseEnAparato,
): Ok<{ json: string; nombre: string }> | Err {
  if (entry.clase.pasos.length === 0) return { ok: false, codigo: 'vacia' };
  if (entry.clase.audiencia === 'publica') {
    return {
      ok: true,
      json: serializarClase(entry.clase),
      nombre: nombreArchivo(entry.clase),
    };
  }
  if (entry.papel !== 'maestro') return { ok: false, codigo: 'alumno' };
  if (!entry.listaParaAlumnos) return { ok: false, codigo: 'nolista' };
  return {
    ok: true,
    json: serializarClase(entry.clase),
    nombre: nombreArchivo(entry.clase),
  };
}

export type ResultadoImportacion =
  | { ok: true; codigo: 'nueva' | 'pendiente' | 'misma'; entries: ClaseEnAparato[]; id: string }
  | { ok: false; codigo: 'propia' | 'antigua' | 'invalida' | 'grande'; entries: ClaseEnAparato[] };

export function incorporarArchivo(
  entries: ClaseEnAparato[],
  raw: string,
): ResultadoImportacion {
  const parsed = parsearArchivo(raw);
  if (!parsed.ok) {
    return { ok: false, codigo: parsed.codigo, entries };
  }
  const file = parsed.clase;
  const idx = entries.findIndex((e) => e.clase.id === file.id);
  if (idx < 0) {
    const entry: ClaseEnAparato = {
      clase: clonClase(file),
      papel: 'alumno',
      listaParaAlumnos: false,
    };
    return {
      ok: true,
      codigo: 'nueva',
      id: file.id,
      entries: [...entries.map(clonEntrada), entry],
    };
  }
  const actual = entries[idx];
  if (actual.papel === 'maestro') {
    return { ok: false, codigo: 'propia', entries };
  }
  if (file.revision === actual.clase.revision) {
    return { ok: true, codigo: 'misma', id: file.id, entries };
  }
  if (file.revision < actual.clase.revision) {
    return { ok: false, codigo: 'antigua', entries };
  }
  if (actual.pendiente && actual.pendiente.revision >= file.revision) {
    return { ok: true, codigo: 'pendiente', id: file.id, entries };
  }
  const next = entries.map(clonEntrada);
  next[idx] = { ...next[idx], pendiente: clonClase(file) };
  return { ok: true, codigo: 'pendiente', id: file.id, entries: next };
}

export function aceptarPendiente(
  entry: ClaseEnAparato,
): Ok<{ entry: ClaseEnAparato }> | Err {
  if (entry.papel !== 'alumno' || !entry.pendiente) {
    return { ok: false, codigo: 'alumno' };
  }
  const next = clonEntrada(entry);
  next.clase = clonClase(entry.pendiente);
  delete next.pendiente;
  next.listaParaAlumnos = false;
  return { ok: true, entry: next };
}

export function descartarPendiente(entry: ClaseEnAparato): ClaseEnAparato {
  const next = clonEntrada(entry);
  delete next.pendiente;
  return next;
}

export function quitarEntrada(
  entries: ClaseEnAparato[],
  id: string,
): ClaseEnAparato[] {
  return entries.filter((e) => e.clase.id !== id).map(clonEntrada);
}

export function entradaDesde(raw: unknown): ClaseEnAparato | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as CrudoEntrada;
  const clase = claseDesde(o.clase);
  if (!clase) return null;
  if (o.papel !== 'maestro' && o.papel !== 'alumno') return null;
  const entry: ClaseEnAparato = {
    clase,
    papel: o.papel,
    listaParaAlumnos: o.papel === 'maestro' && o.listaParaAlumnos === true,
  };
  if (o.pendiente !== undefined && o.papel === 'alumno') {
    const pendiente = claseDesde(o.pendiente);
    if (!pendiente || pendiente.id !== clase.id) return null;
    if (pendiente.revision > clase.revision) entry.pendiente = pendiente;
  }
  return entry;
}

export type MapaProgreso = Record<string, Record<string, true>>;

export function progresoDesdeIndice(
  raw: unknown,
  pasos: { id: string }[],
): Record<string, true> {
  if (!Array.isArray(raw)) return {};
  const out: Record<string, true> = {};
  for (const n of raw) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) continue;
    const paso = pasos[n];
    if (paso) out[paso.id] = true;
  }
  return out;
}

export function sanearProgreso(raw: unknown): MapaProgreso {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: MapaProgreso = {};
  for (const [claseId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const pasos: Record<string, true> = {};
    for (const [pasoId, flag] of Object.entries(value as Record<string, unknown>)) {
      if (flag === true && PASO_ID.test(pasoId)) pasos[pasoId] = true;
    }
    if (PASO_ID.test(claseId)) out[claseId] = pasos;
  }
  return out;
}

/** Lee el índice viejo una sola vez: si ya hay mapa para la clase, no lo toca. */
export function migrarProgresoLegado(
  mapa: MapaProgreso,
  claseId: string,
  pasos: { id: string }[],
  legacy: unknown | undefined,
): { mapa: MapaProgreso; consumirLegacy: boolean } {
  if (Object.prototype.hasOwnProperty.call(mapa, claseId)) {
    return { mapa, consumirLegacy: false };
  }
  if (legacy === undefined) return { mapa, consumirLegacy: false };
  return {
    mapa: { ...mapa, [claseId]: progresoDesdeIndice(legacy, pasos) },
    consumirLegacy: true,
  };
}

export function leidos(
  pasos: { id: string }[],
  hechos: Record<string, true> | undefined,
): number {
  if (!hechos) return 0;
  return pasos.filter((p) => hechos[p.id] === true).length;
}

export function indiceSiguiente(
  pasos: { id: string }[],
  hechos: Record<string, true> | undefined,
): number {
  const i = pasos.findIndex((p) => !hechos || hechos[p.id] !== true);
  return i < 0 ? 0 : i;
}

export function marcarLeido(
  mapa: MapaProgreso,
  claseId: string,
  pasoId: string,
): MapaProgreso {
  const prev = mapa[claseId] || {};
  if (prev[pasoId] === true) return mapa;
  return { ...mapa, [claseId]: { ...prev, [pasoId]: true } };
}

export function olvidarProgreso(mapa: MapaProgreso, claseId: string): MapaProgreso {
  if (!Object.prototype.hasOwnProperty.call(mapa, claseId)) return mapa;
  const next = { ...mapa };
  delete next[claseId];
  return next;
}
