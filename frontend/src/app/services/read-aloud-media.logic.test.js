/**
 * Sesión de medios de la lectura en voz alta.
 * Run: node --experimental-strip-types src/app/services/read-aloud-media.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'read-aloud-media.logic.ts');
const SPEECH = path.join(HERE, 'speech-prep.logic.ts');
const NARRATOR = path.join(HERE, 'narrator.service.ts');
const LECTOR = path.resolve(HERE, '../components/lector/lector.component.ts');
const LECTOR_HTML = path.resolve(HERE, '../components/lector/lector.component.html');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC));
  const narrator = fs.readFileSync(NARRATOR, 'utf8');
  const lector = fs.readFileSync(LECTOR, 'utf8');
  const html = fs.readFileSync(LECTOR_HTML, 'utf8');
  assert.ok(narrator.includes('carrierWavBytes'), 'narrator owns the carrier audio');
  assert.ok(narrator.includes('holdWebMedia'), 'play starts the carrier in the gesture');
  assert.ok(narrator.includes('syncReadAloudMedia'), 'session metadata lives in the narrator');
  assert.ok(narrator.includes('recoverWebSpeech'), 'return-to-foreground recovery stays in the narrator');
  assert.ok(!/document\.hidden/.test(narrator), 'narrator does not branch on page visibility');
  assert.ok(lector.includes('holdWebMedia'), 'lector holds media on the click');
  assert.ok(lector.includes('stepNarrator'), 'lector steps paragraphs');
  assert.ok(lector.includes('bindReadAloudSession'), 'lector binds system controls');
  assert.ok(lector.includes("generation !== this.narrStartGen"), 'a superseded utterance does not advance');
  assert.ok(html.includes('reader.previous'), 'previous control is in the bar');
  assert.ok(html.includes('reader.next'), 'next control is in the bar');
  assert.ok(html.includes('data-narr="previous"'));
  assert.ok(html.includes('data-narr="next"'));

  const media = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const speech = await import(pathToFileURL(SPEECH).href + `?t=${Date.now()}`);

  section('speechSynthesis is not a media element');
  assert.strictEqual(media.SPEECH_SYNTHESIS_BACKGROUND.blinkPausesOnHide, false);
  assert.strictEqual(media.SPEECH_SYNTHESIS_BACKGROUND.exposesAudioBuffer, false);
  assert.strictEqual(media.SPEECH_SYNTHESIS_BACKGROUND.bindsMediaSession, false);
  assert.strictEqual(media.SPEECH_SYNTHESIS_BACKGROUND.iosContinuesInBackground, false);

  section('media session plan');
  const playing = media.planMediaSession({
    phase: 'playing',
    title: '  Catecismo  ',
  });
  assert.strictEqual(playing.title, 'Catecismo');
  assert.strictEqual(playing.artist, 'Documentos Vaticanos');
  assert.strictEqual(playing.playbackState, 'playing');
  assert.deepStrictEqual(playing.actions, [
    'play',
    'pause',
    'previoustrack',
    'nexttrack',
  ]);
  assert.strictEqual(
    media.planMediaSession({ phase: 'paused', title: '' }).playbackState,
    'paused',
  );
  assert.strictEqual(
    media.planMediaSession({ phase: 'idle', title: '   ' }).title,
    'Documentos Vaticanos',
  );
  assert.strictEqual(
    media.planMediaSession({ phase: 'idle', title: '' }).playbackState,
    'none',
  );

  section('previous and next bounds');
  assert.deepStrictEqual(
    media.planTrackStep({ direction: 'next', unitIndex: 2, unitCount: 5 }),
    { fromIndex: 3 },
  );
  assert.strictEqual(
    media.planTrackStep({ direction: 'next', unitIndex: 4, unitCount: 5 }),
    null,
  );
  assert.deepStrictEqual(
    media.planTrackStep({ direction: 'previous', unitIndex: 2, unitCount: 5 }),
    { fromIndex: 1 },
  );
  assert.strictEqual(
    media.planTrackStep({ direction: 'previous', unitIndex: 0, unitCount: 5 }),
    null,
  );
  assert.strictEqual(
    media.planTrackStep({ direction: 'next', unitIndex: 0, unitCount: 0 }),
    null,
  );

  section('speakable neighbor skips a placeholder');
  const units = [
    { contenido: 'Primero.' },
    { contenido: '[OCR: índice o tabla ilegible omitido]' },
    { contenido: 'Tercero.' },
  ];
  assert.strictEqual(speech.previousSpeakableIndex(units, 1).index, 0);
  assert.strictEqual(speech.nextSpeakableIndex(units, 1).index, 2);
  assert.strictEqual(speech.previousSpeakableIndex(units, -1), null);

  section('carrier wav is audible-session audio, not a tone');
  assert.ok(media.CARRIER_DURATION_SEC >= 5);
  assert.notStrictEqual(media.CARRIER_ELEMENT_VOLUME, 0);
  const wav = media.carrierWavBytes();
  assert.strictEqual(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.strictEqual(String.fromCharCode(...wav.slice(8, 12)), 'WAVE');
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const dataBytes = view.getUint32(40, true);
  assert.strictEqual(dataBytes, media.CARRIER_SAMPLE_RATE * media.CARRIER_DURATION_SEC * 2);
  assert.strictEqual(wav.byteLength, 44 + dataBytes);
  assert.strictEqual(view.getInt16(44, true), 1);
  assert.strictEqual(view.getInt16(46, true), -1);

  console.log('\nAll read-aloud media tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
