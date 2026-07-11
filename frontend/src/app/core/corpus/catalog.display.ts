/**
 * Presentation metadata for the Biblioteca view (design handoff).
 * Corpus packs remain the source of truth for text; this enriches the catalog UI.
 */

export interface CatalogDisplay {
  tipo: string;
  autor?: string;
  anio?: number;
  subtitulo?: string;
}

const BY_ID: Record<string, CatalogDisplay> = {
  'cic-es': {
    tipo: 'Catecismo',
    autor: 'Juan Pablo II',
    anio: 1997,
    subtitulo: 'Carta apostólica « Laetamur Magnopere »',
  },
  'bible-pueblo-de-dios-es': {
    tipo: 'Sagrada Escritura',
    autor: 'Pueblo de Dios',
    anio: 1980,
    subtitulo: 'Biblia (edición en español)',
  },
  'dv-es': {
    tipo: 'Concilio Vaticano II',
    autor: 'Pablo VI',
    anio: 1965,
    subtitulo: 'Constitución dogmática sobre la divina revelación',
  },
  'lg-es': {
    tipo: 'Concilio Vaticano II',
    autor: 'Pablo VI',
    anio: 1964,
    subtitulo: 'Constitución dogmática sobre la Iglesia',
  },
  'gs-es': {
    tipo: 'Concilio Vaticano II',
    autor: 'Pablo VI',
    anio: 1965,
    subtitulo: 'Constitución pastoral sobre la Iglesia en el mundo actual',
  },
  'sc-es': {
    tipo: 'Concilio Vaticano II',
    autor: 'Pablo VI',
    anio: 1963,
    subtitulo: 'Constitución sobre la sagrada liturgia',
  },
  'ur-es': {
    tipo: 'Concilio Vaticano II',
    autor: 'Pablo VI',
    anio: 1964,
    subtitulo: 'Decreto sobre el ecumenismo',
  },
  'aa-es': {
    tipo: 'Concilio Vaticano II',
    autor: 'Pablo VI',
    anio: 1965,
    subtitulo: 'Decreto sobre el apostolado de los laicos',
  },
};

const KIND_FALLBACK: Record<string, string> = {
  catechism: 'Catecismo',
  bible: 'Sagrada Escritura',
  magisterium: 'Magisterio',
};

export function catalogDisplayFor(
  id: string | undefined,
  kind?: string
): CatalogDisplay {
  if (id && BY_ID[id]) {
    return BY_ID[id];
  }
  return {
    tipo: (kind && KIND_FALLBACK[kind]) || kind || 'Documento',
  };
}

/** Line: "Tipo · Autor · Año" as in the design prototype. */
export function catalogMetaLine(display: CatalogDisplay): string {
  const parts = [display.tipo];
  if (display.autor) parts.push(display.autor);
  if (display.anio) parts.push(String(display.anio));
  return parts.join(' · ');
}
