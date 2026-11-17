/**
 * Recorte del número ya mostrado. No reescribe el corpus.
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/text/strip-shown-number.logic.test.js
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
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const HERE = __dirname;
const LOGIC = path.join(HERE, 'strip-shown-number.logic.ts');
const PUNTO = path.resolve(HERE, '../../components/punto/punto/punto.component.ts');
const BIBLE = path.resolve(
  HERE,
  '../../../../../documentos/corpus/documents/bible-pueblo-de-dios-es/content.json',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC), 'strip-shown-number.logic.ts exists');
  const punto = fs.readFileSync(PUNTO, 'utf8');
  assert.ok(punto.includes('displayBody'), 'punto pinta displayBody');
  assert.ok(
    !punto.includes('contenido.replace(valor'),
    'punto ya no borra el número en mitad del texto',
  );

  const mod = await import(pathToFileURL(LOGIC).href);
  const { displayBody, shownParagraphNumber, stripExactShownNumber } = mod;

  section('Sal 15, 2');
  const sal15 = {
    consecutivo: '15400',
    contenido: '2 El que procede rectamente y practica la justicia;',
    biblia: {
      consecutivo_versiculo: 'Sal 15, 2',
      versiculo: 2,
      capitulo: '15',
      libro: 'salmos',
    },
  };
  assert.strictEqual(shownParagraphNumber(sal15), '2');
  assert.strictEqual(
    displayBody(sal15),
    'El que procede rectamente y practica la justicia;',
  );
  assert.strictEqual(
    displayBody({ ...sal15, contenido: displayBody(sal15) }),
    displayBody(sal15),
    'idempotente',
  );

  section('solo el número que coincide');
  assert.strictEqual(
    stripExactShownNumber('20 El que camina', '2'),
    '20 El que camina',
  );
  assert.strictEqual(
    stripExactShownNumber('5a El Faraón dijo a José:', '5'),
    '5a El Faraón dijo a José:',
  );
  assert.strictEqual(
    stripExactShownNumber('12a El texto', '12'),
    '12a El texto',
  );
  assert.strictEqual(stripExactShownNumber('12a El texto', '12a'), 'El texto');
  assert.strictEqual(
    stripExactShownNumber('El canon 2 dice la norma', '2'),
    'El canon 2 dice la norma',
  );
  assert.strictEqual(
    stripExactShownNumber('12,000 hombres', '12'),
    '12,000 hombres',
  );
  assert.strictEqual(
    stripExactShownNumber('1. En primer lugar', '2'),
    '1. En primer lugar',
  );

  section('separador de etiqueta');
  assert.strictEqual(stripExactShownNumber('2. El que', '2'), 'El que');
  assert.strictEqual(stripExactShownNumber('12, por eso', '12'), 'por eso');
  assert.strictEqual(
    stripExactShownNumber('15... hasta que', '15'),
    '... hasta que',
  );
  assert.strictEqual(
    stripExactShownNumber('1\u00a0 Había en el país', '1'),
    'Había en el país',
  );
  assert.strictEqual(stripExactShownNumber('1. Esta página', '1'), 'Esta página');

  section('cita bíblica que empieza por el mismo número');
  assert.strictEqual(
    stripExactShownNumber('1. 1 Tm 3.15.', '1'),
    '1 Tm 3.15.',
  );
  assert.strictEqual(
    stripExactShownNumber('1 Tm 3.15.', '1'),
    '1 Tm 3.15.',
  );
  assert.strictEqual(
    displayBody({ consecutivo: '1', contenido: '1. 1 Tm 3.15.' }),
    '1 Tm 3.15.',
  );
  assert.strictEqual(
    displayBody({
      consecutivo: '1',
      contenido: displayBody({ consecutivo: '1', contenido: '1. 1 Tm 3.15.' }),
    }),
    '1 Tm 3.15.',
    'idempotente con 1 Tm',
  );
  assert.strictEqual(
    displayBody({
      consecutivo: '8586',
      contenido: '1 Cro 11.10-41',
      biblia: { consecutivo_versiculo: '2 S 23, 1', versiculo: 1 },
    }),
    '1 Cro 11.10-41',
  );

  section('título estructural');
  const heading = {
    consecutivo: '1',
    contenido: '1. Introducción',
  };
  assert.strictEqual(displayBody(heading), '1. Introducción');

  section('sin etiqueta de versículo');
  assert.strictEqual(shownParagraphNumber({ consecutivo: '15400', contenido: '2 He who' }), '15400');
  assert.strictEqual(
    displayBody({ consecutivo: '15400', contenido: '2 He who acts rightly' }),
    '2 He who acts rightly',
  );
  assert.strictEqual(
    displayBody({ consecutivo: '2', contenido: '2 The earth was formless' }),
    'The earth was formless',
  );

  section('corpus Sal 15');
  assert.ok(fs.existsSync(BIBLE), 'bible-pueblo-de-dios-es content.json');
  const units = JSON.parse(fs.readFileSync(BIBLE, 'utf8'));
  const verse = units[15400];
  assert.strictEqual(verse.biblia.consecutivo_versiculo, 'Sal 15, 2');
  assert.ok(verse.contenido.startsWith('2 '), 'el corpus conserva el 2');
  const shown = displayBody(verse);
  assert.ok(shown.startsWith('El que procede'), shown);
  assert.ok(!shown.startsWith('2 '), 'el cuerpo pintado no repite el 2');
  assert.strictEqual(displayBody({ ...verse, contenido: shown }), shown);
  assert.strictEqual(verse.contenido.startsWith('2 '), true, 'el fichero no se muta');

  console.log('\nstrip-shown-number ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
