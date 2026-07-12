/** Catálogo estático — diseño 2C · 2D (Padres de la Iglesia). */

export interface PadreObra {
  title: string;
  /** documentId en el corpus si existe; si no, solo etiqueta. */
  documentId?: string;
}

export interface Padre {
  id: string;
  name: string;
  initials: string;
  era: string;
  eraLabel: string;
  years: string;
  death?: string;
  role: string;
  meta: string;
  quote?: string;
  quoteSource?: string;
  works: PadreObra[];
  themes: string[];
}

export const PADRES_ERAS = [
  'Padres apostólicos · s. I–II',
  'Padres griegos · s. IV',
  'Padres latinos · s. IV–V',
] as const;

export const PADRES: Padre[] = [
  {
    id: 'ignacio-antioquia',
    name: 'Ignacio de Antioquía',
    initials: 'I',
    era: PADRES_ERAS[0],
    eraLabel: 'Padre apostólico',
    years: 'c. 35–107',
    death: '† 107',
    role: 'Obispo de Antioquía, mártir',
    meta: '† 107 · 7 cartas',
    quote:
      'Donde está el obispo, allí debe estar la comunidad, así como donde está Jesucristo, allí está la Iglesia católica.',
    quoteSource: 'Carta a los Esmirniotas, 8',
    works: [
      { title: 'Carta a los Efesios' },
      { title: 'Carta a los Magnesios' },
      { title: 'Carta a los Romanos' },
      { title: 'Carta a los Esmirniotas' },
    ],
    themes: ['Eucaristía', 'Unidad', 'Martirio', 'Episcopado'],
  },
  {
    id: 'policarpo-esmirna',
    name: 'Policarpo de Esmirna',
    initials: 'P',
    era: PADRES_ERAS[0],
    eraLabel: 'Padre apostólico',
    years: 'c. 69–155',
    death: '† 155',
    role: 'Obispo de Esmirna, mártir',
    meta: '† 155 · Carta a los Filipenses',
    quote:
      'Orad por todos los santos. Orad también por los reyes y las autoridades y príncipes.',
    quoteSource: 'Carta a los Filipenses, 12',
    works: [{ title: 'Carta a los Filipenses' }, { title: 'Martirio de Policarpo' }],
    themes: ['Martirio', 'Tradición', 'Ortodoxia'],
  },
  {
    id: 'atanasio-alejandria',
    name: 'Atanasio de Alejandría',
    initials: 'A',
    era: PADRES_ERAS[1],
    eraLabel: 'Padre griego',
    years: 'c. 296–373',
    death: '† 373',
    role: 'Obispo de Alejandría, doctor',
    meta: '† 373 · Contra los arrianos',
    quote:
      'Él se hizo hombre para que nosotros fuéramos divinizados; se hizo visible en el cuerpo para que nosotros tuviéramos idea del Padre invisible.',
    quoteSource: 'Sobre la Encarnación, 54',
    works: [
      { title: 'Sobre la Encarnación del Verbo' },
      { title: 'Contra los arrianos' },
      { title: 'Vida de Antonio' },
    ],
    themes: ['Encarnación', 'Trinidad', 'Arrianismo', 'Divinización'],
  },
  {
    id: 'juan-crisostomo',
    name: 'Juan Crisóstomo',
    initials: 'JC',
    era: PADRES_ERAS[1],
    eraLabel: 'Padre griego',
    years: 'c. 349–407',
    death: '† 407',
    role: 'Patriarca de Constantinopla, doctor',
    meta: '† 407 · Homilías',
    quote:
      'No es posible que el fuego y el agua coexistan; tampoco la codicia y la vida.',
    quoteSource: 'Homilías sobre Mateo',
    works: [
      { title: 'Homilías sobre Mateo' },
      { title: 'Homilías sobre Romanos' },
      { title: 'Sobre el sacerdocio' },
    ],
    themes: ['Predicación', 'Caridad', 'Sacerdocio', 'Escritura'],
  },
  {
    id: 'agustin-hipona',
    name: 'Agustín de Hipona',
    initials: 'A',
    era: PADRES_ERAS[2],
    eraLabel: 'Padre latino',
    years: '354–430',
    death: '† 430',
    role: 'Obispo, doctor de la gracia',
    meta: '† 430 · Confesiones · La ciudad de Dios',
    quote:
      'Nos hiciste, Señor, para ti, y nuestro corazón está inquieto hasta que descanse en ti.',
    quoteSource: 'Confesiones, I, 1',
    works: [
      { title: 'Confesiones' },
      { title: 'La ciudad de Dios' },
      { title: 'De la doctrina cristiana' },
    ],
    themes: ['Gracia', 'Interioridad', 'Tiempo', 'Trinidad'],
  },
  {
    id: 'jeronimo',
    name: 'Jerónimo',
    initials: 'J',
    era: PADRES_ERAS[2],
    eraLabel: 'Padre latino',
    years: 'c. 347–420',
    death: '† 420',
    role: 'Presbítero, doctor, traductor de la Vulgata',
    meta: '† 420 · La Vulgata',
    quote:
      'Ignorar las Escrituras es ignorar a Cristo.',
    quoteSource: 'Comentario a Isaías, prólogo',
    works: [
      { title: 'La Vulgata' },
      { title: 'De viris illustribus' },
      { title: 'Cartas' },
    ],
    themes: ['Escritura', 'Traducción', 'Ascesis', 'Hebreo'],
  },
];

export function padreById(id: string): Padre | undefined {
  return PADRES.find((p) => p.id === id);
}

export function padresByEra(): { era: string; items: Padre[] }[] {
  const map = new Map<string, Padre[]>();
  for (const p of PADRES) {
    const list = map.get(p.era) || [];
    list.push(p);
    map.set(p.era, list);
  }
  return PADRES_ERAS.map((era) => ({ era, items: map.get(era) || [] })).filter(
    (g) => g.items.length
  );
}
