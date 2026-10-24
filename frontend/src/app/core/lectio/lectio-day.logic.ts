/**
 * Assemble the day's lectio payload from packed liturgy + optional Vatican News cache.
 * Pure — no Angular.
 */

import { lecturasForLiturgicalDate } from '../liturgia/lecturas-del-dia.logic';
import type { LecturaItem } from '../liturgia/lecturas-del-dia.logic';
import {
  liturgicalDateOf,
  liturgicalLabelEs,
} from '../liturgia/liturgical-date.logic';
import type { PalabraDelDia } from './palabra-del-dia.parse';
import {
  LECTIO_INTRO_DOC,
  LECTIO_METHOD_DOC,
  LECTIO_OFFLINE_REFLECTION,
} from './lectio-steps';

export interface LectioSaintBrief {
  id: string;
  name: string;
}

export interface LectioDay {
  dateIso: string;
  liturgicalLabel: string;
  readings: LecturaItem[];
  gospel: LecturaItem | null;
  saints: LectioSaintBrief[];
  reflectionText: string | null;
  reflectionAttribution: string | null;
  reflectionSourceUrl: string | null;
  methodDoc: typeof LECTIO_METHOD_DOC;
  introDoc: typeof LECTIO_INTRO_DOC;
}

/** Local calendar YYYY-MM-DD. */
export function localDateIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function stripHtmlLite(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function snippet(text: string, max = 420): string {
  const t = stripHtmlLite(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}…`;
}

export function buildLectioDay(args: {
  now?: Date;
  saints?: LectioSaintBrief[];
  palabra?: PalabraDelDia | null;
}): LectioDay {
  const now = args.now ?? new Date();
  const dateIso = localDateIso(now);
  const lit = liturgicalDateOf(now);
  const readings = lecturasForLiturgicalDate(lit);
  const gospel = readings.find((r) => r.role === 'gospel') || null;
  const word = args.palabra || null;
  const overlay = word?.reflection?.text ? word.reflection : null;
  return {
    dateIso,
    liturgicalLabel: liturgicalLabelEs(lit),
    readings,
    gospel,
    saints: args.saints || [],
    reflectionText: overlay?.text || LECTIO_OFFLINE_REFLECTION.text,
    reflectionAttribution:
      overlay?.attribution || LECTIO_OFFLINE_REFLECTION.attribution,
    reflectionSourceUrl: word?.sourceUrl || null,
    methodDoc: LECTIO_METHOD_DOC,
    introDoc: LECTIO_INTRO_DOC,
  };
}
