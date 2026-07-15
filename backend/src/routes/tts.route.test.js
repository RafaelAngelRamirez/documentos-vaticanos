/**
 * Tests del router Express TTS (shipped createTtsRouter).
 * Stubs solo del cliente upstream; ejercita el path real del router.
 *
 * Run: node --experimental-strip-types src/routes/tts.route.test.js
 */
const assert = require('assert');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = 'development';

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}

async function main() {
  const express = require('express');
  // tsx may surface CJS-style named exports under .default
  const ttsMod = await import('./tts.ts');
  const ns = ttsMod.createTtsRouter ? ttsMod : ttsMod.default || ttsMod;
  const createTtsRouter = ns.createTtsRouter;
  const ttsRouter = ns.ttsRouter;
  assert.ok(typeof createTtsRouter === 'function', 'createTtsRouter exported');
  assert.ok(ttsRouter, 'ttsRouter exported');

  section('unconfigured: GET /tts/voices → available false');
  {
    const app = express();
    app.use(express.json());
    app.use(createTtsRouter({ isConfigured: () => false }));
    const s = await listen(app);
    const r = await fetch(`${s.base}/tts/voices`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.available, false);
    assert.deepStrictEqual(j.voices, []);
    assert.ok(j.reason);
    await s.close();
  }

  section('unconfigured: POST /tts/speak → 503 (process stays up)');
  {
    const app = express();
    app.use(express.json());
    app.use(createTtsRouter({ isConfigured: () => false }));
    const s = await listen(app);
    const r = await fetch(`${s.base}/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'En el principio creó Dios el cielo y la tierra.',
        voice_id: 'eve',
        language: 'es-ES',
      }),
    });
    assert.strictEqual(r.status, 503);
    const j = await r.json();
    assert.strictEqual(j.code, 'tts_unavailable');
    // second call still works — process not crashed
    const r2 = await fetch(`${s.base}/tts/voices`);
    assert.strictEqual(r2.status, 200);
    await s.close();
  }

  section('configured + stub client: list voices');
  {
    const app = express();
    app.use(express.json());
    app.use(
      createTtsRouter({
        isConfigured: () => true,
        getClient: () => ({
          listVoices: async () => [
            { voice_id: 'eve', name: 'Eve' },
            { voice_id: 'ara', name: 'Ara' },
          ],
          synthesize: async () => {
            throw new Error('not used');
          },
        }),
      }),
    );
    const s = await listen(app);
    const r = await fetch(`${s.base}/tts/voices`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.available, true);
    assert.strictEqual(j.voices.length, 2);
    assert.strictEqual(j.voices[0].voice_id, 'eve');
    await s.close();
  }

  section('configured + stub client: speak returns audio/*');
  {
    const audio = Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x01, 0x02, 0x03]);
    let lastInput = null;
    const app = express();
    app.use(express.json());
    app.use(
      createTtsRouter({
        isConfigured: () => true,
        getClient: () => ({
          listVoices: async () => [],
          synthesize: async (input) => {
            lastInput = input;
            return {
              body: audio.buffer.slice(
                audio.byteOffset,
                audio.byteOffset + audio.byteLength,
              ),
              contentType: 'audio/mpeg',
            };
          },
        }),
      }),
    );
    const s = await listen(app);
    const r = await fetch(`${s.base}/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Dios es amor.',
        voice_id: 'luna',
        language: 'es-MX',
        speed: 1.0,
      }),
    });
    assert.strictEqual(r.status, 200, await r.clone().text());
    const ct = r.headers.get('content-type') || '';
    assert.ok(ct.includes('audio'), `content-type audio got ${ct}`);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.ok(buf.length > 0, 'non-empty audio body');
    assert.strictEqual(lastInput.text, 'Dios es amor.');
    assert.strictEqual(lastInput.voiceId, 'luna');
    assert.strictEqual(lastInput.language, 'es-MX');
    await s.close();
  }

  section('configured: empty text → 400');
  {
    const app = express();
    app.use(express.json());
    app.use(
      createTtsRouter({
        isConfigured: () => true,
        getClient: () => ({
          listVoices: async () => [],
          synthesize: async () => {
            throw new Error('should not call');
          },
        }),
      }),
    );
    const s = await listen(app);
    const r = await fetch(`${s.base}/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '  ' }),
    });
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.strictEqual(j.code, 'invalid_text');
    await s.close();
  }

  console.log('\nAll tts.route tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
