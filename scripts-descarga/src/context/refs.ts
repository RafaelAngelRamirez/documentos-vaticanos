/**
 * Shared citable references for the historical-context pack.
 * Every entry has a stable `id` for dense per-axis / per-paragraph linking.
 *
 * Reliability preference (most → supporting):
 *  1. Primary / official: vatican.va, critical text sites (Augustinus.it, Tanner)
 *  2. University / peer encyclopedias: Stanford Encyclopedia (SEP), Britannica, IEP
 *  3. Academic teaching collections: Fordham Internet History Sourcebooks, CCEL (NPNF)
 *  4. Reference classics (print or stable online): Brown, Chadwick, Kelly, Pelikan, ODCC
 *  5. Legacy Catholic Encyclopedia (newadvent) — useful but early-20th-c.; pair with modern works
 *
 * Prefer permanent URLs; note field explains use and reliability.
 */
import type { ContextReference } from '../../models/historical-context.model';

function ref(
  id: string,
  title: string,
  opts: { citation?: string; url?: string; note?: string; locator?: string } = {},
): ContextReference {
  return { id, title, ...opts };
}

export const R = {
  // ═══════════════════════════════════════════════════════════
  // Agustín — primarios + biografía + SEP
  // ═══════════════════════════════════════════════════════════
  brownAg: ref(
    'brown-ag',
    'Peter Brown, Augustine of Hippo: A Biography',
    {
      citation:
        'Brown, Peter. Augustine of Hippo: A Biography. Berkeley: University of California Press, 2000 (rev.).',
      note: 'Biografía académica de referencia (impresión); datación y África tardoantigua.',
    },
  ),
  confessions: ref('aug-conf', 'Agustín, Confessiones — Opera Omnia (Augustinus.it)', {
    citation: 'Aurelius Augustinus, Confessiones; texto latino Opera Omnia / BAC t. 2.',
    url: 'https://www.augustinus.it/latino/confessioni/index2.htm',
    note: 'Texto primario latino en línea (proyecto Città Nuova / Augustinus.it).',
  }),
  cityOfGod: ref('aug-cdd', 'Agustín, De civitate Dei — Opera Omnia (Augustinus.it)', {
    citation: 'Aurelius Augustinus, De civitate Dei; texto latino Opera Omnia / BAC.',
    url: 'https://www.augustinus.it/latino/cdd/index2.htm',
    note: 'Texto primario latino; respuesta al saqueo de Roma (410).',
  }),
  augustinusPortal: ref('augustinus-it', 'Augustinus.it — Opera Omnia di Sant’Agostino', {
    url: 'https://www.augustinus.it/',
    citation: 'Nuova Biblioteca Agostiniana / Città Nuova — portal de obras latinas y traducciones.',
    note: 'Portal institucional de textos de Agustín (primario).',
  }),
  sepAugustine: ref('sep-augustine', 'Stanford Encyclopedia of Philosophy: Saint Augustine', {
    url: 'https://plato.stanford.edu/entries/augustine/',
    citation:
      'Mendelson, Michael. “Saint Augustine.” The Stanford Encyclopedia of Philosophy (//plato.stanford.edu).',
    note: 'Enciclopedia filosófica revisada por pares (Stanford). Vida, pensamiento, bibliografía.',
  }),
  sepPolitical: ref(
    'sep-aug-pol',
    'Stanford Encyclopedia of Philosophy: Augustine’s Political Philosophy',
    {
      url: 'https://plato.stanford.edu/entries/augustine-political/',
      citation:
        'Weithman, Paul. “Augustine’s Political Philosophy.” Stanford Encyclopedia of Philosophy.',
      note: 'Ciudad de Dios, política y dos ciudades (SEP, peer-reviewed).',
    },
  ),
  iepAugustine: ref('iep-augustine', 'Internet Encyclopedia of Philosophy: Augustine', {
    url: 'https://iep.utm.edu/augustin/',
    citation: 'Mendelson, Michael / IEP contributors. “Augustine.” Internet Encyclopedia of Philosophy (UTM).',
    note: 'Enciclopedia académica abierta (University of Tennessee at Martin); revisión editorial.',
  }),
  ccelSchaffAugustine: ref(
    'ccel-npnf-aug',
    'CCEL / NPNF: Works of St. Augustine (ed. Schaff)',
    {
      url: 'https://www.ccel.org/ccel/schaff/npnf101',
      citation:
        'Schaff, Philip, ed. A Select Library of the Nicene and Post-Nicene Fathers, First Series. Christian Classics Ethereal Library.',
      note: 'Traducciones clásicas (s. XIX); útiles para consulta, no ed. crítica moderna.',
    },
  ),
  newadventAg: ref(
    'ce-augustine',
    'Catholic Encyclopedia (1913): St. Augustine of Hippo',
    {
      url: 'https://www.newadvent.org/cathen/02084a.htm',
      citation: 'Portalié, Eugène. “Life of St. Augustine of Hippo.” Catholic Encyclopedia. New York: Robert Appleton, 1907.',
      note: 'Referencia católica histórica (1913); contrastar con Brown / SEP.',
    },
  ),
  britannicaAugustine: ref(
    'britannica-augustine',
    'Encyclopaedia Britannica: St. Augustine',
    {
      url: 'https://www.britannica.com/biography/Saint-Augustine',
      citation: 'Encyclopaedia Britannica, s.v. “Saint Augustine”.',
      note: 'Enciclopedia general revisada; biografía y obras.',
    },
  ),
  britannicaLateRome: ref(
    'britannica-rome',
    'Encyclopaedia Britannica: Roman Empire',
    {
      url: 'https://www.britannica.com/place/Roman-Empire',
      citation: 'Encyclopaedia Britannica, s.v. “Roman Empire”.',
      note: 'Marco imperial y tardoantigüedad (consulta general fiable).',
    },
  ),
  britannicaLateAntiquity: ref(
    'britannica-late-ant',
    'Encyclopaedia Britannica: Late antiquity / ancient Rome topics',
    {
      url: 'https://www.britannica.com/topic/ancient-Rome',
      citation: 'Encyclopaedia Britannica, s.v. “ancient Rome” (y artículos afines).',
      note: 'Contexto político-cultural del Mediterráneo romano.',
    },
  ),

  // ═══════════════════════════════════════════════════════════
  // Historia de la Iglesia antigua — manuales + colecciones
  // ═══════════════════════════════════════════════════════════
  chadwick: ref('chadwick-ec', 'Henry Chadwick, The Early Church', {
    citation: 'Chadwick, Henry. The Early Church. London: Penguin, rev. ed.',
    note: 'Manual académico clásico de historia de la Iglesia antigua (impresión).',
  }),
  kelly: ref('kelly-ecd', 'J.N.D. Kelly, Early Christian Doctrines', {
    citation: 'Kelly, J.N.D. Early Christian Doctrines. London: Continuum / HarperCollins.',
    note: 'Manual de dogmática histórica (Trinidad, cristología, gracia).',
  }),
  frend: ref('frend-rise', 'W.H.C. Frend, The Rise of Christianity', {
    citation:
      'Frend, W.H.C. The Rise of Christianity. Philadelphia: Fortress Press, 1984.',
    note: 'Historia social; persecuciones y África cristiana.',
  }),
  pelikan: ref('pelikan-ct', 'Jaroslav Pelikan, The Christian Tradition', {
    citation:
      'Pelikan, Jaroslav. The Christian Tradition: A History of the Development of Doctrine. 5 vols. Chicago: University of Chicago Press.',
    note: 'Historia de la doctrina por épocas (impresión de referencia).',
  }),
  odcc: ref('odcc', 'Oxford Dictionary of the Christian Church', {
    citation:
      'Cross, F.L. / Livingstone, E.A., eds. The Oxford Dictionary of the Christian Church. Oxford University Press.',
    note: 'Diccionario de referencia (impresión / Oxford Reference).',
  }),
  fordhamEHS: ref(
    'fordham-ehs',
    'Fordham University — Internet History Sourcebooks: Ancient / Medieval / Church',
    {
      url: 'https://sourcebooks.fordham.edu/',
      citation:
        'Halsall, Paul, ed. Internet History Sourcebooks Project. Fordham University.',
      note: 'Colección académica de fuentes primarias con introducción (Fordham.edu).',
    },
  ),
  fordhamChurch: ref(
    'fordham-church',
    'Fordham — Internet Medieval Sourcebook: Church Councils & Fathers',
    {
      url: 'https://sourcebooks.fordham.edu/sbook1l.asp',
      citation: 'Internet Medieval Sourcebook: Church Councils (Fordham University).',
      note: 'Extractos de concilios y padres con metadatos de enseñanza universitaria.',
    },
  ),
  fordhamAncient: ref(
    'fordham-ancient',
    'Fordham — Internet Ancient History Sourcebook: Christian Origins',
    {
      url: 'https://sourcebooks.fordham.edu/ancient/asbook11.asp',
      citation: 'Internet Ancient History Sourcebook: Christian Origins (Fordham University).',
      note: 'Fuentes de orígenes cristianos y Imperio romano.',
    },
  ),
  ccelSchaffHistory: ref(
    'ccel-schaff-hist',
    'CCEL: Philip Schaff, History of the Christian Church',
    {
      url: 'https://www.ccel.org/ccel/schaff/hcc1',
      citation:
        'Schaff, Philip. History of the Christian Church. 8 vols. Christian Classics Ethereal Library.',
      note: 'Historia clásica (s. XIX); contexto general, no estado del arte historiográfico actual.',
    },
  ),
  ccelECF: ref('ccel-ecf', 'CCEL: Early Church Fathers (ANF / NPNF)', {
    url: 'https://www.ccel.org/fathers.html',
    citation:
      'Roberts, Alexander / Donaldson, James / Schaff, Philip, eds. Ante-Nicene and Nicene Fathers. CCEL.',
    note: 'Corpus de traducciones de Padres de dominio público (referencia de consulta).',
  }),
  earlyChristianWritings: ref(
    'ecw-index',
    'Early Christian Writings (Peter Kirby) — index of texts',
    {
      url: 'https://www.earlychristianwritings.com/',
      citation: 'Kirby, Peter. Early Christian Writings. https://www.earlychristianwritings.com/',
      note: 'Índice de textos y dataciones; útil para primarios, no magisterio oficial.',
    },
  ),
  documentaCatholica: ref(
    'dco',
    'Documenta Catholica Omnia (Cooperatorum Veritatis Societas)',
    {
      url: 'http://www.documentacatholicaomnia.eu/',
      citation:
        'Documenta Catholica Omnia — archive of conciliar, patristic and magisterial texts (CVS).',
      note: 'Archivo amplio de textos latinos/griegos de la tradición católica (consulta de primarios).',
    },
  ),
  papalEncyclicals: ref(
    'papalencyclicals',
    'Papal Encyclicals Online',
    {
      url: 'https://www.papalencyclicals.net/',
      citation: 'Papal Encyclicals Online — English archive of papal documents.',
      note: 'Textos magisteriales en inglés; contrastar con vatican.va cuando exista original.',
    },
  ),

  // ═══════════════════════════════════════════════════════════
  // Padres — textos primarios en línea
  // ═══════════════════════════════════════════════════════════
  diognetus: ref('diognetus', 'Epistle to Diognetus (Early Christian Writings)', {
    url: 'https://www.earlychristianwritings.com/text/diognetus-lightfoot.html',
    citation: 'Epistle to Diognetus; English after Lightfoot / Lake; cf. Ruiz Bueno (ES).',
    note: 'Texto primario apologético (s. II).',
  }),
  diognetusCCEL: ref('diognetus-ccel', 'CCEL / ANF: Epistle to Diognetus', {
    url: 'https://www.ccel.org/ccel/schaff/anf01.iii.ii.html',
    citation: 'Ante-Nicene Fathers, vol. 1 — Epistle to Diognetus (CCEL).',
    note: 'Traducción ANF de dominio público.',
  }),
  cyril: ref('cyril-cat', 'Cyril of Jerusalem, Catechetical Lectures (New Advent)', {
    url: 'https://www.newadvent.org/fathers/3101.htm',
    citation: 'Cyril of Jerusalem. Catechetical Lectures. NPNF / New Advent; PG 33.',
    note: 'Texto primario catequético jerosolimitano.',
  }),
  cyrilCCEL: ref('cyril-ccel', 'CCEL / NPNF: Cyril of Jerusalem', {
    url: 'https://www.ccel.org/ccel/schaff/npnf207',
    citation: 'Nicene and Post-Nicene Fathers, Second Series, vol. 7 — Cyril of Jerusalem (CCEL).',
    note: 'Traducción NPNF de las Catequesis.',
  }),
  clement: ref('clement-paed', 'Clement of Alexandria, The Paedagogus (New Advent)', {
    url: 'https://www.newadvent.org/fathers/0209.htm',
    citation: 'Clement of Alexandria. The Instructor (Paedagogus). ANF / New Advent; PG 8.',
    note: 'Texto primario; ética y paideia cristiana.',
  }),
  clementCCEL: ref('clement-ccel', 'CCEL / ANF: Clement of Alexandria', {
    url: 'https://www.ccel.org/ccel/schaff/anf02',
    citation: 'Ante-Nicene Fathers, vol. 2 — Fathers of the Second Century (CCEL).',
    note: 'Incluye Protréptico, Pedagogo y Stromata (trad. ANF).',
  }),
  cyprian: ref('cyprian-ep', 'Cyprian of Carthage, Epistles (New Advent)', {
    url: 'https://www.newadvent.org/fathers/0506.htm',
    citation: 'Cyprian of Carthage. Epistles. ANF / New Advent; CSEL / BAC.',
    note: 'Texto primario; persecución y unidad eclesial.',
  }),
  cyprianCCEL: ref('cyprian-ccel', 'CCEL / ANF: Cyprian of Carthage', {
    url: 'https://www.ccel.org/ccel/schaff/anf05',
    citation: 'Ante-Nicene Fathers, vol. 5 — Hippolytus, Cyprian… (CCEL).',
    note: 'Traducciones ANF de Cipriano.',
  }),
  gregoryNyssa: ref('nyssa-catech', 'Gregory of Nyssa, The Great Catechism (New Advent)', {
    url: 'https://www.newadvent.org/fathers/2908.htm',
    citation: 'Gregory of Nyssa. The Great Catechism. NPNF / New Advent; PG 45.',
    note: 'Texto primario capadocio.',
  }),
  nyssaCCEL: ref('nyssa-ccel', 'CCEL / NPNF: Gregory of Nyssa', {
    url: 'https://www.ccel.org/ccel/schaff/npnf205',
    citation: 'Nicene and Post-Nicene Fathers, Second Series, vol. 5 — Gregory of Nyssa (CCEL).',
    note: 'Traducciones NPNF del Niseno.',
  }),
  newadventFathers: ref('ce-fathers-index', 'New Advent: Fathers of the Church (index)', {
    url: 'https://www.newadvent.org/fathers/',
    citation: 'New Advent — English translations of the Church Fathers (ANF/NPNF based).',
    note: 'Índice de Padres en inglés; textos de dominio público.',
  }),

  // ═══════════════════════════════════════════════════════════
  // Concilios — oficiales + Tanner + colecciones
  // ═══════════════════════════════════════════════════════════
  tanner: ref(
    'tanner-dec',
    'Norman P. Tanner (ed.), Decrees of the Ecumenical Councils',
    {
      citation:
        'Tanner, Norman P., ed. Decrees of the Ecumenical Councils. 2 vols. Washington, DC / London: Georgetown University Press / Sheed & Ward, 1990.',
      note: 'Edición crítica de referencia de decretos (latín/griego + inglés).',
    },
  ),
  newadventCouncils: ref(
    'ce-councils',
    'Catholic Encyclopedia (1913): General Councils',
    {
      url: 'https://www.newadvent.org/cathen/04423f.htm',
      citation: 'Wilhelm, Joseph. “General Councils.” Catholic Encyclopedia. New York, 1908.',
      note: 'Síntesis histórica de concilios (legado 1913).',
    },
  ),
  papacyVaticanCouncils: ref(
    'vatican-councils-hub',
    'Santa Sede — Archivo de concilios (vatican.va)',
    {
      url: 'https://www.vatican.va/archive/hist_councils/index_sp.htm',
      citation: 'Libreria Editrice Vaticana / vatican.va — historical councils archive.',
      note: 'Punto de entrada oficial a textos conciliares en el sitio de la Santa Sede.',
    },
  ),
  trent: ref('trent-docs', 'Concilio de Trento — documentos (vatican.va)', {
    url: 'https://www.vatican.va/archive/hist_councils/tri_council/index.htm',
    citation: 'Concilium Tridentinum; cf. Tanner, Decrees of the Ecumenical Councils.',
    note: 'Portal oficial de decretos tridentinos.',
  }),
  vat1: ref('vat1-pa', 'Concilio Vaticano I — Pastor Aeternus (vatican.va)', {
    url: 'https://www.vatican.va/content/pius-ix/la/documents/constitutio-dogmatica-pastor-aeternus-18-iulii-1870.html',
    citation: 'Pius IX. Constitutio dogmatica Pastor aeternus (18 iul. 1870). vatican.va.',
    note: 'Texto oficial latino de la constitución sobre el primado.',
  }),
  vat1DeiFilius: ref('vat1-df', 'Concilio Vaticano I — Dei Filius (contexto)', {
    url: 'https://www.vatican.va/content/pius-ix/en.html',
    citation: 'Pius IX / Vatican I — Dei Filius (1870); cf. Denzinger-Hünermann; Tanner.',
    note: 'Constitución sobre la fe católica; hub Pío IX en vatican.va.',
  }),
  vat2: ref('vat2-docs', 'Concilio Vaticano II — documentos (vatican.va)', {
    url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/index_sp.htm',
    citation: 'Concilium Vaticanum II. Acta / vatican.va (ES).',
    note: 'Textos oficiales de constituciones, decretos y declaraciones.',
  }),
  britannicaCouncils: ref(
    'britannica-councils',
    'Encyclopaedia Britannica: Council (Christianity)',
    {
      url: 'https://www.britannica.com/topic/council-Christianity',
      citation: 'Encyclopaedia Britannica, s.v. “council (Christianity)”.',
      note: 'Visión de conjunto de sínodos y concilios ecuménicos.',
    },
  ),
  britannicaNicaea: ref('britannica-nicaea', 'Encyclopaedia Britannica: Council of Nicaea', {
    url: 'https://www.britannica.com/event/First-Council-of-Nicaea-325',
    citation: 'Encyclopaedia Britannica, s.v. “First Council of Nicaea”.',
    note: 'Nicea I (325): Arrio, Constantino, credo.',
  }),
  britannicaChalcedon: ref(
    'britannica-chalcedon',
    'Encyclopaedia Britannica: Council of Chalcedon',
    {
      url: 'https://www.britannica.com/event/Council-of-Chalcedon',
      citation: 'Encyclopaedia Britannica, s.v. “Council of Chalcedon”.',
      note: 'Calcedonia (451): dos naturalezas.',
    },
  ),
  britannicaTrent: ref('britannica-trent', 'Encyclopaedia Britannica: Council of Trent', {
    url: 'https://www.britannica.com/event/Council-of-Trent',
    citation: 'Encyclopaedia Britannica, s.v. “Council of Trent”.',
    note: 'Trento y reforma católica.',
  }),
  britannicaVat2: ref(
    'britannica-vat2',
    'Encyclopaedia Britannica: Second Vatican Council',
    {
      url: 'https://www.britannica.com/event/Second-Vatican-Council',
      citation: 'Encyclopaedia Britannica, s.v. “Second Vatican Council”.',
      note: 'Síntesis histórica del Vaticano II.',
    },
  ),

  // ═══════════════════════════════════════════════════════════
  // Escritura / dogmática de referencia
  // ═══════════════════════════════════════════════════════════
  bible: ref('bible-canon', 'Sagrada Escritura — Nova Vulgata / vatican.va', {
    citation: 'Bibliorum Sacrorum nova vulgata editio; traducciones eclesiales (p. ej. Pueblo de Dios).',
    url: 'https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_index_lt.html',
    note: 'Texto bíblico de referencia en el sitio de la Santa Sede (Nova Vulgata).',
  }),
  bibleES: ref('bible-es-vat', 'Biblia — recursos en español (vatican.va)', {
    url: 'https://www.vatican.va/archive/ESL0506/_INDEX.HTM',
    citation: 'Santa Sede — textos bíblicos / liturgia en español (archivo).',
    note: 'Punto de acceso hispano en vatican.va.',
  }),
  denzinger: ref('denzinger-dh', 'Denzinger-Hünermann, Enchiridion symbolorum', {
    citation:
      'Denzinger, Heinrich / Hünermann, Peter. Enchiridion symbolorum definitionum et declarationum de rebus fidei et morum. Freiburg: Herder (eds. actualizadas).',
    note: 'Compilación numerada de definiciones magisteriales (impresión de referencia).',
  }),
  romanCatechism: ref('catech-roman', 'Catecismo Romano (Trento / Pío V) — entrada CE', {
    citation: 'Catechismus Romanus ad parochos (1566).',
    url: 'https://www.newadvent.org/cathen/13120c.htm',
    note: 'Entrada histórica al Catecismo Romano; texto en ediciones críticas/impresas.',
  }),

  // ═══════════════════════════════════════════════════════════
  // Magisterio moderno — vatican.va (oficial)
  // ═══════════════════════════════════════════════════════════
  cic: ref('cic-1997', 'Catecismo de la Iglesia Católica (vatican.va)', {
    url: 'https://www.vatican.va/archive/catechism_sp/index_sp.html',
    citation: 'Catechismus Catholicae Ecclesiae. Libreria Editrice Vaticana; edición típica 1997.',
    note: 'Texto típico oficial del Catecismo (ES).',
  }),
  cdc: ref('cic-1983', 'Código de Derecho Canónico (1983) — vatican.va', {
    url: 'https://www.vatican.va/archive/cod-iuris-canonici/cic_index_sp.html',
    citation: 'Codex Iuris Canonici (1983). Ioannes Paulus II. vatican.va.',
    note: 'Texto oficial del CIC latino.',
  }),
  cceo: ref('cceo-1990', 'Código de los Cánones de las Iglesias Orientales (vatican.va)', {
    url: 'https://www.vatican.va/holy_father/john_paul_ii/apost_constitutions/documents/hf_jp-ii_apc_19901018_codex-can-eccl-orient-sp.html',
    citation: 'Codex Canonum Ecclesiarum Orientalium (1990). Ioannes Paulus II.',
    note: 'CCEO 1990 — texto oficial.',
  }),
  cds: ref('cds-2004', 'Compendio de la Doctrina Social de la Iglesia (vatican.va)', {
    url: 'https://www.vatican.va/roman_curia/pontifical_councils/justpeace/documents/rc_pc_justpeace_doc_20060526_compendio-dott-soc_sp.html',
    citation: 'Pontificio Consejo Justicia y Paz. Compendio de la Doctrina Social de la Iglesia (2004).',
    note: 'Síntesis oficial de doctrina social.',
  }),
  quantaCura: ref('quanta-cura', 'Pío IX, Quanta cura (1864) — vatican.va', {
    url: 'https://www.vatican.va/content/pius-ix/la/documents/encyclica-quanta-cura-8-decembris-1864.html',
    citation: 'Pius IX. Encyclica Quanta cura (8 dec. 1864). vatican.va.',
    note: 'Texto oficial latino; entorno del Syllabus.',
  }),
  leoxiii: ref('leo-xiii', 'León XIII — documentos (vatican.va)', {
    url: 'https://www.vatican.va/content/leo-xiii/es.html',
    citation: 'Leo XIII. Opera / vatican.va (ES).',
    note: 'Hub oficial de encíclicas (Libertas, Immortale Dei, Rerum novarum, etc.).',
  }),
  piusxi: ref('pius-xi', 'Pío XI — documentos (vatican.va)', {
    url: 'https://www.vatican.va/content/pius-xi/es.html',
    citation: 'Pius XI. Opera / vatican.va (ES).',
    note: 'Incluye Quas primas y doctrina social de entreguerras.',
  }),
  piusxii: ref('pius-xii', 'Pío XII — documentos (vatican.va)', {
    url: 'https://www.vatican.va/content/pius-xii/es.html',
    citation: 'Pius XII. Opera / vatican.va (ES).',
    note: 'Magisterio de mediados del s. XX.',
  }),
  johnxxiii: ref('john-xxiii', 'Juan XXIII, Pacem in terris (vatican.va)', {
    url: 'https://www.vatican.va/content/john-xxiii/es/encyclicals/documents/hf_j-xxiii_enc_11041963_pacem.html',
    citation: 'Ioannes XXIII. Encyclica Pacem in terris (11 apr. 1963). vatican.va.',
    note: 'Texto oficial; marco de derechos y paz en la Guerra Fría.',
  }),
  paulvi: ref('paul-vi', 'Pablo VI — documentos (vatican.va)', {
    url: 'https://www.vatican.va/content/paul-vi/es.html',
    citation: 'Paulus VI. Opera / vatican.va (ES).',
    note: 'Humanae vitae, Evangelii nuntiandi, cierre del Vaticano II.',
  }),
  jpii: ref('jp2', 'Juan Pablo II — documentos (vatican.va)', {
    url: 'https://www.vatican.va/content/john-paul-ii/es.html',
    citation: 'Ioannes Paulus II. Opera / vatican.va (ES).',
    note: 'Encíclicas y exhortaciones 1978–2005 (texto oficial).',
  }),
  b16: ref('cdf-docs', 'Dicasterio / CDF — documentos doctrinales (vatican.va)', {
    url: 'https://www.vatican.va/roman_curia/congregations/cfaith/doc_doc_index_sp.htm',
    citation: 'Congregatio pro Doctrina Fidei / Dicasterium — documenta (vatican.va).',
    note: 'Instrucciones y declaraciones de la Curia en comunión con el Romano Pontífice.',
  }),
  holySeeArchive: ref('vatican-archive', 'Santa Sede — Archivo documental (vatican.va)', {
    url: 'https://www.vatican.va/archive/index_sp.htm',
    citation: 'vatican.va — Archive (Catechism, CIC, councils, etc.).',
    note: 'Índice oficial de recursos documentales de la Santa Sede.',
  }),
  aas: ref('aas', 'Acta Apostolicae Sedis (referencia de promulgación)', {
    citation:
      'Acta Apostolicae Sedis: Commentarium Officiale. Typis Polyglottis Vaticanis (serie oficial).',
    url: 'https://www.vatican.va/archive/aas/index_sp.htm',
    note: 'Boletín oficial de la Santa Sede para actos promulgados.',
  }),

  // ═══════════════════════════════════════════════════════════
  // SEP / IEP / Britannica — entradas temáticas de alta fiabilidad
  // ═══════════════════════════════════════════════════════════
  sepPlotinus: ref('sep-plotinus', 'Stanford Encyclopedia of Philosophy: Plotinus', {
    url: 'https://plato.stanford.edu/entries/plotinus/',
    citation: 'Gerson, Lloyd. “Plotinus.” Stanford Encyclopedia of Philosophy.',
    note: 'Neoplatonismo de fondo cultural de Agustín y padres griegos (SEP).',
  }),
  sepTrinity: ref('sep-trinity', 'Stanford Encyclopedia of Philosophy: Trinity', {
    url: 'https://plato.stanford.edu/entries/trinity/',
    citation: 'Tuggy, Dale. “Trinity.” Stanford Encyclopedia of Philosophy.',
    note: 'Filosofía de la Trinidad; complementar con Kelly/Pelikan para historia dogmática.',
  }),
  britannicaChristianity: ref(
    'britannica-christianity',
    'Encyclopaedia Britannica: Christianity',
    {
      url: 'https://www.britannica.com/topic/Christianity',
      citation: 'Encyclopaedia Britannica, s.v. “Christianity”.',
      note: 'Panorama histórico-doctrinal general (enciclopedia revisada).',
    },
  ),
  britannicaPapacy: ref('britannica-papacy', 'Encyclopaedia Britannica: Papacy', {
    url: 'https://www.britannica.com/topic/papacy',
    citation: 'Encyclopaedia Britannica, s.v. “papacy”.',
    note: 'Institución papal e historia del primado.',
  }),
  britannicaReformation: ref(
    'britannica-reformation',
    'Encyclopaedia Britannica: Reformation',
    {
      url: 'https://www.britannica.com/event/Reformation',
      citation: 'Encyclopaedia Britannica, s.v. “Reformation”.',
      note: 'Contexto de Trento y Contrarreforma.',
    },
  ),
  liviusLateRome: ref(
    'livius-rome',
    'Livius.org — Articles on ancient history (Rome)',
    {
      url: 'https://www.livius.org/category/roman/',
      citation: 'Lendering, Jona, et al. Livius.org — Articles on ancient history.',
      note: 'Divulgación histórica seria sobre Roma; no sustituye monografía, sí marco geográfico.',
    },
  ),
  metMuseumLateAntique: ref(
    'met-late-antique',
    'Metropolitan Museum of Art — Heilbrunn Timeline: Late Antique',
    {
      url: 'https://www.metmuseum.org/toah/hd/laat/hd_laat.htm',
      citation:
        'The Metropolitan Museum of Art. Heilbrunn Timeline of Art History: “Late Antique Art” / related essays.',
      note: 'Cultura material y arte tardoantiguo (museo de referencia).',
    },
  ),
  britishMuseumRome: ref(
    'bm-rome',
    'British Museum — Roman Empire collection overview',
    {
      url: 'https://www.britishmuseum.org/collection/roman-empire',
      citation: 'The British Museum. Collection / Roman Empire (public pages).',
      note: 'Cultura material del Imperio; apoyo a ejes de cultura/antropología.',
    },
  ),
} as const;

export type RefKey = keyof typeof R;

/** All shared refs as array (for bibliography unions). */
export function allSharedRefs(): ContextReference[] {
  return Object.values(R);
}

export function refs(...keys: RefKey[]): ContextReference[] {
  return keys.map((k) => R[k]);
}

export function refIds(...keys: RefKey[]): string[] {
  return keys.map((k) => R[k].id as string);
}

/** Prefer entries that carry a stable public URL (for credit on the web). */
export function onlineRefKeys(): RefKey[] {
  return (Object.keys(R) as RefKey[]).filter((k) => !!(R[k] as ContextReference).url);
}
