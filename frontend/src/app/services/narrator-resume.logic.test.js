/**
 * Reanudar la locución en la palabra actual.
 * Run: node --experimental-strip-types src/app/services/narrator-resume.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'narrator-resume.logic.ts');
const SERVICE = path.join(HERE, 'narrator.service.ts');
const LECTOR = path.resolve(HERE, '../components/lector/lector.component.ts');

function methodBody(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing ${startNeedle}`);
  assert.ok(end > start, `missing ${endNeedle}`);
  return src.slice(start, end);
}

async function main() {
  assert.ok(fs.existsSync(LOGIC));
  const serviceSrc = fs.readFileSync(SERVICE, 'utf8');
  const lectorSrc = fs.readFileSync(LECTOR, 'utf8');
  assert.ok(serviceSrc.includes('resumeSpeakText'), 'service slices with resumeSpeakText');
  assert.ok(serviceSrc.includes('onboundary'), 'web speech records the word boundary');
  assert.ok(serviceSrc.includes('async retune('), 'retune lives on NarratorService');

  const rateBody = methodBody(lectorSrc, 'cycleRate(): void {', 'private loadNarrVoices');
  assert.ok(rateBody.includes('this.narrator.retune'), 'rate retunes the live utterance');
  assert.ok(!rateBody.includes('startNarratorFrom'), 'rate does not restart the paragraph');

  const voiceBody = methodBody(lectorSrc, 'cycleVoice(): void {', 'get narrVoiceName');
  assert.ok(voiceBody.includes('this.narrator.retune'), 'voice retunes the live utterance');
  assert.ok(!voiceBody.includes('startNarratorFrom'), 'voice does not restart the paragraph');

  const resume = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const text = 'uno dos tres cuatro cinco';

  assert.strictEqual(resume.resumeSpeakText(text, 0), text);
  assert.strictEqual(resume.resumeSpeakText('', 4), '');
  const tres = text.indexOf('tres');
  assert.strictEqual(resume.resumeSpeakText(text, tres + 2), 'tres cuatro cinco');
  assert.strictEqual(
    resume.resumeSpeakText(text, text.indexOf('cuatro')),
    'cuatro cinco',
  );
  assert.strictEqual(resume.resumeSpeakText(text, 999), '');

  const cited = 'Dice: el Señor.';
  assert.strictEqual(
    resume.resumeSpeakText(cited, cited.indexOf(':')),
    'el Señor.',
  );
  assert.strictEqual(resume.wordStartAt(cited, cited.indexOf('Señor') + 1), cited.indexOf('Señor'));

  assert.strictEqual(resume.estimateSpeakCharIndex(text, 0, 1), 0);
  assert.strictEqual(resume.estimateSpeakCharIndex(text, -10, 1), 0);
  const mid = resume.estimateSpeakCharIndex(text, 1000, 1);
  assert.ok(mid > 0 && mid < text.length, `estimate stays inside the text (${mid})`);
  assert.strictEqual(resume.resumeSpeakText(text, mid).length < text.length, true);
  assert.ok(!resume.resumeSpeakText(text, mid).startsWith(' '), 'resume starts on a word');

  console.log('narrator resume logic ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
