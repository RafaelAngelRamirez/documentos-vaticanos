/**
 * BCP-47 speech lang from pack locale.
 * Run: bash ../scripts/node-strip-types.sh src/app/services/speech-lang.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {
            // fall through
          }
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'speech-lang.logic.ts')).href
  );
  const { speechLangForDocumentLocale } = mod;

  assert.strictEqual(speechLangForDocumentLocale('en'), 'en-US');
  assert.strictEqual(speechLangForDocumentLocale('zh'), 'zh-CN');
  assert.strictEqual(speechLangForDocumentLocale('hi'), 'hi-IN');
  assert.strictEqual(speechLangForDocumentLocale('ar'), 'ar-SA');
  assert.strictEqual(speechLangForDocumentLocale('la'), 'la');
  assert.strictEqual(speechLangForDocumentLocale('es'), 'es-ES');
  assert.strictEqual(speechLangForDocumentLocale('EN'), 'en-US');
  assert.strictEqual(speechLangForDocumentLocale('Zh'), 'zh-CN');
  assert.strictEqual(speechLangForDocumentLocale(undefined), 'es-ES');
  assert.strictEqual(speechLangForDocumentLocale(null), 'es-ES');
  assert.strictEqual(speechLangForDocumentLocale(''), 'es-ES');
  assert.strictEqual(speechLangForDocumentLocale('pt'), 'es-ES');
  assert.strictEqual(speechLangForDocumentLocale('fr'), 'es-ES');

  const here = __dirname;
  const app = path.resolve(here, '..');
  const wired = [
    'components/lector/lector.component.ts',
    'components/historical-context-block/historical-context-block.component.ts',
    'pages/lectio/lectio.component.ts',
  ];
  for (const rel of wired) {
    const src = fs.readFileSync(path.join(app, rel), 'utf8');
    assert.ok(
      /speech-lang\.logic/.test(src),
      `${rel} imports speech-lang.logic`,
    );
    assert.ok(
      /speechLangForDocumentLocale/.test(src),
      `${rel} calls speechLangForDocumentLocale`,
    );
    assert.ok(
      !/lang:\s*['"]es-ES['"]/.test(src),
      `${rel} does not hardcode lang es-ES`,
    );
  }

  console.log('speech-lang.logic.test.js: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
