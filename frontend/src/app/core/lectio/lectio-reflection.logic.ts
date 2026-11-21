/**
 * Offline lectio reflection for the liturgical day.
 * Texts are verbatim slices of works already in the corpus
 * (Verbum Domini, Carta a Diogneto). Vatican News is not in this catalog.
 */

import type {
  LiturgicalDate,
  LiturgicalFeast,
  LiturgicalSeason,
} from '../liturgia/liturgical-date.logic';
import { LECTIO_REFLECTION_CATALOG } from './lectio-reflection.catalog';
import { LECTIO_OFFLINE_REFLECTION } from './lectio-steps';

export interface LectioReflection {
  id: string;
  text: string;
  deep: string | null;
  attribution: string;
  documentId: string;
  unitIndex: number;
  consecutivo: string;
}

interface CatalogEntry extends LectioReflection {
  season: LiturgicalSeason;
  feast: LiturgicalFeast | null;
}

const ENTRIES = LECTIO_REFLECTION_CATALOG.entries as unknown as CatalogEntry[];

const FALLBACK: LectioReflection = {
  id: 'vd-87-fallback',
  text: LECTIO_OFFLINE_REFLECTION.text,
  deep: null,
  attribution: LECTIO_OFFLINE_REFLECTION.attribution,
  documentId: LECTIO_OFFLINE_REFLECTION.documentId,
  unitIndex: 86,
  consecutivo: LECTIO_OFFLINE_REFLECTION.consecutivo,
};

/** Stable slot: consecutive liturgical days land on adjacent slots. */
export function lectioReflectionSlot(lit: LiturgicalDate): number {
  return lit.week * 7 + lit.weekday;
}

function pick(pool: readonly CatalogEntry[], slot: number): LectioReflection {
  const row = pool[slot % pool.length];
  return {
    id: row.id,
    text: row.text,
    deep: row.deep,
    attribution: row.attribution,
    documentId: row.documentId,
    unitIndex: row.unitIndex,
    consecutivo: row.consecutivo,
  };
}

/**
 * Feast first, then the season pool. The same liturgical day
 * always returns the same extract. A neighboring day does not,
 * as long as that pool has more than one extract.
 */
export function selectLectioReflection(lit: LiturgicalDate): LectioReflection {
  const slot = lectioReflectionSlot(lit);
  if (lit.feast) {
    const feastPool = ENTRIES.filter((e) => e.feast === lit.feast);
    if (feastPool.length) return pick(feastPool, slot);
  }
  const seasonPool = ENTRIES.filter((e) => e.season === lit.season && !e.feast);
  if (seasonPool.length) return pick(seasonPool, slot);
  return FALLBACK;
}
