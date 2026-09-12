/**
 * Daily Mass readings from packed OLM citations (all seasons).
 * Body text comes from the bible pack — this file has verse refs only.
 *
 * Citation tables: Ordo Lectionum Missae (1981), compiled after Felix Just, S.J.
 * https://catholic-resources.org/Lectionary/
 */

import type { LiturgicalDate, LiturgicalFeast } from './liturgical-date.logic';
import { OT_WEEKDAY_GOSPEL, OT_WEEKDAY_YEAR } from './ot-weekday-lectionary';
import { OLM_PACK as pack } from './olm-pack';

export type LecturaRole = 'first' | 'psalm' | 'second' | 'gospel';

export interface LecturaItem {
  id: string;
  role: LecturaRole;
  label: string;
  cite: string;
}

type OlmCites = {
  first?: string;
  psalm?: string;
  second?: string;
  gospel?: string;
};

type Abc = 'A' | 'B' | 'C';

const PACK = pack as {
  adventWeekday: OlmCites[][];
  lentWeekday: OlmCites[][];
  easterWeekday: OlmCites[][];
  ash: Record<string, OlmCites>;
  dec17: Record<string, OlmCites>;
  christmasDays: Record<string, OlmCites>;
  afterEpiphany: OlmCites[];
  adventSunday: Record<string, Record<Abc, OlmCites>>;
  lentSunday: Record<string, Record<Abc, OlmCites>>;
  easterSunday: Record<string, Record<Abc, OlmCites>>;
  otSunday: Record<string, Record<Abc, OlmCites>>;
  feasts: Record<string, OlmCites | Record<Abc, OlmCites>>;
};

/** Fixed solemnities not in the seasonal weekday tables. */
const FIXED_DATES: Record<string, OlmCites> = {
  '12-08': {
    first: 'Gn 3,9-15.20',
    psalm: 'Sal 98',
    second: 'Ef 1,3-6.11-12',
    gospel: 'Lc 1,26-38',
  },
  '08-15': {
    first: 'Ap 11,19;12,1-6.10',
    psalm: 'Sal 45',
    second: '1Co 15,20-27',
    gospel: 'Lc 1,39-56',
  },
  '11-01': {
    first: 'Ap 7,2-4.9-14',
    psalm: 'Sal 24',
    second: '1Jn 3,1-3',
    gospel: 'Mt 5,1-12a',
  },
};

const EASTER_VIGIL: Record<Abc, OlmCites> = {
  A: {
    first: 'Gn 1,1–2,2',
    psalm: 'Sal 104',
    second: 'Rm 6,3-11',
    gospel: 'Mt 28,1-10',
  },
  B: {
    first: 'Gn 1,1–2,2',
    psalm: 'Sal 104',
    second: 'Rm 6,3-11',
    gospel: 'Mc 16,1-7',
  },
  C: {
    first: 'Gn 1,1–2,2',
    psalm: 'Sal 104',
    second: 'Rm 6,3-11',
    gospel: 'Lc 24,1-12',
  },
};

export function lecturaRoleLabel(role: LecturaRole): string {
  if (role === 'first') return 'Primera lectura';
  if (role === 'psalm') return 'Salmo';
  if (role === 'second') return 'Segunda lectura';
  return 'Evangelio';
}

function item(role: LecturaRole, cite: string, i: number): LecturaItem {
  return {
    id: `${role}-${i}`,
    role,
    label: lecturaRoleLabel(role),
    cite,
  };
}

function toItems(row: OlmCites | null | undefined): LecturaItem[] {
  if (!row) return [];
  const out: LecturaItem[] = [];
  let i = 0;
  if (row.first) out.push(item('first', row.first, i++));
  if (row.psalm) out.push(item('psalm', row.psalm, i++));
  if (row.second) out.push(item('second', row.second, i++));
  if (row.gospel) out.push(item('gospel', row.gospel, i++));
  return out;
}

function cycleRow(
  map: Record<string, Record<Abc, OlmCites>> | undefined,
  week: number,
  cycle: Abc,
): OlmCites | null {
  const block = map?.[String(week)];
  if (!block) return null;
  return block[cycle] || block.A || null;
}

