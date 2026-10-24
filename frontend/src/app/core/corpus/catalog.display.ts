/**
 * Presentation metadata for the Biblioteca view (design handoff).
 * Corpus packs remain the source of truth for text; this enriches the catalog UI.
 */

export interface CatalogDisplay {
  tipo: string;
  autor?: string;
  anio?: number;
  subtitulo?: string;
  /** Compilador de la colección digital (p. ej. P. A. Cedano). */
  compilador?: string;
  /** Nota de procedencia / edición. */
  fuenteNota?: string;
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
  'carta-diogneto-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Anónimo (s. II)',
    subtitulo: 'Apología · Padres apostólicos',
    compilador: 'A. Cedano',
    fuenteNota: 'Compilación P. A. Cedano · Iglesia Viva / Ruiz Bueno',
  },
  'cirilo-jerusalen-catequesis-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Cirilo de Jerusalén',
    subtitulo: 'Procatequesis y catequesis mistagógicas',
    compilador: 'A. Cedano',
    fuenteNota: 'Compilación P. A. Cedano · PG 33',
  },
  'clemente-alejandria-pedagogo-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Clemente de Alejandría',
    subtitulo: 'El Pedagogo',
    compilador: 'A. Cedano',
    fuenteNota: 'Compilación P. A. Cedano · Biblioteca Clásica Gredos',
  },
  'cipriano-cartas-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Cipriano de Cartago',
    subtitulo: 'Epistolario',
    compilador: 'A. Cedano',
    fuenteNota: 'Compilación P. A. Cedano · Biblioteca Clásica Gredos',
  },
  'agustin-01-primeros-escritos-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Introducción y primeros escritos',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 1)',
  },
  'agustin-02-confesiones-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Confesiones',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 2)',
  },
  'agustin-03-obras-filosoficas-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Obras filosóficas',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 3)',
  },
  'agustin-04-obras-apologeticas-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Obras apologéticas',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 4)',
  },
  'gregorio-nisa-gran-catequesis-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Gregorio de Nisa',
    subtitulo: 'Gran Catequesis (Oratio catechetica magna)',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · OCR desde PDF escaneado (Drive)',
  },
  'agustin-05-de-trinitate-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'De Trinitate',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 5)',
  },
  'agustin-06-gracia-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Tratados sobre la gracia I',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 6)',
  },
  'agustin-07-sermones-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sermones I',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 7)',
  },
  'agustin-08-cartas-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Cartas I',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 8)',
  },
  'agustin-09-gracia-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Tratados sobre la gracia II',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 9)',
  },
  'agustin-10-sermones-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sermones II',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 10)',
  },
  'agustin-11-cartas-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Cartas II',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 11)',
  },
  'agustin-12-tratados-morales-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Tratados morales',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 12)',
  },
  'agustin-13-evangelio-juan-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Tratados sobre el Evangelio de San Juan (I)',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 13)',
  },
  'agustin-14-evangelio-juan-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sobre el Evangelio de San Juan 36–124',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 14)',
  },
  'agustin-15-tratados-escriturarios-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Tratados escriturarios',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 15)',
  },
  'agustin-16-ciudad-de-dios-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'La ciudad de Dios I',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 16)',
  },
  'agustin-17-ciudad-de-dios-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'La ciudad de Dios II',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 17)',
  },
  'agustin-18-epistolas-indices-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Exposición de varias epístolas e índices',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 18)',
  },
  'agustin-19-enarraciones-salmos-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Enarraciones sobre los Salmos I',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 19)',
  },
  'agustin-20-enarraciones-salmos-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Enarraciones sobre los Salmos II',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 20)',
  },
  'agustin-21-enarraciones-salmos-3-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Enarraciones sobre los Salmos III',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 21)',
  },
  'agustin-22-enarraciones-salmos-4-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Enarraciones sobre los Salmos IV',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 22)',
  },
  'agustin-23-sermones-juan-hechos-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sermones (Juan, Hechos, Cartas)',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 23)',
  },
  'agustin-24-sermones-4-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sermones 4 (184–272)',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 24)',
  },
  'agustin-25-sermones-5-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sermones 5 (273–338)',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 25)',
  },
  'agustin-26-sermones-6-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Sermones 6',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 26)',
  },
  'agustin-27-escritos-biblicos-3-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Bíblicos 3',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 27)',
  },
  'agustin-28-escritos-biblicos-4-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Bíblicos 4',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 28)',
  },
  'agustin-29-escritos-biblicos-5-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Bíblicos 5',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 29)',
  },
  'agustin-33-antidonatistas-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antidonatistas 2',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 33)',
  },
  'agustin-36-antipelagianos-4-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antipelagianos 4',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 36)',
  },
  'agustin-37-antipelagianos-5-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antipelagianos 5',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 37)',
  },
  'agustin-31-antimaniqueos-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos antimaniqueos (2.º) — Contra Fausto',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC XXXI (fuente pública; no en Drive)',
  },
  'agustin-32-antidonatistas-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos antidonatistas (1.º)',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC XXXII (Internet Archive; no en Drive)',
  },
  'agustin-30-antimaniqueos-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antimaniqueos 1',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 30)',
  },
  'agustin-34-antidonatistas-3-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antidonatistas 3',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 34)',
  },
  'agustin-35-antipelagianos-3-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antipelagianos 3',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 35)',
  },
  'agustin-38-antiarrianos-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos Antiarrianos y otros herejes',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 38)',
  },
  'agustin-39-varios-1-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos varios 1',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 39)',
  },
  'agustin-40-varios-2-es': {
    tipo: 'Padres de la Iglesia',
    autor: 'Agustín de Hipona',
    subtitulo: 'Escritos varios 2',
    compilador: 'A. Cedano',
    fuenteNota:
      'Compilación P. A. Cedano · BAC Obras de San Agustín (tomo 40)',
  },
  'cdc-es': {
    tipo: 'Derecho canónico',
    autor: 'Juan Pablo II',
    anio: 1983,
    subtitulo: 'Constitución apostólica « Sacrae disciplinae leges »',
  },
  'cceo-la': {
    tipo: 'Derecho canónico',
    autor: 'Juan Pablo II',
    anio: 1990,
    subtitulo: 'Constitución apostólica « Sacri canones »',
  },
  'cceo-es': {
    tipo: 'Derecho canónico',
    autor: 'Juan Pablo II',
    anio: 1990,
    subtitulo: 'Traducción al español generada por IA (no oficial)',
  },
  'jerusalen-la': {
    tipo: 'Concilios ecuménicos',
    anio: 50,
    subtitulo: 'Actus Apostolorum 15 (Vulgata)',
  },
  'nicea-i-la': {
    tipo: 'Concilios ecuménicos',
    anio: 325,
    subtitulo: 'Symbolum + Canones XX',
  },
  'nicea-i-es': {
    tipo: 'Concilios ecuménicos',
    anio: 325,
    subtitulo: 'Traducción al español generada por IA',
  },
  'jerusalen-es': {
    tipo: 'Concilios ecuménicos',
    anio: 50,
    subtitulo: 'Traducción al español generada por IA (Hch 15)',
  },
  'trento-es': {
    tipo: 'Concilios ecuménicos',
    anio: 1545,
    subtitulo: 'Traducción al español generada por IA',
  },
  'vat-i-es': {
    tipo: 'Concilios ecuménicos',
    anio: 1870,
    subtitulo: 'Traducción al español generada por IA',
  },
};

