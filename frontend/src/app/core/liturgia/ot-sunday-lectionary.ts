/**
 * Ordinary Time Sundays A / B / C (first, psalm, second, gospel).
 * Index 1–34 (slot 0 unused).
 */

export interface SundayCites {
  first?: string;
  psalm?: string;
  second?: string;
  gospel?: string;
}

export const OT_SUNDAY: Record<number, Record<'A' | 'B' | 'C', SundayCites>> = {
  1: {
    A: { first: 'Is 49,3.5-6', psalm: 'Sal 40', second: '1Co 1,1-3', gospel: 'Jn 1,29-34' },
    B: { first: '1S 3,3-10.19', psalm: 'Sal 40', second: '1Co 6,13-15.17-20', gospel: 'Jn 1,35-42' },
    C: { first: 'Is 62,1-5', psalm: 'Sal 96', second: '1Co 12,4-11', gospel: 'Jn 2,1-11' },
  },
  2: {
    A: { first: 'Is 49,3.5-6', psalm: 'Sal 40', second: '1Co 1,1-3', gospel: 'Jn 1,29-34' },
    B: { first: '1S 3,3-10.19', psalm: 'Sal 40', second: '1Co 6,13-15.17-20', gospel: 'Jn 1,35-42' },
    C: { first: 'Is 62,1-5', psalm: 'Sal 96', second: '1Co 12,4-11', gospel: 'Jn 2,1-11' },
  },
  20: {
    A: { first: 'Is 56,1.6-7', psalm: 'Sal 67', second: 'Rm 11,13-15.29-32', gospel: 'Mt 15,21-28' },
    B: { first: 'Pr 9,1-6', psalm: 'Sal 34', second: 'Ef 5,15-20', gospel: 'Jn 6,51-58' },
    C: { first: 'Jr 38,4-6.8-10', psalm: 'Sal 40', second: 'Hb 12,1-4', gospel: 'Lc 12,49-53' },
  },
  21: {
    A: { first: 'Is 22,19-23', psalm: 'Sal 138', second: 'Rm 11,33-36', gospel: 'Mt 16,13-20' },
    B: { first: 'Jos 24,1-2.15-18', psalm: 'Sal 34', second: 'Ef 5,21-32', gospel: 'Jn 6,60-69' },
    C: { first: 'Is 66,18-21', psalm: 'Sal 117', second: 'Hb 12,5-7.11-13', gospel: 'Lc 13,22-30' },
  },
};
