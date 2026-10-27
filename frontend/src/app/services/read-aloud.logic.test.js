/**
 * Lectura en voz alta offline (TTS del dispositivo). Sin UI.
 * Run: node --experimental-strip-types src/app/services/read-aloud.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'read-aloud.logic.ts');
const PREFS = path.join(HERE, 'narrator-prefs.logic.ts');
const LECTOR = path.resolve(HERE, '../components/lector/lector.component.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC));
  const lectorSrc = fs.readFileSync(LECTOR, 'utf8');
  for (const needle of [
    'read-aloud.logic',
    'toggleReadAloud',
    'pickDeviceVoice',
    'planSpeak',
    'afterUtterance',
    'parseReadAloudCheckpoint',
    'changeReadAloudRate',
    'setRate',
    'applyGlobalVoice',
    'setVoiceId',
    'startNarratorFrom',
  ]) {
    assert.ok(lectorSrc.includes(needle), `lector wires ${needle}`);
  }
  assert.ok(
    lectorSrc.includes('this.narrPrefs.voiceId'),
    'lector reads the saved voice without overwriting a missing one',
  );

  const aloud = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const prefs = await import(pathToFileURL(PREFS).href + `?t=${Date.now()}`);

  section('device voice, not Grok');
  const catalog = [
    { id: 'es-ES#0', name: 'Paulina', lang: 'es-ES', provider: 'system' },
    { id: 'es-MX#1', name: 'Sabina', lang: 'es-MX', provider: 'system' },
    { id: 'en-US#2', name: 'Samantha', lang: 'en-US', provider: 'system' },
    { id: 'grok:eve', name: 'Eve', lang: 'es-ES', provider: 'grok' },
  ];
  const spanish = aloud.deviceVoices(catalog, 'es');
  assert.deepStrictEqual(
    spanish.map((voice) => voice.id),
    ['es-ES#0', 'es-MX#1'],
  );
  assert.strictEqual(aloud.pickDeviceVoice(catalog, 'grok:eve', 'es'), null);
  assert.strictEqual(aloud.pickDeviceVoice(catalog, null, 'es'), null);
  assert.strictEqual(aloud.pickDeviceVoice(catalog, 'es-MX#1', 'es').id, 'es-MX#1');
  assert.strictEqual(aloud.pickDeviceVoice(catalog, 'en-US#2', 'es'), null);
  assert.strictEqual(aloud.cycleDeviceVoice(spanish, 'es-ES#0').id, 'es-MX#1');
  assert.strictEqual(aloud.cycleDeviceVoice(spanish, null).id, 'es-ES#0');
  assert.strictEqual(
    aloud.cycleDeviceVoice([spanish[0]], 'es-ES#0'),
    null,
  );

  section('pause resumes the spoken paragraph');
  const paused = aloud.toggleReadAloud({
    phase: 'playing',
    unitIndex: 12,
    visibleIndex: 40,
  });
  assert.deepStrictEqual(paused, { action: 'pause' });
  const resumed = aloud.toggleReadAloud({
    phase: 'paused',
    unitIndex: 12,
    visibleIndex: 40,
  });
  assert.deepStrictEqual(resumed, { action: 'speak', fromIndex: 12 });
  const started = aloud.toggleReadAloud({
    phase: 'idle',
    unitIndex: 0,
    visibleIndex: 40,
  });
  assert.deepStrictEqual(started, { action: 'speak', fromIndex: 40 });

  section('rate');
  assert.strictEqual(aloud.nextReadAloudRate(1), 1.25);
  assert.strictEqual(aloud.nextReadAloudRate(1.25), 1.5);
  assert.strictEqual(aloud.nextReadAloudRate(1.5), 0.75);
  assert.strictEqual(aloud.nextReadAloudRate(0.75), 1);
  assert.strictEqual(aloud.normalizeReadAloudRate(9), 1);
  assert.strictEqual(aloud.utteranceRate(1, 'heading', 0.82), 0.82);
  assert.strictEqual(aloud.utteranceRate(1.5, 'body', 0.82), 1.5);
  const whilePlaying = aloud.changeReadAloudRate({
    phase: 'playing',
    rate: 1,
    unitIndex: 12,
  });
  assert.strictEqual(whilePlaying.rate, 1.25);
  assert.strictEqual(whilePlaying.restartFrom, 12);
  const whilePaused = aloud.changeReadAloudRate({
    phase: 'paused',
    rate: 1,
    unitIndex: 12,
  });
  assert.strictEqual(whilePaused.restartFrom, null);

  assert.deepStrictEqual(
    [...aloud.READ_ALOUD_RATES],
    [0.75, 1, 1.25, 1.5],
  );
  for (const rate of aloud.READ_ALOUD_RATES) {
    assert.strictEqual(prefs.normalizeNarratorRate(rate), rate);
  }
  assert.strictEqual(prefs.normalizeNarratorRate(3), 1);
  const stored = prefs.parseNarratorDevicePrefs(
    JSON.stringify({ rate: 1.25, voiceId: 'es-ES#0' }),
  );
  assert.strictEqual(stored.rate, 1.25);
  assert.strictEqual(prefs.parseNarratorDevicePrefs('{}').rate, 1);
  const round = prefs.parseNarratorDevicePrefs(
    prefs.serializeNarratorDevicePrefs({
      grokEnabled: false,
      voiceId: null,
      xaiApiKey: null,
      readCitationPrefix: true,
      rate: 1.5,
    }),
  );
  assert.strictEqual(round.rate, 1.5);
  const backup = prefs.narratorPrefsForBackup({
    grokEnabled: true,
    voiceId: 'es-ES#0',
    xaiApiKey: 'xai-secret',
    rate: 0.75,
  });
  assert.strictEqual(backup.rate, 0.75);
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(backup, 'xaiApiKey'),
    false,
  );

  section('follow, resume checkpoint, screen off');
  const spoken = aloud.planSpeak({
    speakableIndex: 4,
    userRate: 1,
    kind: 'body',
    rateScale: 1,
    screenOff: false,
    platform: 'android',
  });
  assert.strictEqual(spoken.action, 'speak');
  assert.strictEqual(spoken.follow, true);
  assert.strictEqual(spoken.foreground, true);
  const dark = aloud.planSpeak({
    speakableIndex: 4,
    userRate: 1,
    kind: 'body',
    screenOff: true,
    platform: 'web',
  });
  assert.strictEqual(dark.follow, false);
  assert.strictEqual(dark.foreground, false);
  assert.strictEqual(aloud.shouldHoldForeground('playing', 'android'), true);
  assert.strictEqual(aloud.shouldHoldForeground('playing', 'web'), false);
  assert.strictEqual(aloud.shouldHoldForeground('paused', 'android'), false);
  assert.strictEqual(aloud.shouldHoldForeground('playing', 'ios'), false);
  assert.deepStrictEqual(
    aloud.planSpeak({
      speakableIndex: null,
      userRate: 1,
      screenOff: false,
      platform: 'android',
    }),
    { action: 'stop' },
  );

  const advanced = aloud.afterUtterance({
    phase: 'playing',
    unitIndex: 4,
    finished: true,
    screenOff: true,
  });
  assert.deepStrictEqual(advanced, {
    advance: true,
    unitIndex: 5,
    persist: true,
    follow: false,
  });
  const cancelled = aloud.afterUtterance({
    phase: 'paused',
    unitIndex: 4,
    finished: false,
    screenOff: false,
  });
  assert.strictEqual(cancelled.advance, false);
  assert.strictEqual(
    aloud.paragraphToFollowOnShow({
      phase: 'playing',
      unitIndex: 5,
      hidden: false,
    }),
    5,
  );
  assert.strictEqual(
    aloud.paragraphToFollowOnShow({
      phase: 'playing',
      unitIndex: 5,
      hidden: true,
    }),
    null,
  );
  assert.strictEqual(
    aloud.paragraphToFollowOnShow({
      phase: 'paused',
      unitIndex: 5,
      hidden: false,
    }),
    null,
  );

  const raw = aloud.serializeReadAloudCheckpoint({
    documentId: 'cic-es',
    unitIndex: 12,
    phase: 'paused',
  });
  assert.deepStrictEqual(aloud.parseReadAloudCheckpoint(raw, 'cic-es'), {
    documentId: 'cic-es',
    unitIndex: 12,
    phase: 'paused',
  });
  assert.strictEqual(aloud.parseReadAloudCheckpoint(raw, 'lg-es'), null);
  assert.strictEqual(aloud.parseReadAloudCheckpoint('{', 'cic-es'), null);
  assert.strictEqual(
    aloud.parseReadAloudCheckpoint(
      JSON.stringify({ documentId: 'cic-es', unitIndex: -1, phase: 'paused' }),
      'cic-es',
    ),
    null,
  );

  console.log('\nAll read-aloud logic tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
