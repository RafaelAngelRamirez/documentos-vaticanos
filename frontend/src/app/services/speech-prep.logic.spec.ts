import {
  countLetters,
  localeToBcp47,
  nextSpeakableIndex,
  prepareSpeechText,
} from './speech-prep.logic';

describe('speech-prep.logic', () => {
  it('counts Latin and non-Latin letters', () => {
    expect(countLetters('ab')).toBe(2);
    expect(countLetters('信仰')).toBe(2);
    expect(countLetters('धर्म')).toBe(3);
    expect(countLetters('سلام')).toBe(4);
    expect(countLetters('…—')).toBe(0);
  });

  it('does not skip CJK / Devanagari / Arabic units', () => {
    expect(prepareSpeechText('天主经').skip).toBe(false);
    expect(prepareSpeechText('धर्म ग्रन्थ').skip).toBe(false);
    expect(prepareSpeechText('السلام عليكم').skip).toBe(false);
    expect(prepareSpeechText('Fe').skip).toBe(false);
  });

  it('skips empty and too-short tokens', () => {
    expect(prepareSpeechText('').reason).toBe('empty');
    expect(prepareSpeechText('·').reason).toBe('too_short');
  });

  it('nextSpeakableIndex walks past OCR noise', () => {
    const units = [
      { contenido: '###' },
      { contenido: 'El Verbo se hizo carne.' },
    ];
    expect(nextSpeakableIndex(units, 0)).toBe(1);
  });

  it('maps pack locale to BCP-47', () => {
    expect(localeToBcp47('es')).toBe('es-ES');
    expect(localeToBcp47('zh')).toBe('zh-CN');
    expect(localeToBcp47('ar')).toBe('ar');
  });
});
