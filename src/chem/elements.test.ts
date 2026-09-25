import assert from "node:assert/strict"
import test from "node:test"
import { ELEMENTS, elementAt, elementMass, paletteElements, shortcutToElement } from "./elements/index.ts"

test("the table contains each element once", () => {
  assert.equal(ELEMENTS.length, 118)
  assert.equal(new Set(ELEMENTS.map((element) => element.z)).size, 118)
  assert.equal(new Set(ELEMENTS.map((element) => element.symbol)).size, 118)
  assert.equal(new Set(ELEMENTS.map((element) => `${element.col}:${element.row}`)).size, 118)
  for (const element of ELEMENTS) {
    assert.ok(element.mass > 0)
    assert.equal(elementAt(element.col, element.row)?.symbol, element.symbol)
  }
})

test("period lengths match the standard table", () => {
  const count = (row: number) => ELEMENTS.filter((element) => element.row === row).length
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 9, 10].map(count), [2, 8, 8, 18, 18, 17, 17, 15, 15])
})

test("masses used by the sketcher stay on the previous scale", () => {
  assert.equal(elementMass("H"), 1.00784)
  assert.equal(elementMass("C"), 12.011)
  assert.equal(elementMass("N"), 14.007)
  assert.equal(elementMass("O"), 15.999)
  assert.equal(elementMass("F"), 18.9984)
  assert.equal(elementMass("P"), 30.9738)
  assert.equal(elementMass("S"), 32.06)
  assert.equal(elementMass("Cl"), 35.45)
  assert.equal(elementMass("Br"), 79.904)
  assert.equal(elementMass("I"), 126.9045)
  assert.equal(elementMass("B"), 10.81)
})

test("the palette and shortcuts are projections of the same table", () => {
  assert.deepEqual(
    paletteElements().map((element) => element.symbol),
    ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I", "H", "B"],
  )
  assert.equal(shortcutToElement("l"), "Cl")
  assert.equal(shortcutToElement("b"), undefined)
  assert.equal(shortcutToElement("c"), "C")
})
