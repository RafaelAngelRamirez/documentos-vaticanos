/**
 * Shared citable references for the historical-context pack.
 * Every entry has a stable `id` for dense per-axis / per-paragraph linking.
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
  // —— Agustín / tardoantigüedad ——
  brownAg: ref(
    'brown-ag',
    'Peter Brown, Augustine of Hippo: A Biography',
    {
      citation:
        'Brown, Peter. Augustine of Hippo: A Biography. Berkeley: University of California Press, 2000 (rev.).',
      note: 'Biografía de referencia; datación de obras y contexto africano.',
    },
  ),
  confessions: ref('aug-conf', 'Agustín, Confessiones (ed. crítica / BAC)', {
    citation: 'San Agustín, Confesiones, BAC Obras de San Agustín, t. 2.',
    url: 'https://www.augustinus.it/latino/confessioni/index2.htm',
    note: 'Texto primario; composición ~397–400.',
  }),
  cityOfGod: ref('aug-cdd', 'Agustín, De civitate Dei', {
    citation: 'San Agustín, La ciudad de Dios, BAC.',
    url: 'https://www.augustinus.it/latino/cdd/index2.htm',
    note: 'Texto primario; respuesta al saqueo de Roma 410.',
  }),
  newadventAg: ref(
    'ce-augustine',
    'Catholic Encyclopedia: St. Augustine of Hippo',
    {
      url: 'https://www.newadvent.org/cathen/02084a.htm',
      note: 'Síntesis clásica de vida, obras y controversias.',
    },
  ),
  britannicaLateRome: ref(
    'britannica-rome',
    'Encyclopaedia Britannica: Roman Empire / Late antiquity',
    {
      url: 'https://www.britannica.com/place/Roman-Empire',
      note: 'Marco imperial y crisis del Occidente.',
      citation: 'Encyclopaedia Britannica, s.v. Roman Empire (consulta general).',
    },
  ),

  // —— Padres e Iglesia antigua ——
  chadwick: ref('chadwick-ec', 'Henry Chadwick, The Early Church', {
    citation: 'Chadwick, Henry. The Early Church. London: Penguin, rev. ed.',
    note: 'Historia general de los siglos I–V.',
  }),
  kelly: ref('kelly-ecd', 'J.N.D. Kelly, Early Christian Doctrines', {
    citation: 'Kelly, J.N.D. Early Christian Doctrines. London: Continuum.',
    note: 'Desarrollo dogmático trinitario y cristológico.',
  }),
  frend: ref('frend-rise', 'W.H.C. Frend, The Rise of Christianity', {
    citation:
      'Frend, W.H.C. The Rise of Christianity. Philadelphia: Fortress, 1984.',
    note: 'Sociedad, persecuciones y África cristiana.',
  }),
  pelikan: ref('pelikan-ct', 'Jaroslav Pelikan, The Christian Tradition', {
    citation:
      'Pelikan, Jaroslav. The Christian Tradition. Vols. 1–5. Chicago: University of Chicago Press.',
    note: 'Historia de la doctrina por épocas.',
  }),
  odcc: ref('odcc', 'Oxford Dictionary of the Christian Church', {
    citation:
      'Cross, F.L. / Livingstone, E.A., eds. The Oxford Dictionary of the Christian Church. Oxford University Press.',
    note: 'Entradas biográficas y de concilios/magisterio.',
  }),
  diognetus: ref('diognetus', 'Epistle to Diognetus (Early Christian Writings)', {
    url: 'https://www.earlychristianwritings.com/text/diognetus-lightfoot.html',
    citation: 'Epístola a Diogneto, s. II; ed. Lightfoot / Ruiz Bueno.',
    note: 'Texto primario apologético.',
  }),
  cyril: ref('cyril-cat', 'Cyril of Jerusalem, Catechetical Lectures', {
    url: 'https://www.newadvent.org/fathers/3101.htm',
    citation: 'Cirilo de Jerusalén, Catequesis; PG 33.',
    note: 'Texto primario catequético jerosolimitano.',
  }),
  clement: ref('clement-paed', 'Clement of Alexandria, The Paedagogus', {
    url: 'https://www.newadvent.org/fathers/0209.htm',
    citation: 'Clemente de Alejandría, El Pedagogo; PG 8.',
    note: 'Texto primario; ética y paideia cristiana.',
  }),
  cyprian: ref('cyprian-ep', 'Cyprian of Carthage, Epistles', {
    url: 'https://www.newadvent.org/fathers/0506.htm',
    citation: 'Cipriano de Cartago, Epistolae; CSEL / BAC.',
    note: 'Texto primario; persecución y unidad eclesial.',
  }),
  gregoryNyssa: ref('nyssa-catech', 'Gregory of Nyssa, The Great Catechism', {
    url: 'https://www.newadvent.org/fathers/2908.htm',
    citation: 'Gregorio de Nisa, Oratio catechetica magna; PG 45.',
    note: 'Texto primario capadocio.',
  }),

  // —— Concilios ——
  tanner: ref(
    'tanner-dec',
    'Norman P. Tanner (ed.), Decrees of the Ecumenical Councils',
    {
      citation:
        'Tanner, Norman P., ed. Decrees of the Ecumenical Councils. 2 vols. Washington, DC: Georgetown University Press, 1990.',
      note: 'Texto y traducción de decretos conciliares.',
    },
  ),
  newadventCouncils: ref(
    'ce-councils',
    'Catholic Encyclopedia: General Councils',
    {
      url: 'https://www.newadvent.org/cathen/04423f.htm',
      note: 'Síntesis de concilios ecuménicos.',
    },
  ),
  trent: ref('trent-docs', 'Concilio de Trento — documentos', {
    url: 'https://www.vatican.va/archive/hist_councils/tri_council/index.htm',
    citation: 'Concilium Tridentinum; Tanner, Decrees…',
    note: 'Actas y decretos tridentinos.',
  }),
  vat1: ref('vat1-pa', 'Concilio Vaticano I — Pastor Aeternus / Dei Filius', {
    url: 'https://www.vatican.va/content/pius-ix/la/documents/constitutio-dogmatica-pastor-aeternus-18-iulii-1870.html',
    note: 'Constituciones dogmáticas del Vaticano I.',
  }),
  vat2: ref('vat2-docs', 'Documentos del Concilio Vaticano II (vatican.va)', {
    url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/index_sp.htm',
    citation: 'Acta Apostolicae Sedis / vatican.va — Concilio Vaticano II.',
    note: 'Textos oficiales de las constituciones y decretos.',
  }),

  // —— Escritura / manualística ——
  bible: ref('bible-canon', 'Sagrada Escritura (canon judeocristiano)', {
    citation: 'Texto masorético / LXX / NT griego; ed. Pueblo de Dios (ES).',
    url: 'https://www.vatican.va/archive/ESL0506/_INDEX.HTM',
    note: 'Texto bíblico de referencia eclesial.',
  }),
  denzinger: ref('denzinger-dh', 'Denzinger-Hünermann, Enchiridion symbolorum', {
    citation:
      'Denzinger, H. / Hünermann, P. Enchiridion symbolorum definitionum et declarationum de rebus fidei et morum.',
    url: 'https://www.vatican.va/archive/catechism_lt/index_lt.htm',
    note: 'Compilación de definiciones magisteriales.',
  }),
  romanCatechism: ref('catech-roman', 'Catecismo Romano (Trento / Pío V)', {
    citation: 'Catechismus Romanus ad parochos (1566); ed. críticas y traducciones.',
    url: 'https://www.newadvent.org/cathen/13120c.htm',
    note: 'Catecismo tridentino para párrocos.',
  }),

  // —— Magisterio moderno (vatican.va) ——
  cic: ref('cic-1997', 'Catecismo de la Iglesia Católica (vatican.va)', {
    url: 'https://www.vatican.va/archive/catechism_sp/index_sp.html',
    note: 'Texto típico del Catecismo (1992/1997).',
  }),
  cdc: ref('cic-1983', 'Código de Derecho Canónico (1983) — vatican.va', {
    url: 'https://www.vatican.va/archive/cod-iuris-canonici/cic_index_sp.html',
    note: 'Promulgación y texto del CIC latino.',
  }),
  cceo: ref('cceo-1990', 'Código de los Cánones de las Iglesias Orientales', {
    url: 'https://www.vatican.va/holy_father/john_paul_ii/apost_constitutions/documents/hf_jp-ii_apc_19901018_codex-can-eccl-orient-sp.html',
    note: 'CCEO 1990.',
  }),
  cds: ref('cds-2004', 'Compendio de la Doctrina Social de la Iglesia', {
    url: 'https://www.vatican.va/roman_curia/pontifical_councils/justpeace/documents/rc_pc_justpeace_doc_20060526_compendio-dott-soc_sp.html',
    note: 'Síntesis de doctrina social (PCJP).',
  }),
  quantaCura: ref('quanta-cura', 'Pío IX, Quanta cura (1864)', {
    url: 'https://www.vatican.va/content/pius-ix/la/documents/encyclica-quanta-cura-8-decembris-1864.html',
    note: 'Encíclica y Syllabus en el entorno.',
  }),
  leoxiii: ref('leo-xiii', 'León XIII — magisterio (vatican.va)', {
    url: 'https://www.vatican.va/content/leo-xiii/es.html',
    note: 'Corpus de encíclicas (Libertas, Immortale Dei, etc.).',
  }),
  piusxi: ref('pius-xi', 'Pío XI — magisterio (vatican.va)', {
    url: 'https://www.vatican.va/content/pius-xi/es.html',
    note: 'Incluye Quas primas y doctrina social de entreguerras.',
  }),
  piusxii: ref('pius-xii', 'Pío XII — magisterio (vatican.va)', {
    url: 'https://www.vatican.va/content/pius-xii/es.html',
    note: 'Magisterio de mediados del s. XX.',
  }),
  johnxxiii: ref('john-xxiii', 'Juan XXIII — Pacem in terris y entorno', {
    url: 'https://www.vatican.va/content/john-xxiii/es/encyclicals/documents/hf_j-xxiii_enc_11041963_pacem.html',
    note: 'Pacem in terris; convocatoria del Vaticano II.',
  }),
  paulvi: ref('paul-vi', 'Pablo VI — magisterio (vatican.va)', {
    url: 'https://www.vatican.va/content/paul-vi/es.html',
    note: 'Humanae vitae, Evangelii nuntiandi, cierre del Vaticano II.',
  }),
  jpii: ref('jp2', 'Juan Pablo II — magisterio (vatican.va)', {
    url: 'https://www.vatican.va/content/john-paul-ii/es.html',
    note: 'Encíclicas y exhortaciones 1978–2005.',
  }),
  b16: ref('cdf-docs', 'Congregación para la Doctrina de la Fe — documentos', {
    url: 'https://www.vatican.va/roman_curia/congregations/cfaith/doc_doc_index_sp.htm',
    note: 'Instrucciones y declaraciones de la CDF / curia.',
  }),
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
