import test from "node:test";
import assert from "node:assert/strict";
import { parseCheckoutPayload, calculateShipping } from "../lib/checkout-validation.ts";
const valid = () => ({
  items: [{ productId: "toy", quantity: 1 }],
  customerName: " Cliente ",
  customerEmail: "cliente@example.com",
  customerPhone: "+56911111111",
  customerRut: "11.111.111-1",
  region: "Metropolitana de Santiago",
  comuna: "Santiago",
  address: "Calle de prueba 123",
});
test("normaliza datos y agrupa productos repetidos", () => {
  const parsed = parseCheckoutPayload({
    ...valid(),
    items: [
      { productId: "toy", quantity: 2 },
      { productId: "toy", quantity: 3 },
    ],
  });
  assert.equal(parsed.customerName, "Cliente");
  assert.deepEqual(parsed.items, [{ productId: "toy", quantity: 5 }]);
});
test("agrupa por producto+variante, no solo por producto", () => {
  const parsed = parseCheckoutPayload({
    ...valid(),
    items: [
      { productId: "toy", variantId: "rosa", quantity: 2 },
      { productId: "toy", variantId: "rosa", quantity: 1 },
      { productId: "toy", variantId: "azul", quantity: 1 },
      { productId: "toy", quantity: 1 },
    ],
  });
  assert.deepEqual(parsed.items, [
    { productId: "toy", variantId: "rosa", quantity: 3 },
    { productId: "toy", variantId: "azul", quantity: 1 },
    { productId: "toy", quantity: 1 },
  ]);
});
test("rechaza cantidades negativas, decimales, nulas y desbordadas", () => {
  for (const quantity of [-1, 0, 1.5, "2", null, 100])
    assert.throws(() =>
      parseCheckoutPayload({ ...valid(), items: [{ productId: "toy", quantity }] }),
    );
  assert.throws(() =>
    parseCheckoutPayload({
      ...valid(),
      items: [
        { productId: "toy", quantity: 60 },
        { productId: "toy", quantity: 60 },
      ],
    }),
  );
});
test("rechaza cuerpos malformados, carrito vacío y datos incompletos", () => {
  for (const value of [
    null,
    [],
    {},
    { ...valid(), items: [] },
    { ...valid(), customerEmail: "incorrecto" },
    { ...valid(), customerName: "   " },
    { ...valid(), customerRut: "11.111.111-2" },
    { ...valid(), customerRut: "" },
  ])
    assert.throws(() => parseCheckoutPayload(value));
});
test("normaliza el RUT sin puntos y con guion", () => {
  assert.equal(parseCheckoutPayload({ ...valid(), customerRut: "11111111-1" }).customerRut, "11111111-1");
  assert.equal(parseCheckoutPayload({ ...valid(), customerRut: "11.111.111-1" }).customerRut, "11111111-1");
});
test("no considera gratis una tarifa ausente o inválida", () => {
  for (const rate of [undefined, -10, NaN, 1.5])
    assert.equal(calculateShipping(60_000, rate), null);
});
test("aplica el umbral anunciado y respeta tarifas de cero", () => {
  assert.equal(calculateShipping(44_999, 2990), 2990);
  assert.equal(calculateShipping(45_000, 2990), 2990);
  assert.equal(calculateShipping(45_001, 2990), 0);
  assert.equal(calculateShipping(10_000, 0), 0);
});
