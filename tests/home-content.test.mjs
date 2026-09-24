import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeBlocks, resolveHomeBlocks, resolveHomeCategories, orderFeaturedFirst, safeExternalUrl, describeTarget } from '../lib/home-content.ts';

const products = [
  { id: 'a', name: 'Conejo', type: 'Llaveros', active: true, image_url: 'https://cdn.test/a.jpg', image_position_x: 30, image_position_y: 70, image_zoom: 1.2 },
  { id: 'b', name: 'Oso', type: 'Peluches', active: true, image_url: null },
  { id: 'c', name: 'Oculto', type: 'Llaveros', active: false, image_url: 'https://cdn.test/c.jpg' },
];

test('sin configuración usa las dos primeras categorías reales', () => {
  const blocks = getHomeBlocks(undefined, ['Llaveros', 'Flores', 'Peluches']);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((block) => block.target.value), ['Llaveros', 'Flores']);
  assert.equal(blocks[1].ctaLabel, 'Ver flores');
});

test('bloque sin foto propia usa la foto real de un producto de la categoría', () => {
  const [block] = resolveHomeBlocks(getHomeBlocks(undefined, ['Llaveros']), ['Llaveros'], products);
  assert.equal(block.image, 'https://cdn.test/a.jpg');
  assert.deepEqual(block.framing, { x: 30, y: 70, zoom: 1.2 });
  assert.equal(block.href, '/?categoria=Llaveros#tienda');
});

test('sin fotos disponibles el bloque queda sin imagen, nunca con una rota', () => {
  const [, block] = resolveHomeBlocks(getHomeBlocks(undefined, ['Llaveros', 'Peluches']), ['Llaveros', 'Peluches'], products);
  assert.equal(block.image, '');
  assert.equal(block.mobileImage, '');
  const [unsafe] = resolveHomeBlocks([{ ...getHomeBlocks(undefined, ['Peluches'])[0], imageUrl: 'javascript:alert(1)' }], ['Peluches'], products);
  assert.equal(unsafe.image, '');
});

test('destinos que ya no existen llevan al catálogo completo', () => {
  const base = getHomeBlocks(undefined, ['Llaveros'])[0];
  const [gone] = resolveHomeBlocks([{ ...base, target: { kind: 'category', value: 'Borrada' } }], ['Llaveros'], products);
  assert.equal(gone.href, '/#tienda');
  assert.equal(gone.targetMissing, true);
  const [hidden] = resolveHomeBlocks([{ ...base, target: { kind: 'product', value: 'c' } }], ['Llaveros'], products);
  assert.equal(hidden.href, '/#tienda');
  assert.equal(describeTarget({ kind: 'product', value: 'c' }, [], products).missing, true);
  const [product] = resolveHomeBlocks([{ ...base, target: { kind: 'product', value: 'a' } }], ['Llaveros'], products);
  assert.equal(product.href, '/producto/a');
  assert.equal(product.category, null);
});

test('bloques ocultos no se muestran y la foto de celular es independiente', () => {
  const [first, second] = getHomeBlocks(undefined, ['Llaveros', 'Peluches']);
  const resolved = resolveHomeBlocks([{ ...first, enabled: false }, { ...second, imageUrl: 'https://cdn.test/d.jpg', mobileImageUrl: 'https://cdn.test/m.jpg', mobileImageX: 10 }], ['Llaveros', 'Peluches'], products);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].image, 'https://cdn.test/d.jpg');
  assert.equal(resolved[0].mobileImage, 'https://cdn.test/m.jpg');
  assert.equal(resolved[0].mobileFraming.x, 10);
});

test('categorías visibles respetan orden y descartan las borradas', () => {
  assert.deepEqual(resolveHomeCategories(undefined, ['A', 'B']), ['A', 'B']);
  assert.deepEqual(resolveHomeCategories(['B', 'X', 'A', 'B'], ['A', 'B']), ['B', 'A']);
  assert.deepEqual(resolveHomeCategories([], ['A']), []);
});

test('destacados primero en su orden, el resto sin cambios', () => {
  const list = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
  assert.deepEqual(orderFeaturedFirst(list, ['3', 'missing', '1']).map((item) => item.id), ['3', '1', '2', '4']);
  assert.equal(orderFeaturedFirst(list, undefined), list);
});

test('el enlace del crédito solo acepta http(s)', () => {
  assert.equal(safeExternalUrl('https://portafolio.richardlagos2.workers.dev/'), 'https://portafolio.richardlagos2.workers.dev/');
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('portafolio.dev'), null);
  assert.equal(safeExternalUrl(''), null);
});
