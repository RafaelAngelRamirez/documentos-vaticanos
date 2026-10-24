/**
 * Seed saints from known Padres / corpus authors (offline, no network).
 * Agustín lists all corpus packs with author "Agustín de Hipona".
 */
import type { SaintRecord } from '../../models/santoral.model';

export interface CorpusDocLite {
  id: string;
  title?: string;
  author?: string;
}

const PADRES_SEED: Omit<SaintRecord, 'documentIds'>[] = [
  {
    id: 'ignacio-antioquia',
    name: 'Ignacio de Antioquía',
    displayName: 'San Ignacio de Antioquía',
    initials: 'I',
    era: 'Padres apostólicos · s. I–II',
    eraLabel: 'Padre apostólico',
    years: 'c. 35–107',
    death: '† 107',
    role: 'Obispo de Antioquía, mártir',
    meta: '† 107 · 7 cartas',
    feastDays: ['10-17'],
    quote:
      'Donde está el obispo, allí debe estar la comunidad, así como donde está Jesucristo, allí está la Iglesia católica.',
    quoteSource: 'Carta a los Esmirniotas, 8',
    themes: ['Eucaristía', 'Unidad', 'Martirio', 'Episcopado'],
    authorAliases: ['Ignacio de Antioquía', 'Ignacio de Antioquia'],
    bio: 'San Ignacio de Antioquía, obispo y mártir del siglo I–II, escribió siete cartas camino del martirio en Roma. En ellas defiende la unidad de la Iglesia en torno al obispo y da un testimonio precoz de la fe eucarística.',
  },
  {
    id: 'policarpo-esmirna',
    name: 'Policarpo de Esmirna',
    displayName: 'San Policarpo de Esmirna',
    initials: 'P',
    era: 'Padres apostólicos · s. I–II',
    eraLabel: 'Padre apostólico',
    years: 'c. 69–155',
    death: '† 155',
    role: 'Obispo de Esmirna, mártir',
    meta: '† 155 · Carta a los Filipenses',
    feastDays: ['02-23'],
    quote:
      'Orad por todos los santos. Orad también por los reyes y las autoridades y príncipes.',
    quoteSource: 'Carta a los Filipenses, 12',
    themes: ['Martirio', 'Tradición', 'Ortodoxia'],
    authorAliases: ['Policarpo de Esmirna'],
    bio: 'San Policarpo, discípulo de los apóstoles y obispo de Esmirna, selló su fe con el martirio. Se conserva su Carta a los Filipenses y el relato del Martirio de Policarpo.',
  },
  {
    id: 'anonimo-diogneto',
    name: 'Carta a Diogneto',
    displayName: 'Carta a Diogneto',
    initials: 'D',
    era: 'Padres apostólicos · s. I–II',
    eraLabel: 'Padre apostólico',
    years: 's. II',
    role: 'Apología anónima (Padres apostólicos)',
    meta: 's. II · Apología',
    quote:
      'Los cristianos habitan en el mundo, pero no son del mundo. Habitan sus propias patrias, pero como forasteros.',
    quoteSource: 'Carta a Diogneto, V–VI',
    themes: ['Apología', 'Identidad cristiana', 'Encarnación'],
    authorAliases: ['Anónimo (Padres apostólicos)'],
    bio: 'La Carta a Diogneto es una apología anónima del siglo II que describe con pureza la identidad cristiana en el mundo: en el mundo pero no del mundo.',
  },
  {
    id: 'clemente-alejandria',
    name: 'Clemente de Alejandría',
    displayName: 'San Clemente de Alejandría',
    initials: 'C',
    era: 'Padres apostólicos · s. I–II',
    eraLabel: 'Padre apostólico',
    years: 'c. 150–215',
    death: '† c. 215',
    role: 'Maestro de Alejandría',
    meta: '† c. 215 · El Pedagogo',
    quote:
      'El Pedagogo es Dios, es el Verbo, el que es amigo del hombre, el que se preocupa del hombre.',
    quoteSource: 'El Pedagogo',
    themes: ['Educación cristiana', 'Logos', 'Moral', 'Alejandría'],
    authorAliases: ['Clemente de Alejandría', 'Clemente de Alejandria'],
    bio: 'Clemente de Alejandría fue maestro de la escuela catequética de Alejandría. En El Pedagogo presenta a Cristo como educador del hombre hacia la vida virtuosa.',
  },
  {
    id: 'atanasio-alejandria',
    name: 'Atanasio de Alejandría',
    displayName: 'San Atanasio de Alejandría',
    initials: 'A',
    era: 'Padres griegos · s. IV',
    eraLabel: 'Padre griego',
    years: 'c. 296–373',
    death: '† 373',
    role: 'Obispo de Alejandría, doctor',
    meta: '† 373 · Contra los arrianos',
    feastDays: ['05-02'],
    quote:
      'Él se hizo hombre para que nosotros fuéramos divinizados; se hizo visible en el cuerpo para que nosotros tuviéramos idea del Padre invisible.',
    quoteSource: 'Sobre la Encarnación, 54',
    themes: ['Encarnación', 'Trinidad', 'Arrianismo', 'Divinización'],
    authorAliases: ['Atanasio de Alejandría', 'Atanasio de Alejandria'],
    bio: 'San Atanasio, obispo de Alejandría y doctor de la Iglesia, defendió la fe de Nicea frente al arrianismo. Su Sobre la Encarnación del Verbo es un clásico de la teología patrística.',
  },
  {
    id: 'cirilo-jerusalen',
    name: 'Cirilo de Jerusalén',
    displayName: 'San Cirilo de Jerusalén',
    initials: 'CJ',
    era: 'Padres griegos · s. IV',
    eraLabel: 'Padre griego',
    years: 'c. 315–387',
    death: '† 387',
    role: 'Obispo de Jerusalén, doctor',
    meta: '† 387 · Catequesis',
    feastDays: ['03-18'],
    quote:
      'No vayáis a las aguas como a un baño cualquiera, sino a la gracia del Espíritu Santo que se da con el agua.',
    quoteSource: 'Catequesis III',
    themes: ['Bautismo', 'Credo', 'Mistagogia', 'Catecumenado'],
    authorAliases: ['Cirilo de Jerusalén', 'Cirilo de Jerusalen'],
    bio: 'San Cirilo de Jerusalén, doctor de la Iglesia, dejó las Catequesis mistagógicas que introducen a los neófitos en los misterios de la fe y de los sacramentos.',
  },
  {
    id: 'gregorio-nisa',
    name: 'Gregorio de Nisa',
    displayName: 'San Gregorio de Nisa',
    initials: 'GN',
    era: 'Padres griegos · s. IV',
    eraLabel: 'Padre griego',
    years: 'c. 335–395',
    death: '† c. 395',
    role: 'Obispo de Nisa, padre capadocio',
    meta: '† c. 395 · Gran Catequesis',
    feastDays: ['01-10'],
    quote:
      'La verdadera perfección no consiste en no pecar nunca, sino en no dejarse vencer por el pecado.',
    quoteSource: 'Gran Catequesis',
    themes: ['Catequesis', 'Trinidad', 'Resurrección', 'Capadocios'],
    authorAliases: ['Gregorio de Nisa'],
    bio: 'San Gregorio de Nisa, padre capadocio, desarrolló una profunda teología mística y trinitaria. Su Gran Catequesis expone el misterio de la salvación con claridad pedagógica.',
  },
  {
    id: 'juan-crisostomo',
    name: 'Juan Crisóstomo',
    displayName: 'San Juan Crisóstomo',
    initials: 'JC',
    era: 'Padres griegos · s. IV',
    eraLabel: 'Padre griego',
    years: 'c. 349–407',
    death: '† 407',
    role: 'Patriarca de Constantinopla, doctor',
    meta: '† 407 · Homilías',
    feastDays: ['09-13'],
    quote:
      'No es posible que el fuego y el agua coexistan; tampoco la codicia y la vida.',
    quoteSource: 'Homilías sobre Mateo',
    themes: ['Predicación', 'Caridad', 'Sacerdocio', 'Escritura'],
    authorAliases: ['Juan Crisóstomo', 'Juan Crisostomo'],
    bio: 'San Juan Crisóstomo («Boca de oro»), patriarca de Constantinopla y doctor de la Iglesia, es el predicador por excelencia de la Escritura y de la caridad social.',
  },
  {
    id: 'cipriano-cartago',
    name: 'Cipriano de Cartago',
    displayName: 'San Cipriano de Cartago',
    initials: 'CC',
    era: 'Padres latinos · s. IV–V',
    eraLabel: 'Padre latino',
    years: 'c. 210–258',
    death: '† 258',
    role: 'Obispo de Cartago, mártir',
    meta: '† 258 · Cartas',
    feastDays: ['09-16'],
    quote:
      'No puede tener a Dios por Padre quien no tiene a la Iglesia por madre.',
    quoteSource: 'De unitate ecclesiae',
    themes: ['Unidad de la Iglesia', 'Martirio', 'Bautismo', 'Obispo'],
    authorAliases: ['Cipriano de Cartago'],
    bio: 'San Cipriano, obispo de Cartago y mártir, escribió sobre la unidad de la Iglesia y la disciplina eclesial. Sus cartas iluminan la vida de la Iglesia africana del siglo III.',
  },
  {
    id: 'agustin-hipona',
    name: 'Agustín de Hipona',
    displayName: 'San Agustín de Hipona',
    initials: 'A',
    era: 'Padres latinos · s. IV–V',
    eraLabel: 'Padre latino',
    years: '354–430',
    death: '† 430',
    role: 'Obispo, doctor de la gracia',
    meta: '† 430 · Confesiones · La ciudad de Dios',
    feastDays: ['08-28'],
    quote:
      'Nos hiciste, Señor, para ti, y nuestro corazón está inquieto hasta que descanse en ti.',
    quoteSource: 'Confesiones, I, 1',
    themes: ['Gracia', 'Interioridad', 'Tiempo', 'Trinidad'],
    authorAliases: [
      'Agustín de Hipona',
      'Agustin de Hipona',
      'San Agustín',
      'San Agustin',
      'Augustine of Hippo',
      'Aurelius Augustinus',
    ],
    sourceUrl:
      'https://www.vatican.va/content/vatican/es.html',
    bio:
      'San Agustín de Hipona (354–430), obispo y doctor de la Iglesia, es una de las figuras centrales de la tradición occidental. Convertido tras una larga búsqueda (Confesiones), defendió la gracia frente al pelagianismo, elaboró una teología trinitaria (De Trinitate) y una visión de la historia en La ciudad de Dios. Su obra abarca tratados, sermones, cartas y comentarios bíblicos; muchas de estas obras están disponibles en el corpus de esta aplicación.',
  },
  {
    id: 'jeronimo',
    name: 'Jerónimo',
    displayName: 'San Jerónimo',
    initials: 'J',
    era: 'Padres latinos · s. IV–V',
    eraLabel: 'Padre latino',
    years: 'c. 347–420',
    death: '† 420',
    role: 'Presbítero, doctor, traductor de la Vulgata',
    meta: '† 420 · La Vulgata',
    feastDays: ['09-30'],
    quote: 'Ignorar las Escrituras es ignorar a Cristo.',
    quoteSource: 'Comentario a Isaías, prólogo',
    themes: ['Escritura', 'Traducción', 'Ascesis', 'Hebreo'],
    authorAliases: ['Jerónimo', 'Jeronimo', 'San Jerónimo'],
    bio: 'San Jerónimo, doctor de la Iglesia, tradujo la Biblia al latín (Vulgata) y dejó un vastísimo corpus de comentarios y cartas. Es patrón de los biblistas y traductores.',
  },
];

/**
 * Build saint records: padres seed + auto documentIds from corpus author match.
 */
export function buildPadresSeedSaints(docs: CorpusDocLite[]): SaintRecord[] {
  const byAuthor = new Map<string, string[]>();
  for (const d of docs) {
    if (!d.author) continue;
    const list = byAuthor.get(d.author) || [];
    list.push(d.id);
    byAuthor.set(d.author, list);
  }

  return PADRES_SEED.map((seed) => {
    const ids = new Set<string>();
    // explicit known packs by alias match on corpus author
    for (const [author, docIds] of byAuthor) {
      const a = author.toLowerCase();
      for (const alias of seed.authorAliases || [seed.name]) {
        const al = alias.toLowerCase();
        if (a === al || a.includes(al) || al.includes(a)) {
          for (const id of docIds) ids.add(id);
        }
      }
    }
    // also pick id-prefix matches for agustin-*
    if (seed.id === 'agustin-hipona') {
      for (const d of docs) {
        if (d.id.startsWith('agustin-')) ids.add(d.id);
      }
    }
    return {
      ...seed,
      locale: 'es',
      documentIds: Array.from(ids).sort(),
    };
  });
}
