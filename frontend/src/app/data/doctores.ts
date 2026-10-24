/** Catálogo estático — Doctores de la Iglesia (38). Patrón 2C · 2D como Padres. */

export interface DoctorObra {
  title: string;
  /** documentId en el corpus si existe pack legible. */
  documentId?: string;
  /** Fuente pública candidata cuando aún no hay pack (o como provenance). */
  sourceUrl?: string;
}

export interface Doctor {
  id: string;
  name: string;
  initials: string;
  era: string;
  years: string;
  /** Año de proclamación como Doctor (si se conoce). */
  proclaimedYear: number;
  role: string;
  meta: string;
  quote?: string;
  quoteSource?: string;
  works: DoctorObra[];
  themes: string[];
  /** Decreto/homilía de proclamación en vatican.va u otra fuente oficial. */
  proclamationSourceUrl?: string;
}

export const DOCTORES_ERAS = [
  'Padres y antiguos · s. II–V',
  'Alta Edad Media · s. VI–XI',
  'Escolástica y mística · s. XII–XIV',
  'Renacimiento y reforma católica · s. XV–XVII',
  'Modernos · s. XVIII–XIX',
  'Contemporáneos · s. XX–XXI',
] as const;

export const DOCTORES: Doctor[] = [
  {
    id: 'ambrosio-milan',
    name: 'San Ambrosio de Milán',
    initials: 'AM',
    era: DOCTORES_ERAS[0],
    years: 'c. 340–397',
    proclaimedYear: 1298,
    role: 'Obispo de Milán, doctor',
    meta: 'c. 340–397 · Doctor 1298',
    quote: 'Donde está Pedro, allí está la Iglesia.',
    quoteSource: 'Comentarios',
    works: [
      { title: 'De officiis ministrorum', sourceUrl: 'https://www.newadvent.org/fathers/34011.htm' },
      { title: 'Hexaemeron', sourceUrl: 'https://www.newadvent.org/fathers/3403.htm' },
      { title: 'Himnos', sourceUrl: 'https://www.newadvent.org/fathers/3413.htm' },
    ],
    themes: ['Pastoral', 'Liturgia', 'Mariología', 'Ética'],
  },
  {
    id: 'agustin-hipona',
    name: 'San Agustín de Hipona',
    initials: 'A',
    era: DOCTORES_ERAS[0],
    years: '354–430',
    proclaimedYear: 1298,
    role: 'Obispo, doctor de la gracia',
    meta: '354–430 · Doctor 1298',
    quote: 'Nos hiciste, Señor, para ti, y nuestro corazón está inquieto hasta que descanse en ti.',
    quoteSource: 'Confesiones, I, 1',
    works: [
      { title: 'Confesiones', documentId: 'agustin-02-confesiones-es' },
      { title: 'De Trinitate', documentId: 'agustin-05-de-trinitate-es' },
      { title: 'La ciudad de Dios I', documentId: 'agustin-16-ciudad-de-dios-1-es' },
      { title: 'La ciudad de Dios II', documentId: 'agustin-17-ciudad-de-dios-2-es' },
      { title: 'De doctrina christiana', sourceUrl: 'https://www.newadvent.org/fathers/1202.htm' },
    ],
    themes: ['Gracia', 'Trinidad', 'Interioridad', 'Historia'],
  },
  {
    id: 'gregorio-magno',
    name: 'San Gregorio Magno',
    initials: 'GM',
    era: DOCTORES_ERAS[1],
    years: 'c. 540–604',
    proclaimedYear: 1298,
    role: 'Papa, doctor',
    meta: 'c. 540–604 · Doctor 1298',
    works: [
      { title: 'Moralia in Job', sourceUrl: 'https://www.newadvent.org/fathers/3501.htm' },
      { title: 'Regla Pastoral', sourceUrl: 'https://www.newadvent.org/fathers/36011.htm' },
      { title: 'Diálogos', sourceUrl: 'https://www.newadvent.org/fathers/3602.htm' },
    ],
    themes: ['Pastoral', 'Escritura', 'Monacato', 'Liturgia'],
  },
  {
    id: 'jeronimo',
    name: 'San Jerónimo',
    initials: 'J',
    era: DOCTORES_ERAS[0],
    years: 'c. 347–420',
    proclaimedYear: 1298,
    role: 'Presbítero, doctor, traductor de la Vulgata',
    meta: 'c. 347–420 · Doctor 1298',
    quote: 'Ignorar las Escrituras es ignorar a Cristo.',
    quoteSource: 'Comentario a Isaías, prólogo',
    works: [
      { title: 'De viris illustribus', sourceUrl: 'https://www.newadvent.org/fathers/2708.htm' },
      { title: 'Cartas', sourceUrl: 'https://www.newadvent.org/fathers/3001.htm' },
      { title: 'La Vulgata', sourceUrl: 'https://vulgate.org/' },
    ],
    themes: ['Escritura', 'Traducción', 'Ascesis'],
  },
  {
    id: 'tomas-aquino',
    name: 'Santo Tomás de Aquino',
    initials: 'TA',
    era: DOCTORES_ERAS[2],
    years: '1225–1274',
    proclaimedYear: 1567,
    role: 'Presbítero dominico, doctor angélico',
    meta: '1225–1274 · Doctor 1567',
    works: [
      { title: 'Suma Teológica', sourceUrl: 'https://www.newadvent.org/summa/' },
      { title: 'Suma contra Gentiles', sourceUrl: 'https://www.ccel.org/ccel/aquinas/gentiles' },
      { title: 'Comentarios a la Escritura', sourceUrl: 'https://www.ccel.org/ccel/aquinas' },
    ],
    themes: ['Teología', 'Filosofía', 'Eucaristía', 'Ley'],
  },
  {
    id: 'atanasio-alejandria',
    name: 'San Atanasio de Alejandría',
    initials: 'At',
    era: DOCTORES_ERAS[0],
    years: 'c. 297–373',
    proclaimedYear: 1568,
    role: 'Obispo de Alejandría, doctor',
    meta: 'c. 297–373 · Doctor 1568',
    quote: 'Él se hizo hombre para que nosotros fuéramos divinizados.',
    quoteSource: 'Sobre la Encarnación, 54',
    works: [
      { title: 'Sobre la Encarnación del Verbo', documentId: 'atanasio-de-incarnatione-en', sourceUrl: 'https://www.newadvent.org/fathers/2802.htm' },
      { title: 'Contra los arrianos', sourceUrl: 'https://www.newadvent.org/fathers/2803.htm' },
      { title: 'Vida de Antonio', sourceUrl: 'https://www.newadvent.org/fathers/2811.htm' },
    ],
    themes: ['Encarnación', 'Trinidad', 'Arrianismo', 'Divinización'],
  },
  {
    id: 'basilio-magno',
    name: 'San Basilio Magno',
    initials: 'BM',
    era: DOCTORES_ERAS[0],
    years: 'c. 330–379',
    proclaimedYear: 1568,
    role: 'Obispo de Cesarea, doctor',
    meta: 'c. 330–379 · Doctor 1568',
    works: [
      { title: 'De Spiritu Sancto', sourceUrl: 'https://www.newadvent.org/fathers/3203.htm' },
      { title: 'Hexaemeron', sourceUrl: 'https://www.newadvent.org/fathers/3201.htm' },
      { title: 'Reglas monásticas', sourceUrl: 'https://www.newadvent.org/fathers/3203.htm' },
    ],
    themes: ['Espíritu Santo', 'Monacato', 'Caridad', 'Capadocios'],
  },
  {
    id: 'gregorio-nacianceno',
    name: 'San Gregorio Nacianceno',
    initials: 'GN',
    era: DOCTORES_ERAS[0],
    years: 'c. 329–390',
    proclaimedYear: 1568,
    role: 'Obispo, doctor teólogo',
    meta: 'c. 329–390 · Doctor 1568',
    works: [
      { title: 'Discursos teológicos', sourceUrl: 'https://www.newadvent.org/fathers/3102.htm' },
      { title: 'Oraciones y poemas', sourceUrl: 'https://www.newadvent.org/fathers/3103.htm' },
    ],
    themes: ['Trinidad', 'Teología', 'Retórica sagrada'],
  },
  {
    id: 'juan-crisostomo',
    name: 'San Juan Crisóstomo',
    initials: 'JC',
    era: DOCTORES_ERAS[0],
    years: 'c. 347–407',
    proclaimedYear: 1568,
    role: 'Patriarca de Constantinopla, doctor',
    meta: 'c. 347–407 · Doctor 1568',
    works: [
      { title: 'Homilías sobre Mateo', sourceUrl: 'https://www.newadvent.org/fathers/2001.htm' },
      { title: 'Homilías sobre Juan', sourceUrl: 'https://www.newadvent.org/fathers/2401.htm' },
      { title: 'Homilías sobre Romanos', sourceUrl: 'https://www.newadvent.org/fathers/2102.htm' },
      { title: 'Sobre el sacerdocio', sourceUrl: 'https://www.newadvent.org/fathers/1922.htm' },
    ],
    themes: ['Predicación', 'Caridad', 'Sacerdocio', 'Escritura'],
  },
  {
    id: 'buenaventura',
    name: 'San Buenaventura',
    initials: 'B',
    era: DOCTORES_ERAS[2],
    years: '1221–1274',
    proclaimedYear: 1588,
    role: 'Cardenal franciscano, doctor seráfico',
    meta: '1221–1274 · Doctor 1588',
    works: [
      { title: 'Itinerarium mentis in Deum', sourceUrl: 'https://www.ccel.org/ccel/bonaventure/journey' },
      { title: 'Breviloquium', sourceUrl: 'https://www.ccel.org/ccel/bonaventure' },
    ],
    themes: ['Mística', 'Cristo', 'Creación', 'Franciscanismo'],
  },
  {
    id: 'anselmo-canterbury',
    name: 'San Anselmo de Canterbury',
    initials: 'An',
    era: DOCTORES_ERAS[1],
    years: '1033–1109',
    proclaimedYear: 1720,
    role: 'Arzobispo de Canterbury, doctor',
    meta: '1033–1109 · Doctor 1720',
    quote: 'Creo para entender.',
    quoteSource: 'Proslogion',
    works: [
      { title: 'Proslogion', sourceUrl: 'https://www.ccel.org/ccel/anselm/basic_works' },
      { title: 'Cur Deus homo', sourceUrl: 'https://www.ccel.org/ccel/anselm/basic_works' },
    ],
    themes: ['Fe y razón', 'Satisfacción', 'Escolástica'],
  },
  {
    id: 'isidoro-sevilla',
    name: 'San Isidoro de Sevilla',
    initials: 'IS',
    era: DOCTORES_ERAS[1],
    years: 'c. 560–636',
    proclaimedYear: 1722,
    role: 'Obispo de Sevilla, doctor',
    meta: 'c. 560–636 · Doctor 1722',
    works: [
      { title: 'Etimologías', sourceUrl: 'https://www.ccel.org/ccel/isidore' },
      { title: 'Sentencias', sourceUrl: 'https://archive.org/details/sententiarumlib00isidgoog' },
    ],
    themes: ['Enciclopedia', 'Educación', 'España visigoda'],
  },
  {
    id: 'pedro-crisologo',
    name: 'San Pedro Crisólogo',
    initials: 'PC',
    era: DOCTORES_ERAS[0],
    years: 'c. 380–450',
    proclaimedYear: 1729,
    role: 'Obispo de Rávena, doctor',
    meta: 'c. 380–450 · Doctor 1729',
    works: [
      { title: 'Sermones', sourceUrl: 'https://www.newadvent.org/fathers/3603.htm' },
    ],
    themes: ['Predicación', 'Encarnación', 'Liturgia'],
  },
  {
    id: 'leon-magno',
    name: 'San León Magno',
    initials: 'LM',
    era: DOCTORES_ERAS[0],
    years: 'c. 400–461',
    proclaimedYear: 1754,
    role: 'Papa, doctor',
    meta: 'c. 400–461 · Doctor 1754',
    works: [
      { title: 'Tomo a Flaviano', sourceUrl: 'https://www.newadvent.org/fathers/3604028.htm' },
      { title: 'Sermones', sourceUrl: 'https://www.newadvent.org/fathers/3604.htm' },
      { title: 'Cartas', sourceUrl: 'https://www.newadvent.org/fathers/3604.htm' },
    ],
    themes: ['Cristología', 'Papado', 'Calcedonia'],
  },
  {
    id: 'pedro-damian',
    name: 'San Pedro Damián',
    initials: 'PD',
    era: DOCTORES_ERAS[1],
    years: '1007–1072',
    proclaimedYear: 1828,
    role: 'Cardenal, doctor, camaldolense',
    meta: '1007–1072 · Doctor 1828',
    works: [
      { title: 'Liber Gomorrhianus', sourceUrl: 'https://archive.org/details/operaomnia00damigoog' },
      { title: 'Cartas y opúsculos', sourceUrl: 'https://archive.org/details/operaomnia00damigoog' },
    ],
    themes: ['Reforma', 'Ascesis', 'Clero'],
  },
  {
    id: 'bernardo-claraval',
    name: 'San Bernardo de Claraval',
    initials: 'BC',
    era: DOCTORES_ERAS[2],
    years: 'c. 1090–1153',
    proclaimedYear: 1830,
    role: 'Abad cisterciense, doctor melifluo',
    meta: 'c. 1090–1153 · Doctor 1830',
    works: [
      { title: 'Sermones sobre el Cantar de los Cantares', sourceUrl: 'https://www.ccel.org/ccel/bernard/songofsongs' },
      { title: 'Tratados marianos', sourceUrl: 'https://www.ccel.org/ccel/bernard' },
    ],
    themes: ['Mística', 'María', 'Cister'],
  },
  {
    id: 'hilario-poitiers',
    name: 'San Hilario de Poitiers',
    initials: 'HP',
    era: DOCTORES_ERAS[0],
    years: 'c. 315–367',
    proclaimedYear: 1851,
    role: 'Obispo de Poitiers, doctor',
    meta: 'c. 315–367 · Doctor 1851',
    works: [
      { title: 'De Trinitate', sourceUrl: 'https://www.newadvent.org/fathers/3302.htm' },
      { title: 'Comentario a Mateo', sourceUrl: 'https://www.newadvent.org/fathers/3301.htm' },
    ],
    themes: ['Trinidad', 'Arrianismo', 'Escritura'],
  },
  {
    id: 'alfonso-ligorio',
    name: 'San Alfonso María de Ligorio',
    initials: 'AL',
    era: DOCTORES_ERAS[4],
    years: '1696–1787',
    proclaimedYear: 1871,
    role: 'Obispo, fundador, doctor',
    meta: '1696–1787 · Doctor 1871',
    works: [
      { title: 'Theologia Moralis', sourceUrl: 'https://archive.org/details/theologiamoralis01ligouoft' },
      { title: 'Las glorias de María', sourceUrl: 'https://archive.org/details/gloriesofmary00ligouoft' },
      { title: 'Práctica del amor a Jesucristo', sourceUrl: 'https://archive.org/details/practiceofloveof00ligouoft' },
    ],
    themes: ['Moral', 'Mariología', 'Pastoral'],
  },
  {
    id: 'francisco-sales',
    name: 'San Francisco de Sales',
    initials: 'FS',
    era: DOCTORES_ERAS[3],
    years: '1567–1622',
    proclaimedYear: 1877,
    role: 'Obispo de Ginebra, doctor',
    meta: '1567–1622 · Doctor 1877',
    works: [
      { title: 'Introducción a la vida devota', sourceUrl: 'https://www.ccel.org/ccel/desales/devout_life' },
      { title: 'Tratado del amor de Dios', sourceUrl: 'https://www.ccel.org/ccel/desales/love' },
    ],
    themes: ['Devoción', 'Amor de Dios', 'Laicado'],
  },
  {
    id: 'cirilo-alejandria',
    name: 'San Cirilo de Alejandría',
    initials: 'CA',
    era: DOCTORES_ERAS[0],
    years: 'c. 376–444',
    proclaimedYear: 1882,
    role: 'Patriarca de Alejandría, doctor',
    meta: 'c. 376–444 · Doctor 1882',
    works: [
      { title: 'Contra Nestorio', sourceUrl: 'https://www.newadvent.org/fathers/' },
      { title: 'Comentarios bíblicos', sourceUrl: 'https://www.newadvent.org/fathers/2531.htm' },
    ],
    themes: ['Cristología', 'María Theotokos', 'Éfeso'],
  },
  {
    id: 'cirilo-jerusalen',
    name: 'San Cirilo de Jerusalén',
    initials: 'CJ',
    era: DOCTORES_ERAS[0],
    years: 'c. 313–386',
    proclaimedYear: 1882,
    role: 'Obispo de Jerusalén, doctor',
    meta: 'c. 313–386 · Doctor 1882',
    quote: 'No vayáis a las aguas como a un baño cualquiera, sino a la gracia del Espíritu Santo.',
    quoteSource: 'Catequesis III',
    works: [
      { title: 'Catequesis', documentId: 'cirilo-jerusalen-catequesis-es' },
    ],
    themes: ['Bautismo', 'Credo', 'Mistagogia', 'Catecumenado'],
  },
  {
    id: 'juan-damasceno',
    name: 'San Juan Damasceno',
    initials: 'JD',
    era: DOCTORES_ERAS[1],
    years: 'c. 675–749',
    proclaimedYear: 1890,
    role: 'Presbítero, doctor',
    meta: 'c. 675–749 · Doctor 1890',
    works: [
      { title: 'De fide orthodoxa', sourceUrl: 'https://www.newadvent.org/fathers/3304.htm' },
      { title: 'Contra los iconoclastas', sourceUrl: 'https://www.newadvent.org/fathers/3305.htm' },
    ],
    themes: ['Dogmática', 'Iconos', 'Tradición'],
  },
  {
    id: 'beda-venerable',
    name: 'San Beda el Venerable',
    initials: 'BV',
    era: DOCTORES_ERAS[1],
    years: '673–735',
    proclaimedYear: 1899,
    role: 'Monje benedictino, doctor',
    meta: '673–735 · Doctor 1899',
    works: [
      { title: 'Historia eclesiástica del pueblo inglés', sourceUrl: 'https://www.ccel.org/ccel/bede/history' },
      { title: 'Comentarios bíblicos', sourceUrl: 'https://www.ccel.org/ccel/bede' },
    ],
    themes: ['Historia', 'Escritura', 'Monacato inglés'],
  },
  {
    id: 'efren-sirio',
    name: 'San Efrén el Sirio',
    initials: 'ES',
    era: DOCTORES_ERAS[0],
    years: 'c. 306–373',
    proclaimedYear: 1920,
    role: 'Diácono, doctor',
    meta: 'c. 306–373 · Doctor 1920',
    works: [
      { title: 'Himnos', sourceUrl: 'https://www.newadvent.org/fathers/3701.htm' },
      { title: 'Comentarios bíblicos', sourceUrl: 'https://www.newadvent.org/fathers/3702.htm' },
    ],
    themes: ['Poesía sagrada', 'María', 'Siria'],
  },
  {
    id: 'pedro-canisio',
    name: 'San Pedro Canisio',
    initials: 'PCa',
    era: DOCTORES_ERAS[3],
    years: '1521–1597',
    proclaimedYear: 1925,
    role: 'Sacerdote jesuita, doctor',
    meta: '1521–1597 · Doctor 1925',
    works: [
      { title: 'Catecismos', sourceUrl: 'https://archive.org/details/catechismuscatho00caniuoft' },
      { title: 'Summa doctrinae christianae', sourceUrl: 'https://archive.org/details/summadoctrinaech00caniuoft' },
    ],
    themes: ['Catequesis', 'Contrarreforma', 'Educación'],
  },
  {
    id: 'juan-cruz',
    name: 'San Juan de la Cruz',
    initials: 'JCZ',
    era: DOCTORES_ERAS[3],
    years: '1542–1591',
    proclaimedYear: 1926,
    role: 'Presbítero carmelita, doctor místico',
    meta: '1542–1591 · Doctor 1926',
    works: [
      { title: 'Subida del Monte Carmelo', sourceUrl: 'https://www.cervantesvirtual.com/obra/subida-del-monte-carmelo/' },
      { title: 'Noche oscura', sourceUrl: 'https://www.cervantesvirtual.com/obra/noche-oscura-del-alma/' },
      { title: 'Cántico espiritual', sourceUrl: 'https://www.cervantesvirtual.com/obra/cantico-espiritual/' },
      { title: 'Llama de amor viva', sourceUrl: 'https://www.cervantesvirtual.com/obra/llama-de-amor-viva/' },
    ],
    themes: ['Mística', 'Unión con Dios', 'Poesía'],
  },
  {
    id: 'roberto-belarmino',
    name: 'San Roberto Belarmino',
    initials: 'RB',
    era: DOCTORES_ERAS[3],
    years: '1542–1621',
    proclaimedYear: 1931,
    role: 'Cardenal jesuita, doctor',
    meta: '1542–1621 · Doctor 1931',
    works: [
      { title: 'Disputationes de controversiis', sourceUrl: 'https://archive.org/details/disputationesrob01belluoft' },
      { title: 'Catecismo', sourceUrl: 'https://archive.org/details/adottrina01belluoft' },
    ],
    themes: ['Apologética', 'Controversia', 'Eclesiología'],
  },
  {
    id: 'alberto-magno',
    name: 'San Alberto Magno',
    initials: 'AMg',
    era: DOCTORES_ERAS[2],
    years: 'c. 1206–1280',
    proclaimedYear: 1931,
    role: 'Obispo dominico, doctor universal',
    meta: 'c. 1206–1280 · Doctor 1931',
    works: [
      { title: 'Comentarios filosóficos', sourceUrl: 'https://archive.org/details/albertimagniop01albe' },
      { title: 'Comentarios teológicos', sourceUrl: 'https://archive.org/details/albertimagniop01albe' },
    ],
    themes: ['Filosofía', 'Ciencia', 'Teología', 'Tomismo'],
  },
  {
    id: 'antonio-padua',
    name: 'San Antonio de Padua',
    initials: 'AP',
    era: DOCTORES_ERAS[2],
    years: '1195–1231',
    proclaimedYear: 1946,
    role: 'Presbítero franciscano, doctor',
    meta: '1195–1231 · Doctor 1946',
    works: [
      { title: 'Sermones', sourceUrl: 'https://archive.org/details/sermonesdominica00anto' },
    ],
    themes: ['Predicación', 'Escritura', 'Pobres'],
  },
  {
    id: 'lorenzo-brindis',
    name: 'San Lorenzo de Brindis',
    initials: 'LB',
    era: DOCTORES_ERAS[3],
    years: '1559–1619',
    proclaimedYear: 1959,
    role: 'Presbítero capuchino, doctor',
    meta: '1559–1619 · Doctor 1959',
    works: [
      { title: 'Opera omnia (sermones y tratados)', sourceUrl: 'https://archive.org/details/operacompleta01lawruoft' },
    ],
    themes: ['Predicación', 'Escritura', 'María'],
  },
  {
    id: 'teresa-avila',
    name: 'Santa Teresa de Jesús (de Ávila)',
    initials: 'TJ',
    era: DOCTORES_ERAS[3],
    years: '1515–1582',
    proclaimedYear: 1970,
    role: 'Virgen carmelita, doctora',
    meta: '1515–1582 · Doctor 1970',
    works: [
      { title: 'Libro de la Vida', sourceUrl: 'https://www.cervantesvirtual.com/obra/libro-de-la-vida/' },
      { title: 'Camino de perfección', sourceUrl: 'https://www.cervantesvirtual.com/obra/camino-de-perfeccion/' },
      { title: 'Castillo interior', sourceUrl: 'https://www.cervantesvirtual.com/obra/las-moradas-o-castillo-interior/' },
    ],
    themes: ['Mística', 'Oración', 'Reforma carmelita'],
  },
  {
    id: 'catalina-siena',
    name: 'Santa Catalina de Siena',
    initials: 'CS',
    era: DOCTORES_ERAS[2],
    years: '1347–1380',
    proclaimedYear: 1970,
    role: 'Virgen dominica, doctora',
    meta: '1347–1380 · Doctor 1970',
    works: [
      { title: 'Diálogo de la Divina Providencia', sourceUrl: 'https://www.ccel.org/ccel/catherine' },
      { title: 'Cartas', sourceUrl: 'https://www.ccel.org/ccel/catherine' },
    ],
    themes: ['Iglesia', 'Reforma', 'Mística', 'Paz'],
  },
  {
    id: 'teresa-lisieux',
    name: 'Santa Teresa del Niño Jesús (de Lisieux)',
    initials: 'TL',
    era: DOCTORES_ERAS[4],
    years: '1873–1897',
    proclaimedYear: 1997,
    role: 'Virgen carmelita, doctora',
    meta: '1873–1897 · Doctor 1997',
    works: [
      { title: 'Historia de un alma', sourceUrl: 'https://archive.org/details/storyofasoulaut00theruoft' },
    ],
    themes: ['Infancia espiritual', 'Confianza', 'Misión'],
  },
  {
    id: 'hildegarda-bingen',
    name: 'Santa Hildegarda de Bingen',
    initials: 'HB',
    era: DOCTORES_ERAS[2],
    years: '1098–1179',
    proclaimedYear: 2012,
    role: 'Abadesa, doctora',
    meta: '1098–1179 · Doctor 2012',
    works: [
      { title: 'Scivias', sourceUrl: 'https://archive.org/details/scivias00hild' },
      { title: 'Liber divinorum operum', sourceUrl: 'https://archive.org/details/liberdivinorumop00hild' },
    ],
    themes: ['Visión', 'Cosmos', 'Música', 'Medicina'],
  },
  {
    id: 'juan-avila',
    name: 'San Juan de Ávila',
    initials: 'JA',
    era: DOCTORES_ERAS[3],
    years: '1499–1569',
    proclaimedYear: 2012,
    role: 'Presbítero, doctor',
    meta: '1499–1569 · Doctor 2012',
    works: [
      { title: 'Audi, filia', sourceUrl: 'https://www.cervantesvirtual.com/obra/audi-filia/' },
      { title: 'Tratados y cartas', sourceUrl: 'https://www.cervantesvirtual.com/obra/obras-completas-del-beato-maestro-juan-de-avila/' },
    ],
    themes: ['Predicación', 'Reforma', 'Espiritualidad'],
  },
  {
    id: 'gregorio-narek',
    name: 'San Gregorio de Narek',
    initials: 'GNa',
    era: DOCTORES_ERAS[1],
    years: 'c. 951–1003',
    proclaimedYear: 2015,
    role: 'Monje armenio, doctor',
    meta: 'c. 951–1003 · Doctor 2015',
    works: [
      { title: 'Libro de las Lamentaciones', sourceUrl: 'https://archive.org/details/bookofprayerofla00greg' },
    ],
    themes: ['Oración', 'Penitencia', 'Armenia'],
  },
  {
    id: 'ireneo-lyon',
    name: 'San Ireneo de Lyon',
    initials: 'IL',
    era: DOCTORES_ERAS[0],
    years: 'c. 130–202',
    proclaimedYear: 2022,
    role: 'Obispo de Lyon, doctor de la unidad',
    meta: 'c. 130–202 · Doctor 2022',
    quote: 'La gloria de Dios es el hombre viviente.',
    quoteSource: 'Adversus haereses IV, 20, 7',
    proclamationSourceUrl: 'https://www.vatican.va/content/francesco/la/apost_letters/documents/20220121-santireneo-dottoredellachiesa.html',
    works: [
      { title: 'Adversus haereses', sourceUrl: 'https://www.newadvent.org/fathers/0103.htm' },
      { title: 'Demostración de la predicación apostólica', sourceUrl: 'https://www.ccel.org/ccel/irenaeus/demonstr' },
    ],
    themes: ['Tradición', 'Unidad', 'Recapitulación', 'Herejías'],
  },
  {
    id: 'john-henry-newman',
    name: 'San John Henry Newman',
    initials: 'JHN',
    era: DOCTORES_ERAS[4],
    years: '1801–1890',
    proclaimedYear: 2025,
    role: 'Cardenal, doctor',
    meta: '1801–1890 · Doctor 2025',
    proclamationSourceUrl: 'https://www.vatican.va/content/leo-xiv/en/homilies/2025/documents/20251101-messa-giubileo-formatori.html',
    works: [
      { title: 'Essay on the Development of Christian Doctrine', sourceUrl: 'https://www.newmanreader.org/works/development/' },
      { title: 'Apologia pro Vita Sua', sourceUrl: 'https://www.newmanreader.org/works/apologia/' },
      { title: 'Grammar of Assent', sourceUrl: 'https://www.newmanreader.org/works/grammar/' },
      { title: 'Sermones y ensayos', sourceUrl: 'https://www.newmanreader.org/' },
    ],
    themes: ['Desarrollo doctrinal', 'Conciencia', 'Educación', 'Conversión'],
  },
];

export function doctorById(id: string): Doctor | undefined {
  return DOCTORES.find((d) => d.id === id);
}

export function doctoresByEra(): { era: string; items: Doctor[] }[] {
  const map = new Map<string, Doctor[]>();
  for (const d of DOCTORES) {
    const list = map.get(d.era) || [];
    list.push(d);
    map.set(d.era, list);
  }
  return DOCTORES_ERAS.map((era) => ({ era, items: map.get(era) || [] })).filter(
    (g) => g.items.length
  );
}

/** Obras con pack enlazable en el corpus. */
export function linkableWorks(d: Doctor): DoctorObra[] {
  return d.works.filter((w) => !!w.documentId);
}

/** Obras aún sin pack (pendientes o solo fuente externa). */
export function pendingWorks(d: Doctor): DoctorObra[] {
  return d.works.filter((w) => !w.documentId);
}

/** Todos los documentId referenciados por el catálogo (únicos). */
export function allLinkedDocumentIds(): string[] {
  const ids = new Set<string>();
  for (const d of DOCTORES) {
    for (const w of d.works) {
      if (w.documentId) ids.add(w.documentId);
    }
  }
  return [...ids].sort();
}

export const DOCTORES_COUNT = 38;

