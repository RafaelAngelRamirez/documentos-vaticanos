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

/**
 * Packed excerpt of Verbum Domini n. 87 (Benedict XVI). Always available
 * offline; Vatican News «Palabra del día» may overlay when cached.
 */
export const LECTIO_OFFLINE_REFLECTION = {
  text:
    'Se ha prestado una mayor atención a la lectio divina, que es verdaderamente capaz de abrir al fiel no sólo el tesoro de la Palabra de Dios sino también de crear el encuentro con Cristo, Palabra divina y viviente. Se comienza con la lectura del texto: ¿Qué dice el texto bíblico en sí mismo? Sigue la meditación: ¿Qué nos dice el texto bíblico a nosotros? Luego la oración: ¿Qué decimos nosotros al Señor como respuesta a su Palabra? Y la contemplación: ¿Qué conversión de la mente, del corazón y de la vida nos pide el Señor?',
  attribution: 'Benedicto XVI, Verbum Domini n. 87',
  documentId: 'vd-es',
  consecutivo: '87',
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
