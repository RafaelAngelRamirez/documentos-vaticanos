/**
 * Per-document historical-context overlays.
 * Multi-obra authors (esp. Agustín) get distinct chronology slices.
 */
import type {
  ContextAxes,
  ContextReference,
  DocumentContextOverlay,
  TimelineEntry,
} from '../../models/historical-context.model';
import { R } from './refs';
import { profileById } from './seed_profiles';

type PartialAxes = Partial<ContextAxes>;

interface DocSeed {
  documentId: string;
  authorProfileId: string;
  compositionYears?: string;
  compositionPlace?: string;
  workSummary: string;
  chronologyNote: string;
  axes?: PartialAxes;
  timelineSlice?: TimelineEntry[];
  references?: ContextReference[];
  sourceNote?: string;
}

const AG_NOTE =
  'Cronología de obra según consenso de manuales y BAC / Brown; las fechas de algunos sermones y cartas son aproximadas.';

/** Agustín: cada tomo del pack con tramo cronológico propio. */
const AGUSTIN_DOCS: DocSeed[] = [
  {
    documentId: 'agustin-01-primeros-escritos-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '386–391',
    compositionPlace: 'Casiciaco, Milán, Tagaste',
    workSummary:
      'Diálogos y opúsculos de la conversión y los primeros años africanos: filosofía cristiana, vida beata, orden, inmortalidad del alma y primeros combates intelectuales tras el bautismo.',
    chronologyNote:
      'Fase post-conversión y pre-presbiteral: del retiro de Casiciaco al regreso a Tagaste, antes del sacerdocio en Hipona (391).',
    timelineSlice: [
      { years: '386–387', label: 'Casiciaco y bautismo en Milán' },
      { years: '388–391', label: 'Comunidad de Tagaste; primeros tratados' },
    ],
    axes: {
      lugar:
        'Casiciaco (cerca de Milán), Milán ambrosiano y Tagaste numidiana: del aula imperial al retiro provinciano africano.',
      personajes:
        'Ambrosio; Mónica; Alipio; Navigio; Teodosio como trasfondo imperial en Italia.',
    },
    references: [R.brownAg, R.newadventAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-02-confesiones-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '397–400',
    compositionPlace: 'Hipona Regia',
    workSummary:
      'Autobiografía teológica y alabanza: de la infancia en Tagaste al robo de peras, Cartago, maniqueísmo, Italia, conversión y muerte de Mónica; cierra con exégesis del Génesis.',
    chronologyNote:
      'Primeros años del episcopado (consagrado c. 395–396): mirada retrospectiva ya como obispo pastor, no como neófito de Casiciaco.',
    timelineSlice: [
      { years: '397–400', label: 'Redacción de Confessiones en Hipona' },
      { years: '354–387', label: 'Vida narrada (nacimiento–bautismo)' },
    ],
    axes: {
      lugar:
        'Escenario narrado: Tagaste, Madaura, Cartago, Roma, Milán, Ostia; lugar de escritura: Hipona episcopal.',
      personajes:
        'Mónica, Patricio, Ambrosio, Alipio, Fausto maniqueo, Valerio de Hipona; Dios como interlocutor del texto.',
    },
    references: [R.confessions, R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-03-obras-filosoficas-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '386–395',
    compositionPlace: 'Italia y África',
    workSummary:
      'Tratados de cuño filosófico-cristiano (orden, música, libre albedrío temprano, magistro, etc.) que articulan platonismo cristiano y fe bíblica en la primera madurez.',
    chronologyNote:
      'Sobre todo etapa entre conversión y consolidación episcopal; base conceptual de obras posteriores más controvertidas.',
    timelineSlice: [
      { years: '386–395', label: 'Producción filosófica temprana y media' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-04-obras-apologeticas-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '390–410',
    compositionPlace: 'África del Norte',
    workSummary:
      'Defensa de la fe católica frente a paganos y críticos: utilidad de creer, verdadera religión, y opúsculos que preparan el clima de La ciudad de Dios.',
    chronologyNote:
      'Entre el presbiterado/episcopado temprano y el impacto del saqueo de Roma (410), cuando la apologética se vuelve historia teológica.',
    timelineSlice: [
      { years: '390–410', label: 'Apologética previa y colindante a 410' },
    ],
    references: [R.brownAg, R.cityOfGod],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-05-de-trinitate-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '399–419',
    compositionPlace: 'Hipona',
    workSummary:
      'Gran tratado trinitario latino: Escritura, tradición y analogías psicológicas (memoria, inteligencia, voluntad) al servicio del dogma niceno en Occidente.',
    chronologyNote:
      'Obra de madurez episcopal de dos décadas, paralela a donatismo y al inicio del pelagianismo; no es un opúsculo de juventud.',
    timelineSlice: [
      { years: '399–419', label: 'Composición prolongada del De Trinitate' },
    ],
    axes: {
      creenciaCristiana:
        'Trinidad consustancial en clave latina; economía y teología; imagen trinitaria en el mens humano; combate a residuales subordinacionistas.',
    },
    references: [R.kelly, R.brownAg, R.pelikan],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-06-gracia-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '396–412',
    compositionPlace: 'Hipona',
    workSummary:
      'Primer bloque de tratados sobre la gracia y el libre albedrío en transición hacia la controversia pelagiana abierta.',
    chronologyNote:
      'De las respuestas a Simpliciano (tras episcopado) hasta el umbral de 412, cuando Pelagio/Celestio fuerzan definiciones más duras.',
    timelineSlice: [
      { years: '396–397', label: 'Ad Simplicianum (gracia y elección)' },
      { years: '411–412', label: 'Apertura de la crisis pelagiana en África' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-07-sermones-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '391–430',
    compositionPlace: 'Hipona y África',
    workSummary:
      'Primer volumen de sermones pastorales: predicación litúrgica y moral al pueblo de Hipona a lo largo del ministerio.',
    chronologyNote:
      'Cubre todo el arco sacerdotal y episcopal; cada sermón es datable solo en parte — el conjunto es la voz del pastor africano, no un tratado sistemático de un solo año.',
    timelineSlice: [
      { years: '391–430', label: 'Predicación continua en Hipona' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-08-cartas-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '386–410',
    compositionPlace: 'África e Italia (corresponsales)',
    workSummary:
      'Epistolario temprano y medio: red de amistad, disciplina eclesial y primeras controversias antes del pleno pelagianismo.',
    chronologyNote:
      'Corresponde sobre todo a la fase anterior al gran corpus antipelagiano; incluye gobierno diocesano y lazos con Italia.',
    timelineSlice: [
      { years: '386–410', label: 'Cartas de juventud cristiana y episcopado medio' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-09-gracia-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '412–426',
    compositionPlace: 'Hipona',
    workSummary:
      'Segundo bloque sobre la gracia: pecado original, bautismo de niños, predestinación y polémica con pelagianos y semipelagianos incipientes.',
    chronologyNote:
      'Corazón de la controversia pelagiana (post-412), contemporáneo de partes de La ciudad de Dios y de sínodos africanos.',
    timelineSlice: [
      { years: '412–418', label: 'Anti-Pelagio y Celestio; sínodos africanos' },
      { years: '418–426', label: 'Profundación ante Juliano y Galia' },
    ],
    axes: {
      personajes:
        'Pelagio, Celestio, Juliano de Eclana; Zósimo e Inocencio de Roma; marseilleses en el horizonte tardío.',
    },
    references: [R.brownAg, R.kelly, R.pelikan],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-10-sermones-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '400–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Segunda colección de sermones: madurez oratoria en fiestas, santos y moral cotidiana africana.',
    chronologyNote:
      'Predicación de la madurez episcopal, en paralelo a donatismo tardío y pelagianismo.',
    timelineSlice: [
      { years: '400–420', label: 'Sermones de madurez' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-11-cartas-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '410–430',
    compositionPlace: 'Hipona',
    workSummary:
      'Cartas de la última fase: pelagianismo, disciplina, consulta a Roma y gobierno en África amenazada.',
    chronologyNote:
      'Epistolario tardío, distinto del primer tomo: voz del doctor de la gracia y del obispo bajo presión vándala final.',
    timelineSlice: [
      { years: '410–430', label: 'Cartas tardías' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-12-tratados-morales-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '388–420',
    compositionPlace: 'África',
    workSummary:
      'Ética cristiana: mentira, continencia, matrimonio, viudez, celo pastoral — aplicación práctica de la conversión del deseo.',
    chronologyNote:
      'Se extiende de los primeros años africanos a la madurez; no se reduce a una sola controversia dogmática.',
    timelineSlice: [
      { years: '388–420', label: 'Opúsculos morales a lo largo del ministerio' },
    ],
    references: [R.brownAg, R.odcc],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-13-evangelio-juan-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '406–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Tractatus in Ioannem (primera parte): exégesis homilética del Cuarto Evangelio en clave anti-donatista y trinitaria.',
    chronologyNote:
      'Predicación de madurez sobre Juan, en años en que la unidad de la Iglesia y la cristología pastoral son urgentes.',
    timelineSlice: [
      { years: '406–420', label: 'Homilías sobre el Evangelio de Juan (inicio y medio)' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-14-evangelio-juan-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '414–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Continuación de los tratados sobre Juan (approx. 36–124): profundidad mistagógica y eclesiológica.',
    chronologyNote:
      'Fase avanzada del ciclo joánico, posterior al arranque de los primeros tractatus; distinta “estación” exegética del tomo 1.',
    timelineSlice: [
      { years: '414–420', label: 'Tractatus in Ioannem tardíos' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-15-tratados-escriturarios-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '389–420',
    compositionPlace: 'África',
    workSummary:
      'Exégesis diversa (Génesis, Sermón de la Montaña, acuerdos evangélicos, etc.) que muestra el taller bíblico agustiniano.',
    chronologyNote:
      'Arco amplio: del Génesis contra maniqueos a obras de madurez hermenéutica (Doctrina christiana en el entorno).',
    timelineSlice: [
      { years: '389–420', label: 'Comentarios y tratados bíblicos varios' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-16-ciudad-de-dios-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '413–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Libros iniciales de De civitate Dei: respuesta al saqueo de Roma (410), crítica del paganismo y fundamentos de las dos ciudades.',
    chronologyNote:
      'Escritos tras 410 a petición de amigos (Marcelino et al.); primera mitad del gran proyecto histórico-teológico.',
    timelineSlice: [
      { years: '410', label: 'Saqueo de Roma por Alarico' },
      { years: '413–420', label: 'De civitate Dei, libros primeros' },
    ],
    axes: {
      lugar:
        'Hipona como taller; Roma saqueada como trauma del auditorio pagano-cristiano; Imperio de Occidente en descomposición.',
      gobierno:
        'Crisis del Occidente romano; milicias godas federadas; élites senatorias entre paganismo y cristianismo.',
    },
    references: [R.cityOfGod, R.brownAg, R.britannicaLateRome],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-17-ciudad-de-dios-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '420–426',
    compositionPlace: 'Hipona',
    workSummary:
      'Libros finales de La ciudad de Dios: orígenes, desarrollo y fines de las dos ciudades; escatología y paz eterna.',
    chronologyNote:
      'Segunda fase del De civitate Dei, en los años 420, ya en plena madurez antipelagiana — distinta de la apologética inmediata post-410 del tomo I.',
    timelineSlice: [
      { years: '420–426', label: 'De civitate Dei, libros finales' },
    ],
    references: [R.cityOfGod, R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-18-epistolas-indices-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '394–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Exposiciones sobre epístolas paulinas e índices: Pablo leído como doctor de la gracia antes y durante las polémicas.',
    chronologyNote:
      'Exégesis paulina que alimenta la teología de la gracia; puente entre lecturas tempranas de Romanos y la controversia pelagiana.',
    timelineSlice: [
      { years: '394–420', label: 'Comentarios paulinos e índices' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-19-enarraciones-salmos-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '392–418',
    compositionPlace: 'Hipona',
    workSummary:
      'Enarrationes in Psalmos (primer bloque): el salterio como voz de Cristo y de la Iglesia en la liturgia africana.',
    chronologyNote:
      'Proyecto de décadas desde el presbiterado; este tomo reúne la fase temprana-media del salterio comentado.',
    timelineSlice: [
      { years: '392–418', label: 'Enarrationes (bloque 1)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-20-enarraciones-salmos-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '400–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Segundo bloque de enarraciones: profundización eclesiológica y espiritual del salterio.',
    chronologyNote:
      'Fase media del ciclo, no idéntica al primer bloque ni a los salmos finales.',
    timelineSlice: [
      { years: '400–420', label: 'Enarrationes (bloque 2)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-21-enarraciones-salmos-3-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '405–422',
    compositionPlace: 'Hipona',
    workSummary:
      'Tercer bloque de enarraciones sobre los Salmos.',
    chronologyNote:
      'Predicación salmódica de madurez, contemporánea de Juan y de la Ciudad de Dios en parte.',
    timelineSlice: [
      { years: '405–422', label: 'Enarrationes (bloque 3)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-22-enarraciones-salmos-4-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '412–422',
    compositionPlace: 'Hipona',
    workSummary:
      'Cuarto bloque de enarraciones: cierre del salterio en la última gran fase exegética.',
    chronologyNote:
      'Tramo más tardío del proyecto salmódico, ya en clima pelagiano y de Ciudad de Dios.',
    timelineSlice: [
      { years: '412–422', label: 'Enarrationes (bloque 4, tardío)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-23-sermones-juan-hechos-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '400–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Sermones sobre escritos joánicos, Hechos y cartas: mistagogia y vida de la Iglesia primitiva aplicada a África.',
    chronologyNote:
      'Madurez homilética, distinta de los tractatus sistemáticos sobre el Evangelio de Juan.',
    timelineSlice: [
      { years: '400–420', label: 'Sermones bíblicos (Juan, Hechos, cartas)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-24-sermones-4-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '400–425',
    compositionPlace: 'Hipona',
    workSummary:
      'Sermones 184–272: santos, mártires y fiestas del calendario africano.',
    chronologyNote:
      'Ciclo festivo de la madurez; culto a los mártires norteafricanos en tensión con el donatismo.',
    timelineSlice: [
      { years: '400–425', label: 'Sermones de santos y fiestas (184–272)' },
    ],
    references: [R.brownAg, R.frend],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-25-sermones-5-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '405–430',
    compositionPlace: 'Hipona',
    workSummary:
      'Sermones 273–338: continuación del corpus homilético tardío.',
    chronologyNote:
      'Predicación de la última fase episcopal, parcialmente contemporánea del asedio final.',
    timelineSlice: [
      { years: '405–430', label: 'Sermones 273–338' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-26-sermones-6-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '410–430',
    compositionPlace: 'Hipona',
    workSummary:
      'Último bloque de sermones del pack: voz pastoral en la crisis del Occidente y de África.',
    chronologyNote:
      'Homilética tardía, cronológicamente posterior a los primeros tomos de sermones del corpus BAC.',
    timelineSlice: [
      { years: '410–430', label: 'Sermones del periodo final' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-27-escritos-biblicos-3-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '400–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Escritos bíblicos (tomo 3 del pack): exégesis de madurez sobre diversos libros.',
    chronologyNote:
      'Fase media-tardía del taller bíblico, distinta de los primeros comentarios anti-maniqueos.',
    timelineSlice: [
      { years: '400–420', label: 'Escritos bíblicos (bloque 3)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-28-escritos-biblicos-4-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '410–425',
    compositionPlace: 'Hipona',
    workSummary:
      'Escritos bíblicos (tomo 4): continuación del corpus exegético.',
    chronologyNote:
      'Contemporáneo de Ciudad de Dios y de la gracia; no es la exégesis de juventud.',
    timelineSlice: [
      { years: '410–425', label: 'Escritos bíblicos (bloque 4)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-29-escritos-biblicos-5-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '415–430',
    compositionPlace: 'Hipona',
    workSummary:
      'Escritos bíblicos (tomo 5): tramo más tardío de la exégesis agustiniana en el pack.',
    chronologyNote:
      'Última estación del ciclo bíblico del corpus, en los años finales del episcopado.',
    timelineSlice: [
      { years: '415–430', label: 'Escritos bíblicos (bloque 5, tardío)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-30-antimaniqueos-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '388–400',
    compositionPlace: 'África',
    workSummary:
      'Primer bloque anti-maniqueo: refutación del dualismo que Agustín había profesado en Cartago.',
    chronologyNote:
      'Fase temprana africana: el converso liquida cuentas con el maniqueísmo; anterior al donatismo álgido y al pelagianismo.',
    timelineSlice: [
      { years: '388–400', label: 'Tratados antimaniqueos tempranos' },
    ],
    axes: {
      religion:
        'Maniqueísmo norteafricano y mediterráneo: dualismo, electi/auditores, crítica del AT; catolicismo bíblico que defiende la bondad de la creación.',
    },
    references: [R.brownAg, R.chadwick],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-31-antimaniqueos-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '397–400',
    compositionPlace: 'Hipona',
    workSummary:
      'Contra Faustum y escritos antimaniqueos de consolidación: gran respuesta al obispo maniqueo Fausto.',
    chronologyNote:
      'Cumbre de la polémica maniquea, contemporánea de las Confesiones; distinta del primer ciclo 388–395.',
    timelineSlice: [
      { years: '397–400', label: 'Contra Faustum' },
    ],
    references: [R.brownAg, R.confessions],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-32-antidonatistas-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '400–405',
    compositionPlace: 'Hipona / África',
    workSummary:
      'Primer bloque antidonatista: unidad de la Iglesia, bautismo y polemica con la pars Donati.',
    chronologyNote:
      'Apertura de la gran ofensiva católica africana pre-Conferencia de Cartago (411).',
    timelineSlice: [
      { years: '400–405', label: 'Anti-donatismo temprano episcopal' },
    ],
    axes: {
      religion:
        'Cisma donatista: pureza de la Iglesia, rebautismo, mártires «verdaderos» vs. traditores; católicos apelan a la catolicidad universal.',
    },
    references: [R.brownAg, R.frend],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-33-antidonatistas-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '405–411',
    compositionPlace: 'África',
    workSummary:
      'Segundo bloque antidonatista hacia la Conferencia de Cartago de 411.',
    chronologyNote:
      'Fase álgida con presión imperial (edictos de Honorio) y preparación del collatio de 411 — no el mismo momento que el tomo 1 ni el 3.',
    timelineSlice: [
      { years: '405–411', label: 'Camino a la Conferencia de Cartago' },
      { years: '411', label: 'Collatio Carthaginensis' },
    ],
    references: [R.brownAg, R.frend],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-34-antidonatistas-3-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '411–420',
    compositionPlace: 'África',
    workSummary:
      'Tercer bloque antidonatista: consolidación tras 411 y disciplina de la reintegración.',
    chronologyNote:
      'Post-conferencia: victoria católica jurídica y pastoreo de reconciliación; paralelo al inicio pelagiano.',
    timelineSlice: [
      { years: '411–420', label: 'Anti-donatismo tardío / recepción de 411' },
    ],
    references: [R.brownAg, R.frend],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-35-antipelagianos-3-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '415–420',
    compositionPlace: 'Hipona',
    workSummary:
      'Escritos antipelagianos (bloque 3 del pack): gracia, peccatum originis y debate internacional.',
    chronologyNote:
      'Fase media de la controversia, con eco en Palestina y Roma; distinta de los primeros opúsculos de 412.',
    timelineSlice: [
      { years: '415–420', label: 'Anti-pelagianismo medio' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-36-antipelagianos-4-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '418–426',
    compositionPlace: 'Hipona',
    workSummary:
      'Bloque 4 antipelagiano: respuesta a Juliano de Eclana y matización de predestinación y perseverancia.',
    chronologyNote:
      'Fase “juliana”: polémica más técnica y dura que 412–415; Agustín anciano doctor de la gracia.',
    timelineSlice: [
      { years: '418–426', label: 'Contra Iulianum y afines' },
    ],
    references: [R.brownAg, R.kelly, R.pelikan],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-37-antipelagianos-5-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '426–430',
    compositionPlace: 'Hipona',
    workSummary:
      'Últimos escritos sobre la gracia y la predestinación (incl. correspondencia con Galia / Prosper).',
    chronologyNote:
      'Tramo final de la vida: semi-pelagianismo galo en el horizonte; muerte en 430 bajo asedio vándalo.',
    timelineSlice: [
      { years: '426–430', label: 'Últimos tratados de gracia; muerte en 430' },
    ],
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-38-antiarrianos-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '418–428',
    compositionPlace: 'Hipona',
    workSummary:
      'Escritos contra arrianos y otras herejías: el arrianismo reaparece con godos y vándalos en el Occidente tardío.',
    chronologyNote:
      'Última década: amenaza germánica arriana en África; distinta de las polémicas donatista y pelagiana clásicas.',
    timelineSlice: [
      { years: '418–428', label: 'Collatio cum Maximino y opúsculos antiarrianos' },
    ],
    axes: {
      religion:
        'Arrianismo germánico (vándalos/godos) frente al nicenismo africano; otras herejías residuales catalogadas por el obispo.',
    },
    references: [R.brownAg, R.kelly],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-39-varios-1-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '390–420',
    compositionPlace: 'África',
    workSummary:
      'Escritos varios (1): miscelánea de opúsculos pastorales y teológicos del ministerio medio.',
    chronologyNote:
      'Selección miscelánea de la etapa episcopal media; no un único año de composición.',
    timelineSlice: [
      { years: '390–420', label: 'Miscelánea episcopal (1)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
  {
    documentId: 'agustin-40-varios-2-es',
    authorProfileId: 'agustin-hipona',
    compositionYears: '410–430',
    compositionPlace: 'Hipona',
    workSummary:
      'Escritos varios (2): miscelánea de la fase tardía.',
    chronologyNote:
      'Bloque tardío, cronológicamente posterior al tomo de varios 1.',
    timelineSlice: [
      { years: '410–430', label: 'Miscelánea tardía (2)' },
    ],
    references: [R.brownAg],
    sourceNote: AG_NOTE,
  },
];

/** Non-Augustine patristic and other single works. */
const PATRISTIC_OTHER: DocSeed[] = [
  {
    documentId: 'carta-diogneto-es',
    authorProfileId: 'diogneto-anonimo',
    compositionYears: 's. II',
    compositionPlace: 'Mediterráneo oriental (incierto)',
    workSummary:
      'Apología anónima que explica la identidad cristiana ante un interlocutor pagano culto.',
    chronologyNote:
      'Generación subapostólica/apologética temprana, siglos antes de los concilios y del África de Cipriano o Agustín.',
    timelineSlice: [{ years: 's. II', label: 'Composición de la Epístola a Diogneto' }],
    references: [R.diognetus, R.chadwick],
  },
  {
    documentId: 'cirilo-jerusalen-catequesis-es',
    authorProfileId: 'cirilo-jerusalen',
    compositionYears: 'c. 350',
    compositionPlace: 'Jerusalén',
    workSummary:
      'Procatequesis y catequesis bautismales/mistagógicas en la Jerusalén constantiniana.',
    chronologyNote:
      'Mediados del s. IV, en plena disputa arriana y auge de la peregrinación a Tierra Santa.',
    timelineSlice: [{ years: 'c. 350', label: 'Catequesis jerosolimitanas' }],
    references: [R.cyril, R.kelly],
  },
  {
    documentId: 'clemente-alejandria-pedagogo-es',
    authorProfileId: 'clemente-alejandria',
    compositionYears: 'c. 190–200',
    compositionPlace: 'Alejandría',
    workSummary:
      'El Pedagogo: Cristo educador de la conducta cristiana en la metrópoli helenística.',
    chronologyNote:
      'Finales del s. II, escuela catequética alejandrina previa a la gran obra de Orígenes.',
    timelineSlice: [{ years: 'c. 190–200', label: 'Paedagogus' }],
    references: [R.clement, R.chadwick],
  },
  {
    documentId: 'cipriano-cartas-es',
    authorProfileId: 'cipriano-cartago',
    compositionYears: '249–258',
    compositionPlace: 'Cartago',
    workSummary:
      'Epistolario de gobierno eclesial, persecución, lapsi y unidad de la Iglesia.',
    chronologyNote:
      'Década final de Cipriano, de Decio a Valeriano; martirio en 258.',
    timelineSlice: [
      { years: '249–251', label: 'Persecución de Decio y lapsi' },
      { years: '255–258', label: 'Controversia bautismal y martirio' },
    ],
    references: [R.cyprian, R.frend],
  },
  {
    documentId: 'gregorio-nisa-gran-catequesis-es',
    authorProfileId: 'gregorio-nisa',
    compositionYears: 'c. 385',
    compositionPlace: 'Capadocia',
    workSummary:
      'Oratio catechetica magna: exposición de la fe para catequistas en clave capadocia.',
    chronologyNote:
      'Posterior a Constantinopla I (381); madurez de Gregorio como teólogo del Imperio teodosiano.',
    timelineSlice: [{ years: 'c. 385', label: 'Gran Catequesis' }],
    references: [R.gregoryNyssa, R.kelly],
  },
];

/** Councils: id base without -la/-es → profile + years. */
const COUNCIL_META: Record<
  string,
  { profile: string; years: string; place: string; summary: string; chrono: string }
> = {
  'jerusalen': {
    profile: 'era-concilio-jerusalen',
    years: 'c. 49–50',
    place: 'Jerusalén',
    summary: 'Asamblea apostólica sobre gentiles y la ley (Hechos 15).',
    chrono: 'Iglesia apostólica del s. I, bajo dominio romano de Judea.',
  },
  'nicea-i': {
    profile: 'era-concilios-antiguos',
    years: '325',
    place: 'Nicea (Bitinia)',
    summary: 'Primer concilio ecuménico: homoousios y credo frente a Arrio; Pascua.',
    chrono: 'Reinado de Constantino; paso del cristianismo perseguido al imperial.',
  },
  'constantinopla-i': {
    profile: 'era-concilios-antiguos',
    years: '381',
    place: 'Constantinopla',
    summary: 'Segundo ecuménico: divinidad del Espíritu; ampliación del credo niceno.',
    chrono: 'Teodosio I; consolidación nicena en Oriente.',
  },
  'efeso': {
    profile: 'era-concilios-antiguos',
    years: '431',
    place: 'Éfeso',
    summary: 'Tercer ecuménico: María Theotokos; condena de Nestorio.',
    chrono: 'Teodosio II; conflicto Alejandría–Constantinopla–Antioquía.',
  },
  'calcedonia': {
    profile: 'era-concilios-antiguos',
    years: '451',
    place: 'Calcedonia',
    summary: 'Cuarto ecuménico: dos naturalezas en una persona; Tomus de León.',
    chrono: 'Marciano y Pulqueria; definición calcedonia que divide Oriente.',
  },
  'constantinopla-ii': {
    profile: 'era-concilios-bizantinos',
    years: '553',
    place: 'Constantinopla',
    summary: 'Quinto ecuménico: Tres Capítulos; política religiosa de Justiniano.',
    chrono: 'Apogeo justinianeo; tensión con Occidente (Vigilio).',
  },
  'constantinopla-iii': {
    profile: 'era-concilios-bizantinos',
    years: '680–681',
    place: 'Constantinopla',
    summary: 'Sexto ecuménico: dos voluntades en Cristo; fin del monotelismo imperial.',
    chrono: 'Constantino IV; después de la crisis monotelita y Máximo Confesor.',
  },
  'nicea-ii': {
    profile: 'era-concilios-bizantinos',
    years: '787',
    place: 'Nicea',
    summary: 'Séptimo ecuménico: legitimidad del culto a los iconos.',
    chrono: 'Emperatriz Irene; primera restauración iconódula.',
  },
  'constantinopla-iv': {
    profile: 'era-concilios-medievales',
    years: '869–870',
    place: 'Constantinopla',
    summary: 'Concilio de 869–870 (recepción latina como VIII ecuménico) sobre Focio.',
    chrono: 'Cisma fociaño; Imperio macedonio temprano y papado romano.',
  },
  'lateran-i': {
    profile: 'era-concilios-medievales',
    years: '1123',
    place: 'Roma (Letrán)',
    summary: 'I Lateranense: paz de Worms, investiduras, reforma gregoriana consolidada.',
    chrono: 'Post-Querella de las Investiduras; papado reformador.',
  },
  'lateran-ii': {
    profile: 'era-concilios-medievales',
    years: '1139',
    place: 'Roma (Letrán)',
    summary: 'II Lateranense: disciplina clerical y paz en la Iglesia latina.',
    chrono: 'Mediados del s. XII; reforma continua.',
  },
  'lateran-iii': {
    profile: 'era-concilios-medievales',
    years: '1179',
    place: 'Roma (Letrán)',
    summary: 'III Lateranense: elección papal por 2/3; herejía y disciplina.',
    chrono: 'Alejandro III; cristiandad de las universidades nacientes.',
  },
  'lateran-iv': {
    profile: 'era-concilios-medievales',
    years: '1215',
    place: 'Roma (Letrán)',
    summary: 'IV Lateranense: confesión anual, transubstanciación, reforma bajo Inocencio III.',
    chrono: 'Cénit del papado medieval; cruzadas y derecho canónico clásico.',
  },
  'lyon-i': {
    profile: 'era-concilios-medievales',
    years: '1245',
    place: 'Lyon',
    summary: 'I de Lyon: deposición de Federico II; socorro a Tierra Santa.',
    chrono: 'Conflicto papado–Imperio; s. XIII mendicante.',
  },
  'lyon-ii': {
    profile: 'era-concilios-medievales',
    years: '1274',
    place: 'Lyon',
    summary: 'II de Lyon: unión (efímera) con griegos; cónclave regulado.',
    chrono: 'Gregorio X; Tomás de Aquino muere de camino; cruzada y unión.',
  },
  'vienne': {
    profile: 'era-concilios-medievales',
    years: '1311–1312',
    place: 'Vienne',
    summary: 'Concilio de Vienne: Templarios, pobreza franciscana, Tierra Santa.',
    chrono: 'Papado de Aviñón temprano; Felipe IV de Francia.',
  },
  'constanza': {
    profile: 'era-concilios-medievales',
    years: '1414–1418',
    place: 'Constanza',
    summary: 'Fin del Cisma de Occidente; condena de Hus; Haec sancta / Frequens.',
    chrono: 'Conciliarismo; crisis de la obediencia triple papal.',
  },
  'florencia': {
    profile: 'era-concilios-medievales',
    years: '1431–1445',
    place: 'Basilea / Ferrara / Florencia / Roma',
    summary: 'Unión con griegos (Laetentur caeli) y otras iglesias orientales (parcial/efímera).',
    chrono: 'Ocaso bizantino pre-1453; conciliarismo vs. papado.',
  },
  'lateran-v': {
    profile: 'era-concilios-medievales',
    years: '1512–1517',
    place: 'Roma (Letrán)',
    summary: 'V Lateranense: reforma pre-luterana incompleta; vísperas de la Reforma.',
    chrono: 'León X; humanismo romano; 1517 como horizonte protestante.',
  },
  'trento': {
    profile: 'era-trento',
    years: '1545–1563',
    place: 'Trento',
    summary: 'Concilio de la reforma católica: fe, sacramentos, disciplina.',
    chrono: 'Respuesta a la Reforma; Carlos V / Felipe II; cierre con Pío IV.',
  },
  'vat-i': {
    profile: 'era-vat1',
    years: '1869–1870',
    place: 'Roma (Vaticano)',
    summary: 'Dei Filius y Pastor Aeternus; fe e infalibilidad papal.',
    chrono: 'Pío IX; caída de Roma ante Italia (1870).',
  },
};

function councilSeeds(): DocSeed[] {
  const out: DocSeed[] = [];
  for (const [base, meta] of Object.entries(COUNCIL_META)) {
    for (const loc of ['la', 'es']) {
      const documentId = `${base}-${loc}`;
      out.push({
        documentId,
        authorProfileId: meta.profile,
        compositionYears: meta.years,
        compositionPlace: meta.place,
        workSummary:
          loc === 'la'
            ? `${meta.summary} Texto latino del pack conciliar.`
            : `${meta.summary} Traducción española del pack (ver sourceNote del corpus si es traducción generada).`,
        chronologyNote: meta.chrono,
        timelineSlice: [{ years: meta.years, label: `Concilio · ${meta.place}` }],
        references: [R.tanner, R.newadventCouncils],
        axes:
          loc === 'es'
            ? {
                cultura:
                  'Tradición textual latina del concilio recibida en lengua española moderna para lectura pastoral y de estudio; el original magisterial es latino (o griego en actas antiguas).',
              }
            : undefined,
      });
    }
  }
  return out;
}

/** Vatican II documents. */
const VAT2_DOCS: { id: string; title: string; years: string; kind: string }[] = [
  { id: 'sc-es', title: 'Sacrosanctum Concilium', years: '1963', kind: 'Constitución sobre la sagrada liturgia' },
  { id: 'im-es', title: 'Inter mirifica', years: '1963', kind: 'Decreto sobre los medios de comunicación' },
  { id: 'lg-es', title: 'Lumen gentium', years: '1964', kind: 'Constitución dogmática sobre la Iglesia' },
  { id: 'ur-es', title: 'Unitatis redintegratio', years: '1964', kind: 'Decreto sobre el ecumenismo' },
  { id: 'oe-es', title: 'Orientalium Ecclesiarum', years: '1964', kind: 'Decreto sobre las Iglesias orientales' },
  { id: 'cd-es', title: 'Christus Dominus', years: '1965', kind: 'Decreto sobre el oficio pastoral de los obispos' },
  { id: 'pc-es', title: 'Perfectae caritatis', years: '1965', kind: 'Decreto sobre la renovación de la vida religiosa' },
  { id: 'ot-es', title: 'Optatam totius', years: '1965', kind: 'Decreto sobre la formación sacerdotal' },
  { id: 'ge-es', title: 'Gravissimum educationis', years: '1965', kind: 'Declaración sobre la educación cristiana' },
  { id: 'na-es', title: 'Nostra aetate', years: '1965', kind: 'Declaración sobre las religiones no cristianas' },
  { id: 'dv-es', title: 'Dei verbum', years: '1965', kind: 'Constitución dogmática sobre la divina revelación' },
  { id: 'aa-es', title: 'Apostolicam actuositatem', years: '1965', kind: 'Decreto sobre el apostolado de los laicos' },
  { id: 'dh-es', title: 'Dignitatis humanae', years: '1965', kind: 'Declaración sobre la libertad religiosa' },
  { id: 'ag-es', title: 'Ad gentes', years: '1965', kind: 'Decreto sobre la actividad misionera' },
  { id: 'po-es', title: 'Presbyterorum ordinis', years: '1965', kind: 'Decreto sobre el ministerio de los presbíteros' },
  { id: 'gs-es', title: 'Gaudium et spes', years: '1965', kind: 'Constitución pastoral sobre la Iglesia en el mundo actual' },
];

function vat2Seeds(): DocSeed[] {
  return VAT2_DOCS.map((d) => ({
    documentId: d.id,
    authorProfileId: 'era-vat2',
    compositionYears: d.years,
    compositionPlace: 'Ciudad del Vaticano (aula conciliar)',
    workSummary: `${d.title}: ${d.kind}, promulgado en el Concilio Vaticano II (${d.years}).`,
    chronologyNote: `Documento del periodo conciliar 1962–1965; promulgación en ${d.years} bajo Pablo VI (SC e IM bajo el arco Juan XXIII/Pablo VI).`,
    timelineSlice: [
      { years: '1962–1965', label: 'Concilio Vaticano II' },
      { years: d.years, label: `Promulgación de ${d.title}` },
    ],
    references: [R.vat2, R.tanner],
  }));
}

interface MagDoc {
  id: string;
  profile: string;
  years: string;
  place?: string;
  summary: string;
  chrono: string;
  refs?: ContextReference[];
}

const MAGISTERIUM: MagDoc[] = [
  { id: 'cic-es', profile: 'issuer-jp2', years: '1992/1997', summary: 'Catecismo de la Iglesia Católica, exposición orgánica de la fe postconciliar.', chrono: 'Pontificado de Juan Pablo II; edición típica latina 1997 tras la francesa de 1992.', refs: [R.cic, R.jpii] },
  { id: 'catecismo-romano-es', profile: 'era-trento', years: '1566', summary: 'Catecismo Romano ad parochos, instrumento tridentino de reforma pastoral.', chrono: 'Inmediatamente posterior a Trento, bajo Pío V.', refs: [R.romanCatechism, R.trent] },
  { id: 'catecismo-romano-la', profile: 'era-trento', years: '1566', summary: 'Catechismus Romanus (texto latino).', chrono: '1566, aplicación de Trento.', refs: [R.romanCatechism, R.trent] },
  { id: 'bible-pueblo-de-dios-es', profile: 'sagrada-escritura', years: '1980 (ed. ES)', place: 'Tradición bíblica multiperiodo', summary: 'Biblia completa en español (edición Pueblo de Dios) para lectura eclesial.', chrono: 'Canon antiguo; traducción moderna hispana del s. XX.', refs: [R.bible] },
  { id: 'cdc-es', profile: 'issuer-canon-law', years: '1983', summary: 'Código de Derecho Canónico de la Iglesia latina.', chrono: 'Juan Pablo II; codificación post-Vaticano II.', refs: [R.cdc, R.jpii] },
  { id: 'cceo-la', profile: 'issuer-canon-law', years: '1990', summary: 'Código de los Cánones de las Iglesias Orientales (latín).', chrono: 'Juan Pablo II; paralelismo oriental al CIC 83.', refs: [R.cceo, R.jpii] },
  { id: 'cceo-es', profile: 'issuer-canon-law', years: '1990', summary: 'Código de los Cánones de las Iglesias Orientales (español).', chrono: 'Juan Pablo II; traducción/recepción del CCEO 1990.', refs: [R.cceo, R.jpii, R.holySeeArchive] },
  { id: 'ds-es', profile: 'issuer-denzinger', years: 'ed. moderna', summary: 'Enchiridion symbolorum (Denzinger-Schönmetzer) en uso de estudio.', chrono: 'Compilación s. XIX–XX de textos magisteriales de todos los siglos.', refs: [R.denzinger] },
  { id: 'cds-es', profile: 'issuer-jp2', years: '2004', summary: 'Compendio de la Doctrina Social de la Iglesia (PCJP).', chrono: 'Final del pontificado de Juan Pablo II; síntesis del corpus social.', refs: [R.cds, R.jpii] },
  { id: 'hv-es', profile: 'issuer-paul-vi', years: '1968', summary: 'Humanae vitae: regulación de la natalidad y amor conyugal.', chrono: 'Recepción conflictiva del Vaticano II; julio de 1968.', refs: [R.paulvi] },
  { id: 'en-es', profile: 'issuer-paul-vi', years: '1975', summary: 'Evangelii nuntiandi: evangelización en el mundo contemporáneo.', chrono: 'Sínodo 1974; Pablo VI.', refs: [R.paulvi] },
  { id: 'pp-es', profile: 'issuer-paul-vi', years: '1967', summary: 'Populorum progressio: desarrollo de los pueblos.', chrono: 'Postconcilio inmediato; Tercer Mundo y descolonización.', refs: [R.paulvi] },
  { id: 'mc-es', profile: 'issuer-paul-vi', years: '1974', summary: 'Marialis cultus: culto mariano renovado.', chrono: 'Recepción litúrgica y mariológica postconciliar.', refs: [R.paulvi] },
  { id: 'mf-es', profile: 'issuer-paul-vi', years: '1965', summary: 'Mysterium fidei: eucaristía en el clima conciliar.', chrono: 'Año final del Vaticano II.', refs: [R.paulvi, R.vat2] },
  { id: 'cpd-es', profile: 'issuer-paul-vi', years: '1968', summary: 'Credo del Pueblo de Dios.', chrono: 'Año de Humanae vitae; profesión de fe ampliada.', refs: [R.paulvi] },
  { id: 'pt-es', profile: 'issuer-john-xxiii', years: '1963', summary: 'Pacem in terris: paz y derechos en el orden internacional.', chrono: 'Guerra Fría; último año de Juan XXIII.', refs: [R.johnxxiii] },
  { id: 'rh-es', profile: 'issuer-jp2', years: '1979', summary: 'Redemptor hominis: primera encíclica cristocéntrica de JPII.', chrono: 'Inicio del pontificado (1978–).', refs: [R.jpii] },
  { id: 'dm-es', profile: 'issuer-jp2', years: '1980', summary: 'Dives in misericordia.', chrono: 'Primeros años de JPII.', refs: [R.jpii] },
  { id: 'le-es', profile: 'issuer-jp2', years: '1981', summary: 'Laborem exercens: trabajo humano.', chrono: 'Noventa años de Rerum novarum; Polonia Solidarnošč.', refs: [R.jpii] },
  { id: 'srs-es', profile: 'issuer-jp2', years: '1987', summary: 'Sollicitudo rei socialis.', chrono: 'Veinte años de Populorum progressio; Guerra Fría tardía.', refs: [R.jpii] },
  { id: 'ca-es', profile: 'issuer-jp2', years: '1991', summary: 'Centesimus annus: post-1989 y economía.', chrono: 'Centenario de Rerum novarum; después del muro de Berlín.', refs: [R.jpii] },
  { id: 'vs-es', profile: 'issuer-jp2', years: '1993', summary: 'Veritatis splendor: fundamentos de la moral.', chrono: 'Debate moral postconciliar; años 90.', refs: [R.jpii] },
  { id: 'ev-es', profile: 'issuer-jp2', years: '1995', summary: 'Evangelium vitae: valor de la vida humana.', chrono: 'Cultura de la muerte vs. cultura de la vida; años 90.', refs: [R.jpii] },
  { id: 'ut-es', profile: 'issuer-jp2', years: '1995', summary: 'Ut unum sint (si presente) / ecumenismo JPII — placeholder map.', chrono: 'Ecumenismo de JPII.', refs: [R.jpii] },
  { id: 'md-es', profile: 'issuer-jp2', years: '1988', summary: 'Mulieris dignitatem: dignidad de la mujer.', chrono: 'Año mariano; antropología teológica de JPII.', refs: [R.jpii] },
  { id: 'cl-es', profile: 'issuer-jp2', years: '1988', summary: 'Christifideles laici: vocación de los laicos.', chrono: 'Sínodo de los laicos 1987.', refs: [R.jpii] },
  { id: 'rm-es', profile: 'issuer-jp2', years: '1990', summary: 'Redemptoris missio: misión ad gentes.', chrono: '25 años de Ad gentes.', refs: [R.jpii, R.vat2] },
  { id: 'pdv-es', profile: 'issuer-jp2', years: '1992', summary: 'Pastores dabo vobis: formación sacerdotal.', chrono: 'Sínodo sobre sacerdotes.', refs: [R.jpii] },
  { id: 'pg-es', profile: 'issuer-jp2', years: '2003', summary: 'Pastores gregis: ministerio episcopal.', chrono: 'Sínodo de obispos; final del pontificado.', refs: [R.jpii] },
  { id: 'rp-es', profile: 'issuer-jp2', years: '1984', summary: 'Reconciliatio et paenitentia.', chrono: 'Sínodo sobre penitencia.', refs: [R.jpii] },
  { id: 'sa-es', profile: 'issuer-jp2', years: '1984', summary: 'Salvifici doloris: sentido cristiano del sufrimiento.', chrono: 'Año de la Redención.', refs: [R.jpii] },
  { id: 'dev-es', profile: 'issuer-jp2', years: '1986', summary: 'Dominum et Vivificantem: Espíritu Santo.', chrono: 'Trilogía trinitaria de JPII.', refs: [R.jpii] },
  { id: 'ct-es', profile: 'issuer-jp2', years: '1979', summary: 'Catechesi tradendae.', chrono: 'Sínodo de la catequesis; inicios de JPII.', refs: [R.jpii] },
  { id: 'fc-es', profile: 'issuer-jp2', years: '1981', summary: 'Familiaris consortio: familia cristiana.', chrono: 'Sínodo de la familia 1980.', refs: [R.jpii] },
  { id: 'nmi-es', profile: 'issuer-jp2', years: '2001', summary: 'Novo millennio ineunte: inicio del tercer milenio.', chrono: 'Después del Gran Jubileo 2000.', refs: [R.jpii] },
  { id: 'tma-es', profile: 'issuer-jp2', years: '1994', summary: 'Tertio millennio adveniente: preparación del Jubileo.', chrono: 'Camino al año 2000.', refs: [R.jpii] },
  { id: 'ee-es', profile: 'issuer-jp2', years: '2003', summary: 'Ecclesia de Eucharistia.', chrono: 'Final del pontificado; Año de la Eucaristía en el horizonte.', refs: [R.jpii] },
  { id: 'vc-es', profile: 'issuer-jp2', years: '1996', summary: 'Vita consecrata.', chrono: 'Sínodo sobre vida consagrada.', refs: [R.jpii] },
  { id: 'vd-es', profile: 'issuer-b16', years: '2010', summary: 'Verbum Domini: Palabra de Dios en la vida y la misión de la Iglesia; lectio divina (nn. 86–87).', chrono: 'Sínodo sobre la Palabra de Dios (2008); Benedicto XVI.', refs: [R.vat2, R.holySeeArchive] },
  { id: 'mm-es', profile: 'issuer-jp2', years: '1961', summary: 'Mater et Magistra — nota: Juan XXIII; si el pack lo lista bajo otro, se mantiene año histórico.', chrono: 'Juan XXIII; doctrina social preconciliar inmediata.', refs: [R.johnxxiii] },
  { id: 'libertas-es', profile: 'issuer-leo-xiii', years: '1888', summary: 'Libertas praestantissimum: libertad humana y ley.', chrono: 'León XIII; Europa liberal del XIX.', refs: [R.leoxiii] },
  { id: 'immortale-dei-es', profile: 'issuer-leo-xiii', years: '1885', summary: 'Immortale Dei: constitución cristiana de los Estados.', chrono: 'León XIII; cuestión romana y Estados modernos.', refs: [R.leoxiii] },
  { id: 'diuturnum-es', profile: 'issuer-leo-xiii', years: '1881', summary: 'Diuturnum illud: origen del poder civil.', chrono: 'Inicios de León XIII.', refs: [R.leoxiii] },
  { id: 'quas-primas-es', profile: 'issuer-pius-xi', years: '1925', summary: 'Quas primas: fiesta de Cristo Rey.', chrono: 'Entreguerras; Acción Católica.', refs: [R.piusxi] },
  { id: 'quanta-cura-es', profile: 'issuer-pius-ix', years: '1864', summary: 'Quanta cura y el Syllabus errorum.', chrono: 'Pío IX; antiliberalismo doctrinal pre-Vaticano I.', refs: [R.quantaCura] },
  { id: 'quanta-cura-la', profile: 'issuer-pius-ix', years: '1864', summary: 'Quanta cura (texto latino).', chrono: '1864.', refs: [R.quantaCura] },
  // Curia / CDF / other
  { id: 'donum-vitae-es', profile: 'issuer-curia-moderna', years: '1987', summary: 'Donum vitae: bioética de la procreación (CDF).', chrono: 'CDF bajo JPII; técnicas de reproducción.', refs: [R.b16, R.jpii] },
  { id: 'persona-humana-es', profile: 'issuer-curia-moderna', years: '1975', summary: 'Persona humana: ética sexual (CDF).', chrono: 'Pablo VI / CDF postconciliar.', refs: [R.b16, R.paulvi] },
  { id: 'donum-veritatis-es', profile: 'issuer-curia-moderna', years: '1990', summary: 'Donum veritatis: vocación del teólogo.', chrono: 'CDF; relación magisterio–teólogos.', refs: [R.b16] },
  { id: 'mysterium-ecclesiae-es', profile: 'issuer-curia-moderna', years: '1973', summary: 'Mysterium Ecclesiae: eclesiología y disenso.', chrono: 'CDF; recepción del Vaticano II.', refs: [R.b16, R.paulvi] },
  { id: 'libertatis-conscientia-es', profile: 'issuer-curia-moderna', years: '1986', summary: 'Libertatis conscientia: libertad cristiana y liberación.', chrono: 'CDF; debate con teologías de la liberación.', refs: [R.b16, R.jpii] },
  { id: 'iura-et-bona-es', profile: 'issuer-curia-moderna', years: '1980', summary: 'Iura et bona (Declaración sobre la eutanasia).', chrono: 'CDF; bioética de final de vida.', refs: [R.b16] },
  { id: 'indulgentiarum-doctrina-es', profile: 'issuer-curia-moderna', years: '1967', summary: 'Indulgentiarum doctrina: indulgencias postconcilio.', chrono: 'Pablo VI; reforma de indulgencias.', refs: [R.paulvi] },
  { id: 'gdc-es', profile: 'issuer-curia-moderna', years: '1997', summary: 'Directorio General para la Catequesis.', chrono: 'Congregación para el Clero; post-Catecismo.', refs: [R.jpii, R.cic] },
  { id: 'dcg-es', profile: 'issuer-curia-moderna', years: '1971', summary: 'Directorio Catequético General.', chrono: 'Primer directorio postconciliar.', refs: [R.paulvi] },
  { id: 'pastoralis-actio-es', profile: 'issuer-curia-moderna', years: '1980', summary: 'Pastoralis actio: pastoral de los sacramentos (matrimonio).', chrono: 'Concilio + CIC en preparación.', refs: [R.jpii] },
];

// Fix mm-es profile to john xxiii
MAGISTERIUM.forEach((m) => {
  if (m.id === 'mm-es') m.profile = 'issuer-john-xxiii';
});

function magisteriumSeeds(): DocSeed[] {
  return MAGISTERIUM.map((m) => ({
    documentId: m.id,
    authorProfileId: m.profile,
    compositionYears: m.years,
    compositionPlace: m.place || 'Roma / Ciudad del Vaticano',
    workSummary: m.summary,
    chronologyNote: m.chrono,
    timelineSlice: [{ years: m.years, label: m.summary.slice(0, 80) }],
    references: m.refs || [R.odcc],
  }));
}

/** Build full list; last write wins on duplicate ids. */
export function buildAllDocumentSeeds(): DocumentContextOverlay[] {
  const map = new Map<string, DocSeed>();
  const all = [
    ...AGUSTIN_DOCS,
    ...PATRISTIC_OTHER,
    ...councilSeeds(),
    ...vat2Seeds(),
    ...magisteriumSeeds(),
  ];
  for (const s of all) {
    if (s.documentId === 'ut-es') continue; // not in corpus
    map.set(s.documentId, s);
  }

  // Drop seeds whose profile is missing (safety)
  const overlays: DocumentContextOverlay[] = [];
  for (const s of map.values()) {
    if (!profileById(s.authorProfileId)) {
      console.warn('missing profile', s.authorProfileId, 'for', s.documentId);
      continue;
    }
    overlays.push({
      documentId: s.documentId,
      authorProfileId: s.authorProfileId,
      compositionYears: s.compositionYears,
      compositionPlace: s.compositionPlace,
      workSummary: s.workSummary,
      chronologyNote: s.chronologyNote,
      axes: s.axes,
      timelineSlice: s.timelineSlice,
      references: s.references,
      sourceNote:
        s.sourceNote ||
        'Síntesis histórica compilada para el pack offline; ver referencias.',
    });
  }
  return overlays;
}