function weekdayRow(grid: OlmCites[][] | undefined, week: number, weekday: number): OlmCites | null {
  if (weekday === 0) return null;
  const dow = weekday - 1;
  return grid?.[week - 1]?.[dow] || null;
}

function feastRow(feast: LiturgicalFeast | undefined, cycle: Abc): OlmCites | null {
  if (!feast) return null;
  if (feast === 'easter-vigil') return EASTER_VIGIL[cycle];
  const row = PACK.feasts[feast];
  if (!row) return null;
  if ('gospel' in row || 'first' in row) {
    const one = row as OlmCites;
    if (one.gospel || one.first) return one;
  }
  const cyc = row as Record<Abc, OlmCites>;
  return cyc[cycle] || cyc.A || null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ordinaryWeekday(info: LiturgicalDate): LecturaItem[] {
  const week = info.week;
  if (week < 1 || week > 34) return [];
  const dow = info.weekday - 1;
  const gospel = OT_WEEKDAY_GOSPEL[week - 1]?.[dow];
  const yr = OT_WEEKDAY_YEAR[info.weekdayYear]?.[week - 1]?.[dow];
  const out: LecturaItem[] = [];
  if (yr?.first) out.push(item('first', yr.first, 0));
  if (yr?.psalm) out.push(item('psalm', yr.psalm, 1));
  if (gospel) out.push(item('gospel', gospel, 2));
  return out;
}

/**
 * Readings for a classified liturgical date.
 * Packed OLM citations for Advent, Christmas, Lent, Easter, Triduum,
 * Sundays of Ordinary Time, and major solemnities. OT weekdays stay on
 * the existing ferial tables.
 */
export function lecturasForLiturgicalDate(info: LiturgicalDate): LecturaItem[] {
  const cycle = info.sundayCycle;
  const dateKey = `${pad2(info.month)}-${pad2(info.day)}`;

  const fromFeast = toItems(feastRow(info.feast, cycle));
  if (fromFeast.some((r) => r.role === 'gospel')) return fromFeast;

  const fixed = FIXED_DATES[dateKey];
  if (fixed?.gospel && info.feast) return toItems(fixed);

  if (info.season === 'advent') {
    if (info.month === 12 && info.day >= 17 && info.day <= 24 && info.weekday !== 0) {
      const row = PACK.dec17[String(info.day)];
      if (row?.gospel) return toItems(row);
    }
    if (info.weekday === 0) {
      return toItems(cycleRow(PACK.adventSunday, info.week, cycle));
    }
    return toItems(weekdayRow(PACK.adventWeekday, info.week, info.weekday));
  }

  if (info.season === 'christmas') {
    const byDay = PACK.christmasDays[dateKey];
    if (byDay?.gospel) return toItems(byDay);
    if (info.month === 1 && info.day >= 7 && info.weekday !== 0) {
      const dow = info.weekday - 1;
      const row = PACK.afterEpiphany[dow];
      if (row?.gospel) return toItems(row);
    }
    return [];
  }

  if (info.season === 'lent') {
    if (info.week === 0) {
      const key = String(info.weekday - 1);
      return toItems(PACK.ash[key]);
    }
    if (info.weekday === 0) {
      return toItems(cycleRow(PACK.lentSunday, info.week, cycle));
    }
    return toItems(weekdayRow(PACK.lentWeekday, info.week, info.weekday));
  }

  if (info.season === 'easter') {
    if (info.weekday === 0) {
      if (info.week === 1) return toItems(feastRow('easter', cycle));
      return toItems(cycleRow(PACK.easterSunday, info.week, cycle));
    }
    return toItems(weekdayRow(PACK.easterWeekday, info.week, info.weekday));
  }

  if (info.season === 'triduum') return fromFeast;

  if (info.weekday === 0) {
    return toItems(cycleRow(PACK.otSunday, info.week, cycle));
  }
  return ordinaryWeekday(info);
}
