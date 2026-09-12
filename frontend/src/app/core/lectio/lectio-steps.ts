/**
 * Canonical lectio divina steps from Verbum Domini n. 87
 * (Benedict XVI, 2010). Questions are the magisterial wording, not invented.
 */

export const LECTIO_METHOD_DOC = {
  documentId: 'vd-es',
  consecutivo: '87',
} as const;

export const LECTIO_INTRO_DOC = {
  documentId: 'vd-es',
  consecutivo: '86',
} as const;

export type LectioStepId =
  | 'lectio'
  | 'meditatio'
  | 'oratio'
  | 'contemplatio'
  | 'actio';

export interface LectioStep {
  id: LectioStepId;
  latin: string;
  /** i18n key for the short Spanish/UI label. */
  labelKey: string;
  /** i18n key for the VD 87 question (or actio gloss). */
  questionKey: string;
}

export const LECTIO_STEPS: readonly LectioStep[] = [
  {
    id: 'lectio',
    latin: 'Lectio',
    labelKey: 'lectio.step.lectio',
    questionKey: 'lectio.step.lectio_q',
  },
  {
    id: 'meditatio',
    latin: 'Meditatio',
    labelKey: 'lectio.step.meditatio',
    questionKey: 'lectio.step.meditatio_q',
  },
  {
    id: 'oratio',
    latin: 'Oratio',
    labelKey: 'lectio.step.oratio',
    questionKey: 'lectio.step.oratio_q',
  },
  {
    id: 'contemplatio',
    latin: 'Contemplatio',
    labelKey: 'lectio.step.contemplatio',
    questionKey: 'lectio.step.contemplatio_q',
  },
  {
    id: 'actio',
    latin: 'Actio',
    labelKey: 'lectio.step.actio',
    questionKey: 'lectio.step.actio_q',
  },
];
