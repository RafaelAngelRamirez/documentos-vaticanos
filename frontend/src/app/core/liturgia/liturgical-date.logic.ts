/**
 * Roman Ordinary Form liturgical date (Western Easter).
 * Pure functions — no Angular DI.
 */

export type LiturgicalSeason =
  | 'ordinary'
  | 'advent'
  | 'christmas'
  | 'lent'
  | 'easter'
  | 'triduum';

export type LiturgicalFeast =
  | 'ash-wednesday'
  | 'palm-sunday'
  | 'holy-thursday'
  | 'good-friday'
  | 'easter-vigil'
  | 'easter'
  | 'ascension'
  | 'pentecost'
  | 'trinity'
  | 'corpus-christi'
  | 'sacred-heart'
  | 'christ-the-king'
  | 'baptism'
  | 'epiphany'
  | 'christmas'
  | 'mary-mother'
  | 'holy-family'
  | 'immaculate-conception'
  | 'assumption'
  | 'all-saints';

export interface LiturgicalDate {
  season: LiturgicalSeason;
  /** 1–34 in Ordinary Time; Advent 1–4; Lent 0 (Ash week) then 1–6; Easter 1–7. */
  week: number;
  /** 0 = Sunday … 6 = Saturday (local date). */
  weekday: number;
  /** Sunday cycle A/B/C when in OT (or Advent of that year). */
  sundayCycle: 'A' | 'B' | 'C';
  /** Weekday lectionary year I (odd civil) / II (even civil). */
  weekdayYear: 'I' | 'II';
  /** Civil month 1–12. */
  month: number;
  /** Civil day 1–31. */
  day: number;
  /** Ranked temporal/sanctoral solemnity when it replaces the feria. */
  feast?: LiturgicalFeast;
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function ymd(d: Date): { y: number; m: number; day: number } {
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function cmp(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/** Gregorian computus (Anonymous / Meeus). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

/** First Sunday of Advent (Sunday nearest 30 Nov = 4th Sunday before Christmas). */
export function adventSunday1(year: number): Date {
  const xmas = utcDate(year, 12, 25);
  let adv4 = xmas;
  while (adv4.getUTCDay() !== 0) {
    adv4 = addDays(adv4, -1);
  }
  if (adv4.getUTCMonth() === 11 && adv4.getUTCDate() === 25) {
    // Christmas on Sunday is Advent 4
  }
  return addDays(adv4, -21);
}

export function christTheKing(year: number): Date {
  return addDays(adventSunday1(year), -7);
}

/** Sunday on or before the given UTC calendar day. */
export function sundayOnOrBefore(d: Date): Date {
  return addDays(d, -d.getUTCDay());
}

function localAsUtc(d: Date): Date {
  return utcDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Sunday cycle: A = year whose Advent starts in 2 mod 3, etc.
 * 2025–26 = A, 2026–27 = B, 2027–28 = C.
 */
export function sundayCycleForDate(d: Date): 'A' | 'B' | 'C' {
  const u = localAsUtc(d);
  const y = u.getUTCFullYear();
  const adv = adventSunday1(y);
  const litYearStart = cmp(u, adv) >= 0 ? y : y - 1;
  const r = ((litYearStart - 2025) % 3 + 3) % 3;
  return r === 0 ? 'A' : r === 1 ? 'B' : 'C';
}

export function weekdayYearForDate(d: Date): 'I' | 'II' {
  const y = d.getFullYear();
  return y % 2 === 0 ? 'II' : 'I';
}

/** Sunday in the octave of Christmas, or 30 Dec if Christmas is Sunday. */
export function holyFamilyDate(christmasYear: number): Date {
  const xmas = utcDate(christmasYear, 12, 25);
  if (xmas.getUTCDay() === 0) return utcDate(christmasYear, 12, 30);
  let d = utcDate(christmasYear, 12, 26);
  while (d.getUTCDay() !== 0) d = addDays(d, 1);
  return d;
}

/** Baptism of the Lord (Sunday after 6 Jan, or the next Sunday if 6 Jan is Sunday). */
export function baptismDate(christmasEndYear: number): Date {
  const jan6 = utcDate(christmasEndYear, 1, 6);
  let baptism = jan6;
  while (baptism.getUTCDay() !== 0) baptism = addDays(baptism, 1);
  if (baptism.getUTCDate() === 6) baptism = addDays(baptism, 7);
  return baptism;
}

/**
 * Classify a civil local date into season + OT week number.
 */
export function liturgicalDateOf(d: Date): LiturgicalDate {
  const u = localAsUtc(d);
  const y = u.getUTCFullYear();
  const easter = easterSunday(y);
  const ash = addDays(easter, -46);
  const pentecost = addDays(easter, 49);
  const adv1 = adventSunday1(y);
  const xmas = utcDate(y, 12, 25);
  const prevXmas = utcDate(y - 1, 12, 25);

  const weekday = u.getUTCDay();
  const sundayCycle = sundayCycleForDate(d);
  const weekdayYear = weekdayYearForDate(d);
  const month = u.getUTCMonth() + 1;
  const day = u.getUTCDate();
  const stamp = (
    partial: Omit<
      LiturgicalDate,
      'sundayCycle' | 'weekdayYear' | 'month' | 'day' | 'feast'
    > & { feast?: LiturgicalFeast },
  ): LiturgicalDate => ({
    ...partial,
    sundayCycle,
    weekdayYear,
    month,
    day,
  });

  const holyThu = addDays(easter, -3);
  const goodFri = addDays(easter, -2);
  const holySat = addDays(easter, -1);
  if (cmp(u, holyThu) >= 0 && cmp(u, holySat) <= 0) {
    const feast: LiturgicalFeast =
      cmp(u, holyThu) === 0
        ? 'holy-thursday'
        : cmp(u, goodFri) === 0
          ? 'good-friday'
          : 'easter-vigil';
    return stamp({ season: 'triduum', week: 0, weekday, feast });
  }
  if (cmp(u, ash) >= 0 && cmp(u, holyThu) < 0) {
    const sun = sundayOnOrBefore(u);
    const lent1 = sundayOnOrBefore(addDays(ash, 6));
    if (cmp(u, lent1) < 0) {
      return stamp({
        season: 'lent',
        week: 0,
        weekday,
        feast: weekday === 3 ? 'ash-wednesday' : undefined,
      });
    }
    const week = Math.max(1, Math.round((cmp(sun, lent1) / 86400000) / 7) + 1);
    return stamp({
      season: 'lent',
      week,
      weekday,
      feast: weekday === 0 && week >= 6 ? 'palm-sunday' : undefined,
    });
  }
  if (cmp(u, easter) >= 0 && cmp(u, pentecost) <= 0) {
    const sun = sundayOnOrBefore(u);
    const week = Math.round((cmp(sun, easter) / 86400000) / 7) + 1;
    let feast: LiturgicalFeast | undefined;
    if (cmp(u, easter) === 0) feast = 'easter';
    else if (cmp(u, addDays(easter, 39)) === 0) feast = 'ascension';
    else if (cmp(u, pentecost) === 0) feast = 'pentecost';
    return stamp({ season: 'easter', week, weekday, feast });
  }
  if (cmp(u, adv1) >= 0 && cmp(u, xmas) < 0) {
    const sun = sundayOnOrBefore(u);
    const week = Math.round((cmp(sun, adv1) / 86400000) / 7) + 1;
    const feast: LiturgicalFeast | undefined =
      month === 12 && day === 8 && weekday !== 0
        ? 'immaculate-conception'
        : undefined;
    return stamp({ season: 'advent', week, weekday, feast });
  }
  const christmasStart =
    cmp(u, xmas) >= 0 ? xmas : prevXmas;
  const christmasEndYear = cmp(u, xmas) >= 0 ? y + 1 : y;
  const baptism = baptismDate(christmasEndYear);
  if (cmp(u, christmasStart) >= 0 && cmp(u, baptism) <= 0) {
    const xmasYear = cmp(u, xmas) >= 0 ? y : y - 1;
    let feast: LiturgicalFeast | undefined;
    if (month === 12 && day === 25) feast = 'christmas';
    else if (month === 1 && day === 1) feast = 'mary-mother';
    else if (month === 1 && day === 6) feast = 'epiphany';
    else if (cmp(u, baptism) === 0) feast = 'baptism';
    else if (cmp(u, holyFamilyDate(xmasYear)) === 0) feast = 'holy-family';
    return stamp({ season: 'christmas', week: 1, weekday, feast });
  }

  const ctk = christTheKing(y);
  const sun = sundayOnOrBefore(u);
  const trinity = addDays(pentecost, 7);
  const corpus = addDays(pentecost, 14);
  const sacredHeart = addDays(pentecost, 19);

  let feast: LiturgicalFeast | undefined;
  if (cmp(u, trinity) === 0) feast = 'trinity';
  else if (cmp(u, corpus) === 0) feast = 'corpus-christi';
  else if (cmp(u, sacredHeart) === 0) feast = 'sacred-heart';
  else if (month === 8 && day === 15) feast = 'assumption';
  else if (month === 11 && day === 1) feast = 'all-saints';

  if (cmp(u, pentecost) > 0 && cmp(u, adv1) < 0) {
    const weeksBefore = Math.round((cmp(ctk, sun) / 86400000) / 7);
    const week = Math.min(34, Math.max(1, 34 - weeksBefore));
    if (weekday === 0 && week === 34) feast = 'christ-the-king';
    return stamp({ season: 'ordinary', week, weekday, feast });
  }

  const otStart = addDays(baptism, 1);
  const sun0 = sundayOnOrBefore(addDays(otStart, 6));
  let week = Math.round((cmp(sun, sun0) / 86400000) / 7) + 2;
  if (weekday !== 0 && cmp(u, sun0) < 0) week = 1;
  week = Math.min(34, Math.max(1, week));
  return stamp({ season: 'ordinary', week, weekday, feast });
}

export function liturgicalLabelEs(info: LiturgicalDate): string {
  const days = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  const day = days[info.weekday] || '';
  if (info.season === 'ordinary') {
    if (info.weekday === 0) {
      return `${info.week}º domingo del Tiempo Ordinario`;
    }
    return `${day} de la ${info.week}ª semana del Tiempo Ordinario`;
  }
  if (info.season === 'advent') {
    return info.weekday === 0
      ? `${info.week}º domingo de Adviento`
      : `${day} de la ${info.week}ª semana de Adviento`;
  }
  if (info.season === 'lent') {
    return info.weekday === 0
      ? `${info.week}º domingo de Cuaresma`
      : `${day} de la ${info.week}ª semana de Cuaresma`;
  }
  if (info.season === 'easter') {
    return info.weekday === 0
      ? info.week === 1
        ? 'Domingo de Pascua'
        : `${info.week}º domingo de Pascua`
      : `${day} de la ${info.week}ª semana de Pascua`;
  }
  if (info.season === 'christmas') return 'Tiempo de Navidad';
  return 'Triduo Pascual';
}
