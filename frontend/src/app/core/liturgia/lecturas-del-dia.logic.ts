/**
 * Daily Mass readings (Ordinary Time weekdays + Sundays).
 * Citations only — body comes from the bible pack.
 */

import { LiturgicalDate } from './liturgical-date.logic';
import { OT_WEEKDAY_GOSPEL, OT_WEEKDAY_YEAR } from './ot-weekday-lectionary';
import { OT_SUNDAY } from './ot-sunday-lectionary';

export type LecturaRole = 'first' | 'psalm' | 'second' | 'gospel';

export interface LecturaItem {
  id: string;
  role: LecturaRole;
  label: string;
  cite: string;
}

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

/**
 * Readings for a classified liturgical date.
 * Ordinary Time: weekday 2-year cycle + Sunday A/B/C.
 * Other seasons: empty list (no invented solemnity tables yet).
 */
export function lecturasForLiturgicalDate(info: LiturgicalDate): LecturaItem[] {
  if (info.season !== 'ordinary') return [];
  const week = info.week;
  if (week < 1 || week > 34) return [];

  if (info.weekday === 0) {
    const row = OT_SUNDAY[week]?.[info.sundayCycle];
    if (!row) return [];
    const out: LecturaItem[] = [];
    if (row.first) out.push(item('first', row.first, 0));
    if (row.psalm) out.push(item('psalm', row.psalm, 1));
    if (row.second) out.push(item('second', row.second, 2));
    if (row.gospel) out.push(item('gospel', row.gospel, 3));
    return out;
  }

  const dow = info.weekday - 1; // Mon=0
  const gospel = OT_WEEKDAY_GOSPEL[week - 1]?.[dow];
  const yr = OT_WEEKDAY_YEAR[info.weekdayYear]?.[week - 1]?.[dow];
  const out: LecturaItem[] = [];
  if (yr?.first) out.push(item('first', yr.first, 0));
  if (yr?.psalm) out.push(item('psalm', yr.psalm, 1));
  if (gospel) out.push(item('gospel', gospel, 2));
  return out;
}
