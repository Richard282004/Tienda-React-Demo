import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmailList } from '../lib/email-list.ts';

test('separa por coma, espacio, salto de línea y punto y coma', () => {
  assert.deepEqual(
    parseEmailList('a@x.cl, b@y.cl\nc@z.cl;d@w.cl e@q.cl'),
    ['a@x.cl', 'b@y.cl', 'c@z.cl', 'd@w.cl', 'e@q.cl'],
  );
});

test('descarta entradas que no son correos', () => {
  assert.deepEqual(parseEmailList('hola, a@x.cl, sin-arroba, b@y'), ['a@x.cl']);
});

test('vacío o nulo devuelve lista vacía', () => {
  assert.deepEqual(parseEmailList(''), []);
  assert.deepEqual(parseEmailList(null), []);
  assert.deepEqual(parseEmailList(undefined), []);
});

test('recorta espacios alrededor de cada correo', () => {
  assert.deepEqual(parseEmailList('  a@x.cl  ,  b@y.cl  '), ['a@x.cl', 'b@y.cl']);
});
