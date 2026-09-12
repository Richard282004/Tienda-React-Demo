import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchText, levenshteinWithin } from "../lib/search.ts";

test("normalizeSearchText quita tildes y pasa a minúscula", () => {
  assert.equal(normalizeSearchText("Peluché Girasol"), "peluche girasol");
});

test("levenshteinWithin acepta un typo de una letra", () => {
  assert.equal(levenshteinWithin("llavero", "llavreo", 1), false); // transposición = distancia 2
  assert.equal(levenshteinWithin("llavero", "lavero", 1), true);
  assert.equal(levenshteinWithin("gatita", "gatito", 1), true);
});

test("levenshteinWithin rechaza palabras muy distintas", () => {
  assert.equal(levenshteinWithin("gatita", "peluche", 1), false);
});
