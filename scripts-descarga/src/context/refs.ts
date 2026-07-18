/**
 * Shared citable references for the historical-context pack.
 * Prefer stable public URLs (vatican.va, newadvent, archive.org) + classic works.
 */
import type { ContextReference } from '../../models/historical-context.model';

export const R = {
  brownAg: {
    title: 'Peter Brown, Augustine of Hippo: A Biography',
    citation: 'Brown, Peter. Augustine of Hippo: A Biography. Berkeley: University of California Press, 2000 (rev.).',
  } as ContextReference,
  confessions: {
    title: 'Agustín, Confessiones (ed. crítica / BAC)',
    citation: 'San Agustín, Confesiones, BAC Obras de San Agustín, t. 2.',
    url: 'https://www.augustinus.it/latino/confessioni/index2.htm',
  } as ContextReference,
  cityOfGod: {
    title: 'Agustín, De civitate Dei',
    citation: 'San Agustín, La ciudad de Dios, BAC.',
    url: 'https://www.augustinus.it/latino/cdd/index2.htm',
  } as ContextReference,
  chadwick: {
    title: 'Henry Chadwick, The Early Church',
    citation: 'Chadwick, Henry. The Early Church. London: Penguin, rev. ed.',
  } as ContextReference,
  kelly: {
    title: 'J.N.D. Kelly, Early Christian Doctrines',
    citation: 'Kelly, J.N.D. Early Christian Doctrines. London: Continuum.',
  } as ContextReference,
  tanner: {
    title: 'Norman P. Tanner (ed.), Decrees of the Ecumenical Councils',
    citation: 'Tanner, Norman P., ed. Decrees of the Ecumenical Councils. 2 vols. Washington, DC: Georgetown University Press, 1990.',
  } as ContextReference,
  denzinger: {
    title: 'Denzinger-Hünermann, Enchiridion symbolorum',
    citation: 'Denzinger, H. / Hünermann, P. Enchiridion symbolorum definitionum et declarationum de rebus fidei et morum.',
    url: 'https://www.vatican.va/archive/catechism_lt/index_lt.htm',
  } as ContextReference,
  vat2: {
    title: 'Documentos del Concilio Vaticano II (vatican.va)',
    url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/index_sp.htm',
    citation: 'Acta Apostolicae Sedis / vatican.va — Concilio Vaticano II.',
  } as ContextReference,
  cic: {
    title: 'Catecismo de la Iglesia Católica (vatican.va)',
    url: 'https://www.vatican.va/archive/catechism_sp/index_sp.html',
  } as ContextReference,
  cdc: {
    title: 'Código de Derecho Canónico (1983) — vatican.va',
    url: 'https://www.vatican.va/archive/cod-iuris-canonici/cic_index_sp.html',
  } as ContextReference,
  cceo: {
    title: 'Código de los Cánones de las Iglesias Orientales — vatican.va',
    url: 'https://www.vatican.va/holy_father/john_paul_ii/apost_constitutions/documents/hf_jp-ii_apc_19901018_codex-can-eccl-orient-sp.html',
  } as ContextReference,
  newadventAg: {
    title: 'Catholic Encyclopedia: St. Augustine of Hippo',
    url: 'https://www.newadvent.org/cathen/02084a.htm',
  } as ContextReference,
  newadventCouncils: {
    title: 'Catholic Encyclopedia: General Councils',
    url: 'https://www.newadvent.org/cathen/04423f.htm',
  } as ContextReference,
  diognetus: {
    title: 'Epistle to Diognetus (Early Christian Writings)',
    url: 'https://www.earlychristianwritings.com/text/diognetus-lightfoot.html',
    citation: 'Epístola a Diogneto, s. II; ed. Lightfoot / Ruiz Bueno.',
  } as ContextReference,
  cyril: {
    title: 'Cyril of Jerusalem, Catechetical Lectures',
    url: 'https://www.newadvent.org/fathers/3101.htm',
    citation: 'Cirilo de Jerusalén, Catequesis; PG 33.',
  } as ContextReference,
  clement: {
    title: 'Clement of Alexandria, The Paedagogus',
    url: 'https://www.newadvent.org/fathers/0209.htm',
    citation: 'Clemente de Alejandría, El Pedagogo; PG 8.',
  } as ContextReference,
  cyprian: {
    title: 'Cyprian of Carthage, Epistles',
    url: 'https://www.newadvent.org/fathers/0506.htm',
    citation: 'Cipriano de Cartago, Epistolae; CSEL / BAC.',
  } as ContextReference,
  gregoryNyssa: {
    title: 'Gregory of Nyssa, The Great Catechism',
    url: 'https://www.newadvent.org/fathers/2908.htm',
    citation: 'Gregorio de Nisa, Oratio catechetica magna; PG 45.',
  } as ContextReference,
  bible: {
    title: 'Biblia (tradición canónica hebrea-cristiana)',
    citation: 'Texto masorético / LXX / NT griego; ed. Pueblo de Dios (ES).',
    url: 'https://www.vatican.va/archive/ESL0506/_INDEX.HTM',
  } as ContextReference,
  trent: {
    title: 'Concilio de Trento — documentos (vatican.va / Tanner)',
    url: 'https://www.vatican.va/archive/hist_councils/tri_council/index.htm',
    citation: 'Concilium Tridentinum; Tanner, Decrees…',
  } as ContextReference,
  vat1: {
    title: 'Concilio Vaticano I — Dei Filius / Pastor Aeternus',
    url: 'https://www.vatican.va/content/pius-ix/la/documents/constitutio-dogmatica-pastor-aeternus-18-iulii-1870.html',
  } as ContextReference,
  leoxiii: {
    title: 'León XIII — encíclicas (vatican.va)',
    url: 'https://www.vatican.va/content/leo-xiii/es.html',
  } as ContextReference,
  piusxi: {
    title: 'Pío XI — Quas primas y otros (vatican.va)',
    url: 'https://www.vatican.va/content/pius-xi/es.html',
  } as ContextReference,
  piusxii: {
    title: 'Pío XII — magisterio (vatican.va)',
    url: 'https://www.vatican.va/content/pius-xii/es.html',
  } as ContextReference,
  johnxxiii: {
    title: 'Juan XXIII — Pacem in terris (vatican.va)',
    url: 'https://www.vatican.va/content/john-xxiii/es/encyclicals/documents/hf_j-xxiii_enc_11041963_pacem.html',
  } as ContextReference,
  paulvi: {
    title: 'Pablo VI — magisterio (vatican.va)',
    url: 'https://www.vatican.va/content/paul-vi/es.html',
  } as ContextReference,
  jpii: {
    title: 'Juan Pablo II — magisterio (vatican.va)',
    url: 'https://www.vatican.va/content/john-paul-ii/es.html',
  } as ContextReference,
  b16: {
    title: 'Benedicto XVI / CDF — documentos (vatican.va)',
    url: 'https://www.vatican.va/roman_curia/congregations/cfaith/doc_doc_index_sp.htm',
  } as ContextReference,
  cds: {
    title: 'Compendio de la Doctrina Social de la Iglesia',
    url: 'https://www.vatican.va/roman_curia/pontifical_councils/justpeace/documents/rc_pc_justpeace_doc_20060526_compendio-dott-soc_sp.html',
  } as ContextReference,
  romanCatechism: {
    title: 'Catecismo Romano (Trento / Pío V)',
    citation: 'Catechismus Romanus ad parochos (1566); ed. críticas y traducciones.',
    url: 'https://www.newadvent.org/cathen/13120c.htm',
  } as ContextReference,
  quantaCura: {
    title: 'Pío IX, Quanta cura (1864)',
    url: 'https://www.vatican.va/content/pius-ix/la/documents/encyclica-quanta-cura-8-decembris-1864.html',
  } as ContextReference,
  britannicaLateRome: {
    title: 'Encyclopaedia Britannica: Western Roman Empire / Late antiquity',
    url: 'https://www.britannica.com/place/Roman-Empire',
    citation: 'Síntesis de marco imperial tardío (consulta general).',
  } as ContextReference,
  frend: {
    title: 'W.H.C. Frend, The Rise of Christianity',
    citation: 'Frend, W.H.C. The Rise of Christianity. Philadelphia: Fortress, 1984.',
  } as ContextReference,
  pelikan: {
    title: 'Jaroslav Pelikan, The Christian Tradition',
    citation: 'Pelikan, Jaroslav. The Christian Tradition. Vols. 1–5. Chicago: University of Chicago Press.',
  } as ContextReference,
  odcc: {
    title: 'Oxford Dictionary of the Christian Church',
    citation: 'Cross, F.L. / Livingstone, E.A., eds. The Oxford Dictionary of the Christian Church. Oxford University Press.',
  } as ContextReference,
};
