/**
 * OLM citation converter.
 * Run: npx ts-node --transpile-only harvest_lectionary.test.ts
 */
import assert from 'assert';
import { convertCite } from './harvest_lectionary';

assert.strictEqual(convertCite('Matt 8:5-11'), 'Mt 8,5-11');
assert.strictEqual(convertCite('Luke 6:39-42'), 'Lc 6,39-42');
assert.strictEqual(convertCite('1 Cor 12:3b-7, 12-13'), '1Co 12,3b-7.12-13');
assert.strictEqual(convertCite('Isa 2:1-5'), 'Is 2,1-5');
assert.strictEqual(convertCite('Ps 122:1-2, 3-4a'), 'Sal 122,1-2.3-4a');
assert.strictEqual(convertCite('John 20:1-9'), 'Jn 20,1-9');
assert.strictEqual(convertCite('Acts 2:1-11'), 'Hch 2,1-11');
assert.ok(convertCite('A: Matt 26:14 – 27:66').startsWith('Mt 26,14'));
console.log('ok harvest_lectionary convertCite');
