/**
 * Sourced papal life sheet: vatican.va list fields + optional santoral bio.
 * Does not invent narrative.
 */

import type { VaticanPopeRow } from './parse_holy_father_list';
import type { SaintLite } from './match_santoral';

export function composePopeBio(
  row: VaticanPopeRow,
  saint: SaintLite | null,
): string {
  const parts: string[] = [];
  const end = row.reignEnd ? row.reignEnd : 'en curso';
  const start = row.reignStart || '—';
  parts.push(
    `${row.name}, ${row.ordinal}º papa de la Iglesia católica.`,
  );
  if (row.secularName) {
    parts.push(`Nombre secular: ${row.secularName}.`);
  }
  if (row.birthplace) {
    parts.push(`Lugar de nacimiento: ${row.birthplace}.`);
  }
  parts.push(`Pontificado: ${start} – ${end}.`);
  if (row.century) {
    parts.push(`Siglo ${row.century}.`);
  }
  parts.push('');
  parts.push(
    'Ficha compilada a partir de la lista oficial de pontífices de vatican.va (no sustituye una biografía crítica).',
  );
  const saintBio = (saint?.bio || '').trim();
  if (saintBio) {
    parts.push('');
    parts.push(saintBio);
  }
  return parts.join('\n');
}

export function compactReign(row: VaticanPopeRow): string {
  const a = (row.reignStart || '').trim();
  const b = (row.reignEnd || '').trim();
  if (a && b) return `${a} – ${b}`;
  if (a && !b) return `${a} – en curso`;
  if (!a && b) return `– ${b}`;
  return '';
}

export function popeInitials(name: string): string {
  const cleaned = String(name || '')
    .replace(/^(San|Santa|Santo|Beato|Beata)\s+/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
