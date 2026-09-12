/**
 * Author / era / issuer profiles for historical context (offline pack).
 * Compiled digests with external references — not peer-reviewed monographs.
 */
import type {
  AuthorContextProfile,
  ContextAxes,
} from '../../models/historical-context.model';
import { R } from './refs';

function axes(a: ContextAxes): ContextAxes {
  return a;
}

const NOTE =
  'Síntesis histórica compilada para el pack offline Documentos Vaticanos; verificar con las referencias citadas. No sustituye monografía experta.';

export const AUTHOR_PROFILES: AuthorContextProfile[] = [
  {
    id: 'agustin-hipona',
    name: 'Agustín de Hipona',
    kind: 'author',
    years: '354–430',
    saintId: 'agustin-hipona',
    summary:
      'Aurelio Agustín (Tagaste, 354 – Hipona, 430) es el gran teólogo del Occidente latino tardoantiguo. Formado en retórica en Cartago e Italia, pasó del maniqueísmo y el escepticismo a la conversión cristiana (Milán, 386–387), el presbiterado y el episcopado en Hipona Regia (África del Norte romana). Su obra abarca confesión autobiográfica, controversias (maniqueos, donatistas, pelagianos), exégesis y una teología de la gracia y de la historia que marcó la Edad Media y la Reforma.',
    axes: axes({
      lugar:
        'Numidia y Proconsular África (Tagaste, Madaura, Cartago, Hipona Regia, en la actual Argelia/Túnez); estancias formativas en Roma y Milán; red eclesiástica norteafricana bajo dominio romano occidental y, al final de su vida, presión vándala.',
      personajes:
        'Mónica (madre); Ambrosio de Milán; Alipio; Posidio (biógrafo); Fausto de Milevi (maniqueo); Donato y líderes donatistas; Pelagio, Celestio y Juliano de Eclana; emperadores de la dinastía teodosiana y funcionarios africanos; Alarico (saqueo de Roma, 410) como trasfondo de La ciudad de Dios.',
      gobierno:
        'Imperio romano tardío: tetrarquía heredada y monarquía teodosiana, capitales móviles, prefecturas y provincias. En África, curias municipales y coloniae; el poder imperial coopera cada vez más con la Iglesia católica frente a disidencias. Tras 410 el Occidente se fragiliza; en 429–430 los vándalos entran en África y asedian Hipona cuando muere Agustín.',
      cultura:
        'Latín literario y retórica ciceroniana; escuelas de gramática y retórica; neoplatonismo (Plotino/Porfirio vía Ambrosio y traducciones); Biblia latina (pre-Vulgata y, después, influencia de Jerónimo); intercambio epistolar como forma pública de disputa y pastoreo.',
      religion:
        'Cristianismo católico en consolidación imperial; maniqueísmo dualista (que Agustín combatió tras haberlo profesado); donatismo norteafricano (Iglesia de los «puros»); cultos tradicionales romanos y africanos residuales; judaísmo local; primeras tensiones con el arrianismo germánico de los vándalos.',
      antropologia:
        'Sociedad estamental romana: honestiores/humiliores, esclavitud, colonato, familia patriarcal y matrimonio romano. Honor retórico y patronazgo. Vida monástica y clero cada vez más definidos. Cuerpo y sexualidad leídos en clave de concupiscencia y gracia en la madurez agustiniana.',
      creenciasMundanas:
        'Astrología y fatum; ideal estoico y cínico residual; prestigio de la filosofía como camino de sabiduría; orgullo cívico romano tras el saqueo de 410; magia y supersticiones populares que los sermones corrigen.',
      creenciaCristiana:
        'Cristianismo niceno-católico latino: Trinidad, Cristo mediador, gracia eficaz, pecado original, unidad de la Iglesia y eficacia de los sacramentos incluso administrados por ministros indignos (anti-donatista). Eclesiología y escatología de las dos ciudades.',
    }),
    timeline: [
      { years: '354', label: 'Nacimiento en Tagaste' },
      { years: '371–383', label: 'Estudios y enseñanza en Cartago; maniqueísmo' },
      { years: '383–386', label: 'Roma y Milán; crisis y conversión' },
      { years: '387–391', label: 'Bautismo; regreso a África; primeros diálogos' },
      { years: '391–395', label: 'Presbítero en Hipona' },
      { years: '395–430', label: 'Obispo de Hipona; grandes tratados y controversias' },
      { years: '397–400', label: 'Confesiones' },
      { years: '399–419', label: 'De Trinitate (composición prolongada)' },
      { years: '400–412', label: 'Pico de la controversia donatista' },
      { years: '412–430', label: 'Controversia pelagiana' },
      { years: '413–426', label: 'De civitate Dei' },
      { years: '430', label: 'Muerte durante el asedio vándalo de Hipona' },
    ],
    references: [R.brownAg, R.newadventAg, R.chadwick, R.kelly, R.confessions, R.cityOfGod],
    sourceNote: NOTE,
  },
  {
    id: 'cirilo-jerusalen',
    name: 'Cirilo de Jerusalén',
    kind: 'author',
    years: 'c. 313–386',
    saintId: 'cirilo-jerusalen',
    summary:
      'Cirilo, obispo de Jerusalén en el siglo IV, es recordado por sus Catequesis a candidatos al bautismo y a los recién iniciados. Su sede es el corazón de la geografía sagrada cristiana tras Constantino: basílicas en el Gólgota y el Santo Sepulcro, peregrinación y liturgia de Semana Santa que Egeria describirá poco después.',
    axes: axes({
      lugar:
        'Jerusalén y Palestina romana/bizantina temprana; entorno de la Anastasis y del Martyrium constantinianos; relaciones con Cesarea marítima (metrópoli eclesiástica rival en prestigio).',
      personajes:
        'Constantino y sucesores; Acacio de Cesarea; Máximo y otros predecesores en la sede; emperadores involucrados en exilios arrianos; catecúmenos de la ciudad santa.',
      gobierno:
        'Imperio romano cristiano de Oriente: administración provincial de Palestina, intervención imperial en sínodos y destierros episcopales según oscilaciones arrianas/nicenas.',
      cultura:
        'Griego eclesiástico; tipología bíblica; catequesis oral convertida en texto; arte y arquitectura constantiniana de Tierra Santa; peregrinación como fenómeno social nuevo.',
      religion:
        'Cristianismo en disputa niceno-arriana; judaísmo presente en Palestina; residuales cultos paganos; creciente sacralización de lugares bíblicos.',
      antropologia:
        'Iniciación bautismal de adultos; ayunos; renuncias rituales; familia y patronazgo urbano en una ciudad transformada por el turismo religioso imperial.',
      creenciasMundanas:
        'Sabiduría helenística residual; astrología; prestigio de oráculos y magia que la catequesis confuta; identidad cívica helenístico-romana en Oriente.',
      creenciaCristiana:
        'Fe nicena (con matices de la época pre-Constantinopla I); centralidad de la Encarnación, la cruz y la resurrección; sacramentos de iniciación (bautismo, unción, eucaristía) como entrada a la Iglesia.',
    }),
    timeline: [
      { years: 'c. 350', label: 'Episcopado en Jerusalén; Catequesis' },
      { years: '325–381', label: 'Era de Nicea a Constantinopla I' },
      { years: '381', label: 'Concilio de Constantinopla I (marco dogmático)' },
    ],
    references: [R.cyril, R.chadwick, R.kelly, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'clemente-alejandria',
    name: 'Clemente de Alejandría',
    kind: 'author',
    years: 'c. 150–c. 215',
    saintId: 'clemente-alejandria',
    summary:
      'Tito Flavio Clemente enseñó en la escuela catequética de Alejandría. El Pedagogo presenta a Cristo como educador de la vida cotidiana cristiana en una metrópoli helenística cosmopolita, dialogando con la filosofía griega sin abandonar la Escritura.',
    axes: axes({
      lugar:
        'Alejandría de Egipto: gran puerto del Imperio, Museion, barrios judíos y griegos, sede del prefecto de Egipto.',
      personajes:
        'Panteno (maestro tradicional); Orígenes (sucesión intelectual); emperadores severianos; intelectuales medioplatónicos y estoicos del ambiente alejandrino.',
      gobierno:
        'Principado romano; Egipto como provincia imperial especial bajo prefecto ecuestre; fiscalidad del grano hacia Roma; episodios de presión sobre cristianos (Severos).',
      cultura:
        'Paideia griega, retórica y filosofía; biblioteca y tradición académica; alegoría bíblica; griego koiné literario.',
      religion:
        'Cristianismo en consolidación doctrinal; judaísmo helenístico; cultos isíacos y grecorromanos; gnosticismo y corrientes sincretistas que Clemente matiza o combate.',
      antropologia:
        'Ética del vestido, banquete, sexualidad y riqueza en el Pedagogo; hogares urbanos; esclavitud doméstica; ideal del «verdadero gnosticismo» cristiano como perfección moral.',
      creenciasMundanas:
        'Filosofía como propedéutica; supersticiones y magia popular; culto imperial; ideal cínico/estoico del sabio.',
      creenciaCristiana:
        'Logos cristología; continuidad entre razón y revelación; Iglesia como pedagogía hacia la divinización moral; Escritura leída alegóricamente junto al sentido literal.',
    }),
    timeline: [
      { years: 'c. 180–200', label: 'Actividad docente en Alejandría' },
      { years: 'c. 190–200', label: 'Composición del Pedagogo y el Protréptico' },
    ],
    references: [R.clement, R.chadwick, R.pelikan, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'cipriano-cartago',
    name: 'Cipriano de Cartago',
    kind: 'author',
    years: 'c. 200–258',
    saintId: 'cipriano-cartago',
    summary:
      'Cecilio Cipriano, obispo de Cartago y mártir (258), es la gran voz latina de la unidad de la Iglesia en el siglo III. Sus cartas documentan persecuciones (Decio, Valeriano), el problema de los lapsi y la controversia bautismal con Roma.',
    axes: axes({
      lugar:
        'Cartago y África proconsular; red de obispos norteafricanos; relaciones con Roma (Cornelio, Esteban).',
      personajes:
        'Tertuliano (influencia literaria); Cornelio y Esteban de Roma; Novaciano; emperadores Decio y Valeriano; confesores y lapsi de la persecución.',
      gobierno:
        'Crisis del siglo III: emperadores militares, edicto de Decio (sacrificios públicos), confiscaciones y ejecuciones bajo Valeriano; administración provincial aún romana.',
      cultura:
        'Latín cristiano africano; retórica forense de Cipriano (formación jurídica); epistolario como gobierno eclesial; memorias de mártires.',
      religion:
        'Cristianismo latino pre-niceno; culto imperial como prueba de lealtad; residuales cultos púnicos/romanos; debate sobre pureza de la Iglesia y rebautismo.',
      antropologia:
        'Honor y apostasía bajo coacción; redes de caridad episcopal; viudas y pobres; martirio como modelo de identidad.',
      creenciasMundanas:
        'Religión cívica romana; magia y oráculos; miedo al fatum en crisis imperial.',
      creenciaCristiana:
        'Una Iglesia, un episcopado (De ecclesiae catholicae unitate); validez ministerial ligada a la comunión católica; bautismo y penitencia de los lapsi; martirio como testimonio supremo.',
    }),
    timeline: [
      { years: '248/249', label: 'Episcopado en Cartago' },
      { years: '250–251', label: 'Persecución de Decio; cuestión de los lapsi' },
      { years: '255–256', label: 'Controversia bautismal con Esteban de Roma' },
      { years: '258', label: 'Martirio bajo Valeriano' },
    ],
    references: [R.cyprian, R.chadwick, R.frend, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'gregorio-nisa',
    name: 'Gregorio de Nisa',
    kind: 'author',
    years: 'c. 335–c. 395',
    saintId: 'gregorio-nisa',
    summary:
      'Gregorio de Nisa, hermano de Basilio Magno y amigo de Gregorio Nacianceno (los «tres capadocios»), es teólogo místico y dogmático del siglo IV. Su Gran Catequesis expone la fe para instructores en el clima post-niceno de Capadocia y el Imperio de Oriente.',
    axes: axes({
      lugar:
        'Capadocia (Nisa, Cesarea); círculos eclesiásticos de Asia Menor; Constantinopla como horizonte imperial y conciliar.',
      personajes:
        'Basilio Magno; Macrina; Gregorio Nacianceno; emperador Teodosio I; oponentes eunomianos/arrianos.',
      gobierno:
        'Imperio romano de Oriente cristianizado; Concilio de Constantinopla I (381); legislación teodosiana a favor de la fe nicena.',
      cultura:
        'Retórica y filosofía griega (platonismo cristiano); monacato familiar capadocio; griego teológico técnico (ousia, hypostasis).',
      religion:
        'Nicenismo vs. arrianismos y eunomianismo; residuales cultos anatólicos; judaísmo; ascetismo cristiano.',
      antropologia:
        'Imagen de Dios en el ser humano; ascenso espiritual; género y virginidad en tratados conexos; educación catequética de adultos.',
      creenciasMundanas:
        'Sofística y dialéctica eunomiana; platonismo pagano residual; astrología popular.',
      creenciaCristiana:
        'Trinidad capadocia; Encarnación y redención en la Gran Catequesis; bautismo y eucaristía; apokatastasis matizada en otros textos nisanos.',
    }),
    timeline: [
      { years: 'c. 372', label: 'Obispo de Nisa' },
      { years: '381', label: 'Concilio de Constantinopla I' },
      { years: 'c. 385', label: 'Gran Catequesis (aprox.)' },
    ],
    references: [R.gregoryNyssa, R.kelly, R.pelikan, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'diogneto-anonimo',
    name: 'Anónimo (Carta a Diogneto)',
    kind: 'author',
    years: 's. II',
    summary:
      'La Carta a Diogneto es una apología cristiana anónima del siglo II dirigida a un interlocutor pagano culto. Describe a los cristianos como «alma del mundo»: viven en las ciudades como todos, pero con otra ciudadanía moral.',
    axes: axes({
      lugar:
        'Mediterráneo oriental helenístico-romano (Alejandría, Asia Menor o entorno similar según hipótesis; no hay certeza de sede).',
      personajes:
        '«Diogneto» (destinatario, posiblemente ficticio o tipo del aristócrata pagano); emperadores antoninos como marco; intelectuales apologetas contemporáneos (Justino, etc.).',
      gobierno:
        'Principado romano de los Antoninos/Severos tempranos; cristianismo aún ilícito o precario; ausencia de alianza Imperio-Iglesia.',
      cultura:
        'Prosa griega de arte; diálogo con paideia; crítica del idolatrismo y del formalismo ritual judío desde categoría filosófico-moral.',
      religion:
        'Politeísmo cívico; judaísmo del Segundo Templo tardío / rabínico temprano; cristianismo minoritario misionero.',
      antropologia:
        'Familia y ciudad grecorromanas; hospitalidad; rechazo del abandono de recién nacidos y de ciertos espectáculos (temas afines a apologética coetánea).',
      creenciasMundanas:
        'Culto a los dioses de la ciudad; destinos y oráculos; orgullo étnico griego/romano.',
      creenciaCristiana:
        'Monoteísmo cristiano; revelación del Hijo; ética del amor y la paciencia bajo hostilidad; eclesiología implícita del pueblo nuevo sin territorio propio.',
    }),
    timeline: [
      { years: 's. II', label: 'Composición probable de la Epístola a Diogneto' },
    ],
    references: [R.diognetus, R.chadwick, R.frend],
    sourceNote: NOTE,
  },
  {
    id: 'sagrada-escritura',
    name: 'Sagrada Escritura (canon judeocristiano)',
    kind: 'era',
    years: 'II milenio a.C. – s. I d.C.',
    summary:
      'La Biblia reúne tradiciones de Israel y del cristianismo apostólico: Torá, Profetas y Escritos en hebreo/arameo (y formas griegas de la LXX), y el Nuevo Testamento griego. El pack «Pueblo de Dios» es una traducción española de esa herencia canónica para la lectura eclesial.',
    axes: axes({
      lugar:
        'Antiguo Oriente Próximo (Egipto, Canaán/Israel, Mesopotamia, Persia); mundo helenístico (Alejandría); Palestina romana y diáspora mediterránea del siglo I.',
      personajes:
        'Patriarcas y reyes de Israel/Judá; profetas; figuras del Segundo Templo; Jesús de Nazaret; apóstoles (Pedro, Pablo, Juan…); emperadores romanos del siglo I como trasfondo (Augusto, Tiberio, Nerón…).',
      gobierno:
        'Jefaturas tribales, monarquía unida y dividida, imperios asirio, babilónico, persa, helenístico y romano; prefectura de Judea y reinos clientes herodianos en época neotestamentaria.',
      cultura:
        'Hebreo, arameo y griego; géneros narrativos, legales, sapienciales, proféticos y epistolares; templo, sinagoga y casa-iglesia; memoria oral y escritura.',
      religion:
        'Monoteísmo yahvista en desarrollo; cultos cananeos y del entorno; judaísmos del Segundo Templo; culto imperial romano; misterios helenísticos como contraste cultural.',
      antropologia:
        'Clan y alianza; pureza ritual; honor/vergüenza mediterráneos; esclavitud y patronazgo; mesianismo popular y élites sacerdotales.',
      creenciasMundanas:
        'Politeísmos vecinos; astrología mesopotámica y helenística; destinos y héroes; filosofía popular grecorromana en el ambiente del NT.',
      creenciaCristiana:
        'Para la lectura cristiana: un canon que prepara y testimonia a Cristo; Antiguo Testamento como promesa y el Nuevo como cumplimiento en la Iglesia apostólica.',
    }),
    timeline: [
      { years: 'c. XIII–IV a.C.', label: 'Formación de tradiciones del AT (esquema amplio)' },
      { years: 's. III–I a.C.', label: 'Septuaginta y judaísmo helenístico' },
      { years: 's. I d.C.', label: 'Ministerio de Jesús y escritos del NT' },
      { years: 's. II–IV', label: 'Fijación progresiva del canon cristiano' },
    ],
    references: [R.bible, R.odcc, R.pelikan],
    sourceNote: NOTE,
  },
  {
    id: 'era-concilios-antiguos',
    name: 'Concilios ecuménicos de la Antigüedad (Nicaea–Calcedonia)',
    kind: 'era',
    years: '325–451',
    summary:
      'Los primeros concilios ecuménicos definen el lenguaje trinitario y cristológico de la Gran Iglesia bajo emperadores cristianos de Oriente, en un Imperio que usa el sínodo para la unidad religiosa y política.',
    axes: axes({
      lugar:
        'Nicea, Constantinopla, Éfeso, Calcedonia y otras sedes de Asia Menor y Tracia; eje Roma–Alejandría–Antioquía–Jerusalén.',
      personajes:
        'Constantino, Teodosio I y II, Marciano; Atanasio, Capadocios, Cirilo de Alejandría, León Magno; arrianos, nestorianos, monofisitas en debate.',
      gobierno:
        'Emperador convoca y confirma; prefectos y comites ejecutan destierros; derecho romano tardoimperial se imbrica con cánones.',
      cultura:
        'Griego teológico técnico; actas y cartas sinodales; retórica forense en juicios eclesiásticos.',
      religion:
        'Cristianismo imperial; disidencias cristológicas; residuales paganos; judaísmo bajo estatus restringido.',
      antropologia:
        'Obispos como notables urbanos; monacato como presión popular (Éfeso/Calcedonia); peregrinación y reliquias.',
      creenciasMundanas:
        'Culto al emperador transformado; filosofía neoplatónica en el trasfondo de los debates sobre ousia.',
      creenciaCristiana:
        'Credo niceno-constantinopolitano; María Theotokos; dos naturalezas en una persona (Calcedonia); cánones disciplinares.',
    }),
    timeline: [
      { years: '325', label: 'Nicea I' },
      { years: '381', label: 'Constantinopla I' },
      { years: '431', label: 'Éfeso' },
      { years: '451', label: 'Calcedonia' },
    ],
    references: [R.tanner, R.newadventCouncils, R.kelly, R.pelikan],
    sourceNote: NOTE,
  },
  {
    id: 'era-concilios-bizantinos',
    name: 'Concilios ecuménicos bizantinos (Constantinopla II–Nicea II)',
    kind: 'era',
    years: '553–787',
    summary:
      'Bajo emperadores de Constantinopla, los concilios V–VII abordan monofisismo, monoenergismo/monotelismo e iconoclasma, en un Imperio oriental que se ve a sí mismo como romano y cristiano.',
    axes: axes({
      lugar:
        'Constantinopla, Nicea; frontera con Persia y luego con el Islam; Italia bizantina residual y Roma papal.',
      personajes:
        'Justiniano, Heraclio, Constantino IV, Irene; papas Vigilio, Agatón, Adriano I; Máximo el Confesor; Juan Damasceno (marco iconódulo).',
      gobierno:
        'Autocracia bizantina; Césaropapismo tensionado con la sede romana; temas y exarcados; expansión islámica que reconfigura el mapa.',
      cultura:
        'Griego imperial; derecho justinianeo; arte litúrgico e icono; monacato oriental.',
      religion:
        'Calcedonismo oficial vs. iglesias miafisitas; islam emergente; judaísmo; cultos fronterizos.',
      antropologia:
        'Sociedad agraria y urbana bizantina; eunucos de corte; gremios; devoción de imágenes en la piedad popular.',
      creenciasMundanas:
        'Astrología cortesana; magia; ideal del basileus cristiano como orden del cosmos.',
      creenciaCristiana:
        'Reafirmación calcedonia; dos voluntades en Cristo (Const. III); legitimidad del culto a iconos (Nicea II).',
    }),
    timeline: [
      { years: '553', label: 'Constantinopla II' },
      { years: '680–681', label: 'Constantinopla III' },
      { years: '787', label: 'Nicea II' },
    ],
    references: [R.tanner, R.newadventCouncils, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'era-concilios-medievales',
    name: 'Concilios ecuménicos medievales (Constantinopla IV–Letrán V)',
    kind: 'era',
    years: '869–1517',
    summary:
      'Concilios de la cristiandad latina medieval: reforma gregoriana, cruzadas, universidad, cisma de Occidente y conciliarismo, hasta las vísperas de la Reforma. Sedes en Roma (Letrán), Lyon, Vienne, Constanza, Florencia.',
    axes: axes({
      lugar:
        'Roma y Letrán; Lyon; Vienne; Constanza; Ferrara-Florencia; fronteras con el Imperio bizantino y el mundo islámico.',
      personajes:
        'Papas reformadores (Gregorio VII, Inocencio III…); emperadores germanos y bizantinos; teólogos escolásticos; Hus y Wyclif en el horizonte de Constanza; legados pontificios.',
      gobierno:
        'Cristiandad feudal y monarquías en formación; teocracia papal vs. imperio; conciliarismo; órdenes militares y derecho canónico clásico (Graciano, Decretales).',
      cultura:
        'Latín escolástico; universidades; gótico; mendicantes; traducción de Aristóteles; protohumanismo en Florencia.',
      religion:
        'Catolicismo latino; cisma Oriente-Occidente (1054 y uniones fallidas/parciales); herejías medievales; judaísmo e islam bajo estatutos especiales.',
      antropologia:
        'Vasallaje; gremios; matrimonio canónico; indulgencias y piedad penitencial; peste y crisis demográficas (s. XIV).',
      creenciasMundanas:
        'Astrología universitaria; folklore; magia condenada en cánones; ideal caballeresco.',
      creenciaCristiana:
        'Primado romano; sacramentos escolásticos; transubstanciación (Letrán IV); reforma de la cabeza y los miembros; intentos de unión con griegos (Lyon II, Florencia).',
    }),
    timeline: [
      { years: '869–870', label: 'Constantinopla IV (recepción latina)' },
      { years: '1123–1517', label: 'Concilios lateranenses y de Lyon, Vienne, Constanza, Florencia, Letrán V' },
    ],
    references: [R.tanner, R.newadventCouncils, R.odcc, R.pelikan],
    sourceNote: NOTE,
  },
  {
    id: 'era-trento',
    name: 'Concilio de Trento y reforma católica',
    kind: 'era',
    years: '1545–1563',
    summary:
      'Trento responde a la Reforma protestante definiendo Escritura y Tradición, justificación, sacramentos y disciplina. Inaugura la era de la reforma católica / Contrarreforma, seminarios y catecismos.',
    axes: axes({
      lugar:
        'Trento (Tirol / Sacro Imperio); orbes católicos de España, Italia, Polonia…; misiones de ultramar en el trasfondo.',
      personajes:
        'Pablo III, Julio III, Pío IV; Carlos V y Felipe II; legados pontificios; teólogos jesuitas y dominicos; interlocutores protestantes ausentes o indirectos.',
      gobierno:
        'Estados confesionales; regalismo; aplicación de decretos vía monarquías católicas; Índice y nunciaturas.',
      cultura:
        'Humanismo cristiano; imprenta; barroco incipiente; latín conciliar y lenguas vernáculas en catequesis.',
      religion:
        'Cisma protestante; concilios nacionales reformados; judaísmo e islam en fronteras; misiones globales.',
      antropologia:
        'Control de matrimonio y cofradías; disciplina del clero; piedad de la confesión frecuente.',
      creenciasMundanas:
        'Renacimiento pagano residual; magia y brujería perseguidas; estoicismo y escepticismo cultos.',
      creenciaCristiana:
        'Fe católica tridentina: canon, justificación por gracia con cooperación, siete sacramentos, sacrificio de la misa, culto de santos e imágenes regulado.',
    }),
    timeline: [
      { years: '1545–1563', label: 'Sesiones del Concilio de Trento' },
      { years: '1566', label: 'Catecismo Romano (Pío V)' },
    ],
    references: [R.trent, R.tanner, R.romanCatechism, R.pelikan],
    sourceNote: NOTE,
  },
  {
    id: 'era-vat1',
    name: 'Concilio Vaticano I y siglo XIX católico',
    kind: 'era',
    years: '1869–1870',
    summary:
      'El Vaticano I define la fe católica frente al racionalismo y el primado/infallibilidad papal en un siglo de revoluciones, unificación italiana y pérdida del poder temporal pontificio.',
    axes: axes({
      lugar:
        'Roma (San Pedro); Europa de las naciones; ultramontanismo vs. iglesias nacionales.',
      personajes:
        'Pío IX; minoría conciliar anti-infallibilista; Napoleón III; Cavour y el Risorgimento; pensadores liberales y tradicionalistas.',
      gobierno:
        'Estados pontificios en crisis; unificación italiana (1870); Kulturkampf posterior; monarquías y repúblicas liberales.',
      cultura:
        'Romanticismo y positivismo; prensa de masas; neoescolástica incipiente.',
      religion:
        'Catolicismo ultramontano; protestantismos liberales; secularización; judaísmo emancipado; nuevas religiones políticas.',
      antropologia:
        'Ciudad industrial; clase obrera (horizonte de la doctrina social posterior); familia burguesa.',
      creenciasMundanas:
        'Racionalismo, materialismo, panteísmo (condenados en el Syllabus / Dei Filius); fe en el progreso.',
      creenciaCristiana:
        'Dei Filius (fe y razón); Pastor Aeternus (primado e infalibilidad ex cathedra); continuidad con el magisterio antiliberal de Pío IX (Quanta cura).',
    }),
    timeline: [
      { years: '1864', label: 'Quanta cura y Syllabus' },
      { years: '1869–1870', label: 'Concilio Vaticano I' },
    ],
    references: [R.vat1, R.quantaCura, R.tanner, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'era-vat2',
    name: 'Concilio Vaticano II',
    kind: 'era',
    years: '1962–1965',
    summary:
      'El Vaticano II es el gran sínodo pastoral y doctrinal del siglo XX: liturgia, revelación, Iglesia, ecumenismo, libertad religiosa y diálogo con el mundo moderno, convocado por Juan XXIII y concluido por Pablo VI.',
    axes: axes({
      lugar:
        'Ciudad del Vaticano / Basílica de San Pedro; recepción global en diócesis de todos los continentes; Guerra Fría como marco geopolítico.',
      personajes:
        'Juan XXIII; Pablo VI; peritos (Congar, Rahner, Ratzinger joven, etc.); obispos del Tercer Mundo; observadores no católicos.',
      gobierno:
        'Orden bipolar; descolonización; ONU y derechos humanos; Santa Sede como actor diplomático sin poder territorial clásico.',
      cultura:
        'Mass media; lenguas vernáculas en liturgia; ciencias humanas; movimiento litúrgico y bíblico previos.',
      religion:
        'Ecumenismo; diálogo interreligioso (Nostra aetate); secularización occidental; vitalidad del Sur global.',
      antropologia:
        'Dignidad de la persona; matrimonio y familia en debate; laicado; derechos civiles.',
      creenciasMundanas:
        'Ateísmo moderno; ideologías totalitarias del s. XX; cientifismo; consumismo.',
      creenciaCristiana:
        'Eclesiología de pueblo de Dios y comunión; Escritura y Tradición (Dei verbum); colegialidad; libertad religiosa como derecho civil fundado en dignidad.',
    }),
    timeline: [
      { years: '1962–1965', label: 'Cuatro periodos conciliares' },
      { years: '1963–1965', label: 'Constituciones SC, LG, DV, GS y decretos mayores' },
    ],
    references: [R.vat2, R.tanner, R.odcc, R.pelikan],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-jp2',
    name: 'Juan Pablo II (magisterio)',
    kind: 'issuer',
    years: '1978–2005',
    summary:
      'Karol Wojtyła, papa Juan Pablo II, marca el final del siglo XX católico: personalismo, doctrina social post-1989, moral (Veritatis splendor, Evangelium vitae), laicado, misiones y el Catecismo de 1992/97.',
    axes: axes({
      lugar:
        'Roma y viajes apostólicos globales; Polonia y Europa del Este; Naciones Unidas y foros internacionales.',
      personajes:
        'Juan Pablo II; colaboradores curiales; líderes de Solidarnošč y de la Guerra Fría; teólogos moralistas en debate.',
      gobierno:
        'Caída del bloque soviético; globalización; Santa Sede en diplomacia de derechos humanos.',
      cultura:
        'Medios de masas; JMJ; diálogo fe-razón; personalismo filosófico polaco y tomista.',
      religion:
        'Catolicismo global; ecumenismo; Jornada de Asís; tensiones con teologías de la liberación y moral liberal.',
      antropologia:
        'Teología del cuerpo; dignidad del no nacido y del moribundo; trabajo humano (Laborem exercens).',
      creenciasMundanas:
        'Materialismo dialéctico; consumismo; relativismo moral; tecnocracia.',
      creenciaCristiana:
        'Cristocentrismo (Redemptor hominis); fe del Catecismo; moral objetiva y ley natural; eclesiología de comunión postconciliar.',
    }),
    timeline: [
      { years: '1978', label: 'Elección de Juan Pablo II' },
      { years: '1983', label: 'Código de Derecho Canónico' },
      { years: '1992–1997', label: 'Catecismo de la Iglesia Católica' },
    ],
    references: [R.jpii, R.cic, R.cdc, R.cds],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-b16',
    name: 'Benedicto XVI (magisterio)',
    kind: 'issuer',
    years: '2005–2013',
    summary:
      'Joseph Ratzinger, papa Benedicto XVI: hermenéutica de la Escritura, liturgia, Verbum Domini y el sínodo sobre la Palabra de Dios (2008).',
    axes: axes({
      lugar: 'Roma; universidades pontificias; Baviera y la tradición teológica alemana.',
      personajes:
        'Benedicto XVI; Padres del Sínodo 2008; exegetas y pastores de la recepción de Dei Verbum.',
      gobierno: 'Santa Sede en los años 2000; diálogo fe–razón en Europa secularizada.',
      cultura: 'Crisis de la Palabra en la cultura mediática; renovación bíblica postconciliar.',
      religion: 'Lectura orante de la Escritura; liturgia como lugar privilegiado de la Palabra.',
      antropologia: 'El hombre como oyente de la Palabra; conversión de mente y vida (lectio divina).',
      creenciasMundanas: 'Hermenéutica secularizada de la Biblia; relativismo.',
      creenciaCristiana:
        'Cristología de la Palabra; Tradición y Escritura; lectio divina (Verbum Domini 86–87).',
    }),
    timeline: [
      { years: '2005', label: 'Elección de Benedicto XVI' },
      { years: '2008', label: 'Sínodo sobre la Palabra de Dios' },
      { years: '2010', label: 'Verbum Domini' },
    ],
    references: [R.vat2, R.holySeeArchive],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-paul-vi',
    name: 'Pablo VI (magisterio)',
    kind: 'issuer',
    years: '1963–1978',
    summary:
      'Giovanni Battista Montini cierra el Vaticano II e inicia la recepción: reforma litúrgica, Humanae vitae, Evangelii nuntiandi y el Credo del Pueblo de Dios en un mundo de 1968 y descolonización.',
    axes: axes({
      lugar: 'Roma; viajes (Tierra Santa, ONU, Asia, América Latina); Iglesias locales en efervescencia postconciliar.',
      personajes: 'Pablo VI; Pablo VI y el colegio episcopal; Pablo VI frente a disensos doctrinales y disciplinares.',
      gobierno: 'Guerra Fría; descolonización; crisis del 68; diplomacia vaticana de Ostpolitik.',
      cultura: 'Modernidad cultural de los 60–70; medios; teología de la liberación emergente.',
      religion: 'Recepción del Vaticano II; ecumenismo; diálogo con no creyentes.',
      antropologia: 'Sexualidad y regulación de la natalidad; familia; justicia social (Populorum progressio).',
      creenciasMundanas: 'Marxismos; psicoanálisis popular; hedonismo de masas.',
      creenciaCristiana: 'Fe del Credo del Pueblo de Dios; moral matrimonial de Humanae vitae; evangelización (EN).',
    }),
    timeline: [
      { years: '1963–1965', label: 'Conclusión del Vaticano II' },
      { years: '1968', label: 'Humanae vitae' },
      { years: '1975', label: 'Evangelii nuntiandi' },
    ],
    references: [R.paulvi, R.vat2, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-john-xxiii',
    name: 'Juan XXIII (magisterium)',
    kind: 'issuer',
    years: '1958–1963',
    summary:
      'Angelo Roncalli convoca el Vaticano II y publica Pacem in terris en plena Guerra Fría, abriendo un estilo pastoral de diálogo con el orden internacional de derechos humanos.',
    axes: axes({
      lugar: 'Roma; escenario nuclear y bipolar global.',
      personajes: 'Juan XXIII; Kennedy/Jruschov como horizonte; obispos preconciliarmente movilizados.',
      gobierno: 'ONU; crisis de los misiles; bienestar europeo de posguerra.',
      cultura: 'Años 50–60; radio y TV; movimiento litúrgico.',
      religion: 'Catolicismo preconciliar en vísperas de reforma; ecumenismo inicial.',
      antropologia: 'Derechos de la persona y de los pueblos en Pacem in terris.',
      creenciasMundanas: 'Ideologías de la Guerra Fría; tecnocracia nuclear.',
      creenciaCristiana: 'Fe católica tradicional con acento pastoral y de paz; preparación del Vaticano II.',
    }),
    timeline: [{ years: '1963', label: 'Pacem in terris; apertura del Vaticano II (1962)' }],
    references: [R.johnxxiii, R.vat2],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-leo-xiii',
    name: 'León XIII (magisterio social y político)',
    kind: 'issuer',
    years: '1878–1903',
    summary:
      'Vincenzo Pecci, León XIII, formula la doctrina social moderna (Rerum novarum) y un corpus sobre libertad, poder civil y filosofía cristiana (Aeterni Patris, Immortale Dei, Libertas, Diuturnum).',
    axes: axes({
      lugar: 'Roma post-1870 (cuestión romana); Europa industrial; Imperios coloniales.',
      personajes: 'León XIII; Bismarck (Kulturkampf residual); movimiento obrero; tomistas de la neoescolástica.',
      gobierno: 'Estados liberales; monarquías; cuestión romana sin soberanía territorial plena hasta 1929.',
      cultura: 'Industrialización; prensa; neotomismo.',
      religion: 'Catolicismo social; protestantismo liberal; laicismo de Estado.',
      antropologia: 'Cuestión obrera; familia; propiedad y salario justo.',
      creenciasMundanas: 'Liberalismo, socialismo y racionalismo del XIX.',
      creenciaCristiana: 'Tomismo oficial; potestad indirecta y bien común; derechos de la Iglesia en la sociedad.',
    }),
    timeline: [
      { years: '1885–1888', label: 'Immortale Dei, Libertas, Diuturnum' },
      { years: '1891', label: 'Rerum novarum (marco del corpus social)' },
    ],
    references: [R.leoxiii, R.odcc, R.pelikan],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-pius-xi',
    name: 'Pío XI',
    kind: 'issuer',
    years: '1922–1939',
    summary:
      'Achille Ratti, Pío XI, reina en entreguerras: Acción Católica, Quas primas (Cristo Rey), concordatos y condenas de totalitarismos.',
    axes: axes({
      lugar: 'Roma (Pactos de Letrán 1929); Europa de fascismos y comunismo.',
      personajes: 'Pío XI; Mussolini (concordato); jerarquías de Acción Católica.',
      gobierno: 'Estados totalitarios emergentes; Ciudad del Vaticano soberana (1929).',
      cultura: 'Radiodifusión; cine; modernismo residual ya condenado.',
      religion: 'Catolicismo confesional vs. laicismos y paganismos políticos.',
      antropologia: 'Educación cristiana; matrimonio; juventudes católicas.',
      creenciasMundanas: 'Nacionalismos sacralizados; materialismo marxista.',
      creenciaCristiana: 'Realeza social de Cristo; doctrina social (Quadragesimo anno en el entorno).',
    }),
    timeline: [{ years: '1925', label: 'Quas primas' }],
    references: [R.piusxi, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-pius-ix',
    name: 'Pío IX',
    kind: 'issuer',
    years: '1846–1878',
    summary:
      'Giovanni Maria Mastai Ferretti, el pontificado más largo de la era moderna, combina el Syllabus, la definición de la Inmaculada y el Vaticano I con la pérdida de los Estados Pontificios.',
    axes: axes({
      lugar: 'Roma y Estados Pontificios hasta 1870; Europa de las revoluciones.',
      personajes: 'Pío IX; Cavour; Napoleón III; padres del Vaticano I.',
      gobierno: 'Fin del poder temporal; monarquías constitucionales; unificación italiana.',
      cultura: 'Romanticismo católico; devociones marianas de masas.',
      religion: 'Ultramontanismo; confesionalidad vs. Estado liberal.',
      antropologia: 'Piedad popular; misiones; emigración.',
      creenciasMundanas: 'Liberalismo, panteísmo, socialismo (Syllabus).',
      creenciaCristiana: 'Inmaculada Concepción (1854); antiliberalismo doctrinal; preparación de Pastor Aeternus.',
    }),
    timeline: [
      { years: '1864', label: 'Quanta cura' },
      { years: '1869–1870', label: 'Vaticano I' },
    ],
    references: [R.quantaCura, R.vat1, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-curia-moderna',
    name: 'Curia romana y dicasterios (s. XX–XXI)',
    kind: 'issuer',
    years: 's. XX–XXI',
    summary:
      'Documentos de Congregaciones y Consejos pontificios (Doctrina de la Fe, Clero, Laicos, Justicia y Paz, etc.) aplican el concilio y el derecho de la Iglesia a bioética, catequesis, teología de la liberación y vida eclesial.',
    axes: axes({
      lugar: 'Ciudad del Vaticano; recepción en conferencias episcopales mundiales.',
      personajes: 'Prefectos de la CDF y otros dicasterios; papas Pablo VI–Benedicto XVI y entorno JPII; teólogos consultores.',
      gobierno: 'Gobierno central de la Iglesia latina y orientación de las orientales; derecho canónico de 1983/1990.',
      cultura: 'Especialización teológica; medios; universidades pontificias.',
      religion: 'Catolicismo postconciliar plural; ecumenismo; nuevas religiones y sectas.',
      antropologia: 'Bioética; sexualidad; derechos humanos; opción preferencial por los pobres (debate).',
      creenciasMundanas: 'Relativismo; tecnociencia; ideologías de mercado y de género en el horizonte de textos tardíos.',
      creenciaCristiana: 'Fe del Catecismo y del Vaticano II interpretada por el magisterio ordinario de la Curia en comunión con el papa.',
    }),
    timeline: [
      { years: '1965–2005', label: 'Instrucciones y declaraciones postconciliares mayores' },
    ],
    references: [R.b16, R.jpii, R.cds, R.cic],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-canon-law',
    name: 'Derecho canónico latino y oriental',
    kind: 'issuer',
    years: '1917–1990',
    summary:
      'El CIC 1983 y el CCEO 1990 codifican la disciplina de la Iglesia latina y de las Iglesias orientales católicas tras el Vaticano II, sustituyendo en gran medida el código pio-benedictino de 1917 en Occidente.',
    axes: axes({
      lugar: 'Roma; Iglesias sui iuris de Oriente; diócesis latinas globales.',
      personajes: 'Juan Pablo II (promulgador); comisiones codificadoras; Graciano y tradición clásica como fondo.',
      gobierno: 'Gobierno eclesial: Romano Pontífice, colegios, curias diocesanas; fuero interno/externo.',
      cultura: 'Ciencia canónica; latín jurídico; facultades de derecho canónico.',
      religion: 'Comunión católica con diversidad de ritos.',
      antropologia: 'Estatuto de personas (clérigos, laicos, religiosos); matrimonio canónico; delitos y penas.',
      creenciasMundanas: 'Ordenamientos civiles concurrentes; derechos humanos seculares como interlocutores.',
      creenciaCristiana: 'Salus animarum suprema lex; sacramentos y potestad de régimen al servicio de la communio.',
    }),
    timeline: [
      { years: '1917', label: 'Código pio-benedictino' },
      { years: '1983', label: 'CIC latino' },
      { years: '1990', label: 'CCEO' },
    ],
    references: [R.cdc, R.cceo, R.odcc],
    sourceNote: NOTE,
  },
  {
    id: 'era-concilio-jerusalen',
    name: 'Concilio de Jerusalén (apostólico)',
    kind: 'era',
    years: 'c. 49–50',
    summary:
      'El llamado Concilio de Jerusalén (Hechos 15) decide la entrada de gentiles a la Iglesia sin imponer la circuncisión plena de la ley mosaica, en el cristianismo apostólico bajo dominio romano de Judea.',
    axes: axes({
      lugar: 'Jerusalén del Segundo Templo; Antioquía como iglesia mixta; rutas paulinas.',
      personajes: 'Pedro, Santiago, Pablo, Bernabé; fariseos cristianos; prefectura romana de Judea.',
      gobierno: 'Judea romana; reinos clientes; sinagogas de la diáspora.',
      cultura: 'Griego y arameo; judaísmo de la diáspora; mesa compartida como conflicto cultural.',
      religion: 'Judaísmo del Segundo Templo; culto del Templo; cristianismo como camino dentro/junto al judaísmo.',
      antropologia: 'Pureza alimentaria; etnicidad judía/gentil; patronazgo en casas.',
      creenciasMundanas: 'Religión cívica grecorromana en las ciudades de misión.',
      creenciaCristiana: 'Salvación por la gracia en Cristo; un solo pueblo de judíos y gentiles; decreto apostólico.',
    }),
    timeline: [{ years: 'c. 49', label: 'Asamblea de Jerusalén (Hch 15)' }],
    references: [R.bible, R.chadwick, R.frend],
    sourceNote: NOTE,
  },
  {
    id: 'issuer-denzinger',
    name: 'Enchiridion symbolorum (Denzinger)',
    kind: 'issuer',
    years: '1854–',
    summary:
      'El Enchiridion de Heinrich Denzinger (y revisiones DS/DH) compila símbolos, definiciones y declaraciones de fe y moral del magisterio, herramienta de teología dogmática moderna.',
    axes: axes({
      lugar: 'Tradición romana y conciliar compilada en manual de seminario europeo (s. XIX–XXI).',
      personajes: 'Heinrich Denzinger; editores posteriores (Schönmetzer, Hünermann); concilios y papas citados.',
      gobierno: 'N/A como acto de gobierno; refleja actos del magisterio extraordinario y ordinario.',
      cultura: 'Teología positiva y neoescolástica; manualística latina.',
      religion: 'Catolicismo dogmático moderno.',
      antropologia: 'Uso en formación clerical y laical especializada.',
      creenciasMundanas: 'Contrapunto a historicismo y relativismo doctrinal modernos.',
      creenciaCristiana: 'Continuidad de la fe definida; jerarquía de documentos según autoridad.',
    }),
    timeline: [{ years: '1854', label: 'Primera edición Denzinger' }],
    references: [R.denzinger, R.odcc],
    sourceNote: NOTE,
  },
];

export function profileById(id: string): AuthorContextProfile | undefined {
  return AUTHOR_PROFILES.find((p) => p.id === id);
}
