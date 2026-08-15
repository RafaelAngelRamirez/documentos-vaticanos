import {
  cycleRate,
  narratorPrefsForBackup,
  parseNarratorPrefs,
  resolvePreferredVoice,
} from './narrator-prefs.logic';

describe('narrator-prefs.logic', () => {
  it('parses rate and never requires Grok by default', () => {
    const p = parseNarratorPrefs({ narrRate: 1.25, grokEnabled: true });
    expect(p.narrRate).toBe(1.25);
    expect(p.grokEnabled).toBe(true);
    expect(parseNarratorPrefs({}).grokEnabled).toBe(false);
  });

  it('backup omits the API key', () => {
    const bak = narratorPrefsForBackup({
      grokEnabled: true,
      xaiApiKey: 'xai-secret',
      narrRate: 1,
    });
    expect(bak && 'xaiApiKey' in bak).toBe(false);
  });

  it('resolvePreferredVoice falls back to first system voice', () => {
    const voices = [{ id: 'es-1' }, { id: 'grok:ara' }];
    expect(resolvePreferredVoice(voices, 'missing')?.id).toBe('es-1');
    expect(resolvePreferredVoice(voices, 'grok:ara')?.id).toBe('grok:ara');
  });

  it('cycleRate walks the discrete scale', () => {
    expect(cycleRate(1)).toBe(1.25);
    expect(cycleRate(1.5)).toBe(0.75);
  });
});
