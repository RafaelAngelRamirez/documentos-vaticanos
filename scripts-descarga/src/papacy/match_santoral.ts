/**
 * Link a vatican.va pontiff row to an existing santoral saint (when any).
 * Never invents a saint; unmatched popes stay without saintId.
 */

export interface SaintLite {
  id: string;
  name: string;
  displayName?: string;
  role?: string;
  feastDays?: string[];
  bio?: string;
}

function fold(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(san|santa|santo|beato|beata|blessed|st\.?)\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isPopeSaint(s: SaintLite): boolean {
  const role = (s.role || '').toLowerCase();
  if (/\bpapa\b/.test(role)) return true;
  // Beatified/canonized modern popes sometimes omit "papa" in the role field.
  if (s.id === 'pedro' || s.id === 'juan-pablo-i') return true;
  return false;
}

/** Pope pack id → santoral id when names/slugs diverge. */
export const SAINT_ID_OVERRIDES: Record<string, string> = {
  pedro: 'pedro',
  anacleto: 'cleto',
  'clemente-i': 'clemente-i',
  higinio: 'iginio',
  'esteban-i': 'stefano-i',
  melquiades: 'milciades',
  marcos: 'marco',
  'anastasio-i': 'anastasio',
  'gregorio-i': 'gregorio-magno',
  'leon-i': 'leon-magno',
  'celestino-v': 'pedro-celestino-v',
  'pablo-i': 'pablo-i',
};

export function matchPopeToSaint(
  pope: { id: string; name: string; ordinal: number },
  saints: SaintLite[],
): SaintLite | null {
  const override = SAINT_ID_OVERRIDES[pope.id];
  if (override) {
    const hit = saints.find((s) => s.id === override);
    if (hit) return hit;
  }
  const exact = saints.find((s) => s.id === pope.id);
  if (exact && isPopeSaint(exact)) return exact;

  const popeKey = fold(pope.name);
  const popeIdFold = fold(pope.id.replace(/-/g, ' '));
  const candidates = saints.filter(isPopeSaint);
  for (const s of candidates) {
    const keys = [fold(s.id.replace(/-/g, ' ')), fold(s.name), fold(s.displayName)];
    if (keys.includes(popeKey) || keys.includes(popeIdFold)) return s;
  }
  return null;
}

export function honorFromSaint(
  saint: SaintLite | null,
): 'saint' | 'blessed' | 'venerable' | 'none' {
  if (!saint) return 'none';
  const blob = `${saint.displayName || ''} ${saint.name || ''} ${saint.role || ''}`.toLowerCase();
  if (/\bbeat[oa]\b/.test(blob)) return 'blessed';
  if (saint.id === 'juan-pablo-i') return 'blessed';
  if (saint.id === 'pio-ix') return 'blessed';
  if (saint.id === 'pedro') return 'saint';
  return 'saint';
}
