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
    id: 'anonimo-diogneto',
    name: 'Carta a Diogneto',
    initials: 'D',
    era: PADRES_ERAS[0],
    eraLabel: 'Padre apostólico',
    years: 's. II',
    role: 'Apología anónima (Padres apostólicos)',
    meta: 's. II · Apología',
    quote:
      'Los cristianos habitan en el mundo, pero no son del mundo. Habitan sus propias patrias, pero como forasteros.',
    quoteSource: 'Carta a Diogneto, V–VI',
    works: [
      {
        title: 'Carta a Diogneto',
        documentId: 'carta-diogneto-es',
      },
    ],
    themes: ['Apología', 'Identidad cristiana', 'Encarnación'],
  },
  {
    id: 'clemente-alejandria',
    name: 'Clemente de Alejandría',
    initials: 'C',
    era: PADRES_ERAS[0],
    eraLabel: 'Padre apostólico',
    years: 'c. 150–215',
    death: '† c. 215',
    role: 'Maestro de Alejandría',
    meta: '† c. 215 · El Pedagogo',
    quote:
      'El Pedagogo es Dios, es el Verbo, el que es amigo del hombre, el que se preocupa del hombre.',
    quoteSource: 'El Pedagogo',
    works: [
      {
        title: 'El Pedagogo',
        documentId: 'clemente-alejandria-pedagogo-es',
      },
    ],
    themes: ['Educación cristiana', 'Logos', 'Moral', 'Alejandría'],
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
      {
        title: 'Sobre la Encarnación del Verbo',
        documentId: 'atanasio-de-incarnatione-en',
      },
      { title: 'Contra los arrianos' },
      { title: 'Vida de Antonio' },
    ],
    themes: ['Encarnación', 'Trinidad', 'Arrianismo', 'Divinización'],
  },
  {
    id: 'cirilo-jerusalen',
    name: 'Cirilo de Jerusalén',
    initials: 'CJ',
    era: PADRES_ERAS[1],
    eraLabel: 'Padre griego',
    years: 'c. 315–387',
    death: '† 387',
    role: 'Obispo de Jerusalén, doctor',
    meta: '† 387 · Catequesis',
    quote:
      'No vayáis a las aguas como a un baño cualquiera, sino a la gracia del Espíritu Santo que se da con el agua.',
    quoteSource: 'Catequesis III',
    works: [
      {
        title: 'Catequesis',
        documentId: 'cirilo-jerusalen-catequesis-es',
      },
    ],
    themes: ['Bautismo', 'Credo', 'Mistagogia', 'Catecumenado'],
  },
  {
    id: 'gregorio-nisa',
    name: 'Gregorio de Nisa',
    initials: 'GN',
    era: PADRES_ERAS[1],
    eraLabel: 'Padre griego',
    years: 'c. 335–395',
    death: '† c. 395',
    role: 'Obispo de Nisa, padre capadocio',
    meta: '† c. 395 · Gran Catequesis',
    quote:
      'La verdadera perfección no consiste en no pecar nunca, sino en no dejarse vencer por el pecado.',
    quoteSource: 'Gran Catequesis',
    works: [
      {
        title: 'Gran Catequesis',
        documentId: 'gregorio-nisa-gran-catequesis-es',
      },
    ],
    themes: ['Catequesis', 'Trinidad', 'Resurrección', 'Capadocios'],
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
    id: 'cipriano-cartago',
    name: 'Cipriano de Cartago',
    initials: 'CC',
    era: PADRES_ERAS[2],
    eraLabel: 'Padre latino',
    years: 'c. 210–258',
    death: '† 258',
    role: 'Obispo de Cartago, mártir',
    meta: '† 258 · Cartas',
    quote:
      'No puede tener a Dios por Padre quien no tiene a la Iglesia por madre.',
    quoteSource: 'De unitate ecclesiae',
    works: [
      {
        title: 'Cartas',
        documentId: 'cipriano-cartas-es',
      },
    ],
    themes: ['Unidad de la Iglesia', 'Martirio', 'Bautismo', 'Obispo'],
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
      { title: "San Agustín Introducción y primeros escritos", documentId: 'agustin-01-primeros-escritos-es' },
      { title: "Confesiones", documentId: 'agustin-02-confesiones-es' },
      { title: "Obras Filosóficas", documentId: 'agustin-03-obras-filosoficas-es' },
      { title: "Obras apologeticas", documentId: 'agustin-04-obras-apologeticas-es' },
      { title: "De Trinitate", documentId: 'agustin-05-de-trinitate-es' },
      { title: "Tratados sobre la gracia 1", documentId: 'agustin-06-gracia-1-es' },
      { title: "Sermones 1", documentId: 'agustin-07-sermones-1-es' },
      { title: "Cartas 1", documentId: 'agustin-08-cartas-1-es' },
      { title: "Tratados sobre la gracia 2", documentId: 'agustin-09-gracia-2-es' },
      { title: "Sermones 2", documentId: 'agustin-10-sermones-2-es' },
      { title: "Cartas 2", documentId: 'agustin-11-cartas-2-es' },
      { title: "Tratados Morales", documentId: 'agustin-12-tratados-morales-es' },
      {
        title: 'Tratados sobre el Evangelio de San Juan (I)',
        documentId: 'agustin-13-evangelio-juan-1-es',
      },
      {
        title: 'Sobre el Evangelio de San Juan (36–124)',
        documentId: 'agustin-14-evangelio-juan-2-es',
      },
      { title: "Tratados escriturarios", documentId: 'agustin-15-tratados-escriturarios-es' },
      { title: "La ciudad de Dios I", documentId: 'agustin-16-ciudad-de-dios-1-es' },
      { title: "La ciudad de Dios II", documentId: 'agustin-17-ciudad-de-dios-2-es' },
      { title: "Exposicion de varias epistolas Indices San Agustin", documentId: 'agustin-18-epistolas-indices-es' },
      { title: "Enarraciones sobre los Salmos 1", documentId: 'agustin-19-enarraciones-salmos-1-es' },
      { title: "Narraciones sobre los salmos 2", documentId: 'agustin-20-enarraciones-salmos-2-es' },
      { title: "Narraciones sobre los salmos 3", documentId: 'agustin-21-enarraciones-salmos-3-es' },
      { title: "Narraciones sobre los salmos 4", documentId: 'agustin-22-enarraciones-salmos-4-es' },
      { title: "Sermones (Juan, Hechos, Cartas)", documentId: 'agustin-23-sermones-juan-hechos-es' },
      { title: "Sermones 4 (184–272)", documentId: 'agustin-24-sermones-4-es' },
      { title: "Sermones 5 (273–338)", documentId: 'agustin-25-sermones-5-es' },
      { title: "Sermones 6", documentId: 'agustin-26-sermones-6-es' },
      { title: "Escritos Bíblicos 3", documentId: 'agustin-27-escritos-biblicos-3-es' },
      { title: "Escritos Bíblicos 4", documentId: 'agustin-28-escritos-biblicos-4-es' },
      { title: "Escritos Bíblicos 5", documentId: 'agustin-29-escritos-biblicos-5-es' },
      { title: "Escritos Antimaniqueos 1", documentId: 'agustin-30-antimaniqueos-1-es' },
      {
        title: 'Escritos antimaniqueos (2.º) — Contra Fausto',
        documentId: 'agustin-31-antimaniqueos-2-es',
      },
      {
        title: 'Escritos antidonatistas (1.º)',
        documentId: 'agustin-32-antidonatistas-1-es',
      },
      { title: "Escritos Antidonatistas 2", documentId: 'agustin-33-antidonatistas-2-es' },
      { title: "Escritos Antidonatistas 3", documentId: 'agustin-34-antidonatistas-3-es' },
      { title: "Escritos Antipelagianos 3", documentId: 'agustin-35-antipelagianos-3-es' },
      { title: "Escritos Antipelagianos 4", documentId: 'agustin-36-antipelagianos-4-es' },
      { title: "Escritos Antipelagianos 5", documentId: 'agustin-37-antipelagianos-5-es' },
      { title: "Escritos Antiarrianos y otros herejes", documentId: 'agustin-38-antiarrianos-es' },
      { title: "Escritos varios 1", documentId: 'agustin-39-varios-1-es' },
      { title: "Escritos varios 2", documentId: 'agustin-40-varios-2-es' },
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
