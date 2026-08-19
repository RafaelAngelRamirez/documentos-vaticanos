/**
 * Map lectionary citations (Mt 19,23-30) onto bible pack units.
 */

export interface ParsedCite {
  code: string;
  chapter: string;
  verse: number;
  display: string;
}

/** Abbreviations used in the Roman weekday/Sunday lectionary → corpus `biblia.libro`. */
export const LECT_BOOK_SLUG: Record<string, string> = {
  Gn: 'genesis',
  Ex: 'exodo',
  Lv: 'levitico',
  Nm: 'numeros',
  Dt: 'deuteronomio',
  Jos: 'josue',
  Jc: 'jueces',
  Jue: 'jueces',
  Rt: 'rut',
  '1S': 'primer libro de samuel',
  '2S': 'segundo libro de samuel',
  '1R': 'primer libro de los reyes',
  '2R': 'segundo libro de los reyes',
  '1Cro': 'primer libro de las cronicas',
  '2Cro': 'segundo libro de las cronicas',
  Esd: 'esdras',
  Ne: 'nehemias',
  Tb: 'tobias',
  Jdt: 'judit',
  Est: 'ester',
  '1M': 'primer libro de los macabeos',
  '2M': 'segundo libro de los macabeos',
  Jb: 'job',
  Job: 'job',
  Sal: 'salmos',
  Pr: 'proverbios',
  Qo: 'eclesiastes',
  Ct: 'cantar de los cantares',
  Sb: 'sabiduria',
  Si: 'eclesiastico',
  Eclo: 'eclesiastico',
  Is: 'isaias',
  Jr: 'jeremias',
  Lm: 'lamentaciones',
  Ba: 'baruc',
  Ez: 'ezequiel',
  Dn: 'daniel',
  Os: 'oseas',
  Jl: 'joel',
  Am: 'amos',
  Ab: 'abdias',
  Jon: 'jonas',
  Mi: 'miqueas',
  Na: 'nahum',
  Ha: 'habacuc',
  So: 'sofonias',
  Ag: 'ageo',
  Za: 'zacarias',
  Ml: 'malaquias',
  Mt: 'evangelio segun san mateo',
  Mc: 'evangelio segun san marcos',
  Lc: 'evangelio segun san lucas',
  Jn: 'evangelio segun san juan',
  Hch: 'hechos de los apostoles',
  Rm: 'carta a los romanos',
  '1Co': 'primera carta a los corintios',
  '2Co': 'segunda carta a los corintios',
  Ga: 'carta a los galatas',
  Ef: 'carta a los efesios',
  Flp: 'carta a los filipenses',
  Col: 'carta a los colosenses',
  '1Ts': 'primera carta a los tesalonicenses',
  '2Ts': 'segunda carta a los tesalonicenses',
  '1Tm': 'primera carta a timoteo',
  '2Tm': 'segunda carta a timoteo',
  Tt: 'carta a tito',
  Flm: 'carta a filemon',
  Hb: 'carta a los hebreos',
  St: 'carta de santiago',
  '1P': 'primera carta de san pedro',
  '2P': 'segunda carta de san pedro',
  '1Jn': 'primera carta de san juan',
  '2Jn': 'segunda carta de san juan',
  '3Jn': 'tercera carta de san juan',
  Judas: 'carta de san judas',
  Ap: 'apocalipsis',
};

export function parseLectionaryCite(
  raw: string | null | undefined,
): ParsedCite | null {
  const display = (raw || '').trim();
  if (!display) return null;
  const m = display.match(
    /^([1-3]?[A-Za-zÁÉÍÓÚáéíóú]+)\s+(\d+)(?:\s*[,:]\s*(\d+))?/,
  );
  if (!m) return null;
  return {
    code: m[1],
    chapter: m[2],
    verse: m[3] ? Number(m[3]) : 1,
    display,
  };
}

export function bookSlugForCode(code: string): string | null {
  if (!code) return null;
  if (LECT_BOOK_SLUG[code]) return LECT_BOOK_SLUG[code];
  const fold = code.normalize('NFD').replace(/\p{M}/gu, '');
  return LECT_BOOK_SLUG[fold] || null;
}

export interface BibleUnitLike {
  biblia?: {
    libro?: string;
    capitulo?: string;
    versiculo?: number;
  };
  index_array?: number;
}

export function findBibleUnitIndex(
  units: BibleUnitLike[] | null | undefined,
  cite: ParsedCite,
): number | null {
  const slug = bookSlugForCode(cite.code);
  if (!slug || !units?.length) return null;
  const ch = String(cite.chapter);
  for (let i = 0; i < units.length; i++) {
    const b = units[i]?.biblia;
    if (!b) continue;
    if ((b.libro || '') !== slug) continue;
    if (String(b.capitulo) !== ch) continue;
    if (Number(b.versiculo) === cite.verse) {
      const idx = units[i].index_array;
      return typeof idx === 'number' ? idx : i;
    }
  }
  // Fallback: first verse of that chapter.
  for (let i = 0; i < units.length; i++) {
    const b = units[i]?.biblia;
    if ((b?.libro || '') === slug && String(b?.capitulo) === ch) {
      const idx = units[i].index_array;
      return typeof idx === 'number' ? idx : i;
    }
  }
  return null;
}