const KIND_FALLBACK: Record<string, string> = {
  catechism: 'Catecismo',
  bible: 'Sagrada Escritura',
  magisterium: 'Magisterio',
  patristic: 'Padres de la Iglesia',
  'canon-law': 'Derecho canónico',
  council: 'Concilios ecuménicos',
};

export function catalogDisplayFor(
  id: string | undefined,
  kind?: string,
  meta?: { author?: string; compiler?: string; sourceNote?: string }
): CatalogDisplay {
  const base: CatalogDisplay =
    id && BY_ID[id]
      ? { ...BY_ID[id] }
      : {
          tipo: (kind && KIND_FALLBACK[kind]) || kind || 'Documento',
        };
  // Corpus meta wins when present (author / compiler / provenance).
  if (meta?.author) base.autor = meta.author;
  if (meta?.compiler) base.compilador = meta.compiler;
  if (meta?.sourceNote) base.fuenteNota = meta.sourceNote;
  if (kind === 'patristic' && !base.compilador) {
    base.compilador = 'A. Cedano';
  }
  return base;
}

/** Line: "Tipo · Autor · Año" as in the design prototype. */
export function catalogMetaLine(display: CatalogDisplay): string {
  const parts = [display.tipo];
  if (display.autor) parts.push(display.autor);
  if (display.anio) parts.push(String(display.anio));
  if (display.compilador && display.tipo === 'Padres de la Iglesia') {
    parts.push(`comp. ${display.compilador}`);
  }
  return parts.join(' · ');
}
