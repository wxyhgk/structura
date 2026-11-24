import assert from "node:assert/strict"
import test from "node:test"
import { isVariableName } from "../../src/markush/names.ts"

// A variable's label is anything shaped like one that is not an element or a known
// abbreviation (names.ts). So a new abbreviation, or a new isotope label, can quietly turn a
// variable in someone's saved formula into a group or an atom. These are the names patents
// write variables with that work today: one that stops working breaks old files.

const NUMBERED = ["R", "X", "L", "Q", "A", "G", "E", "M", "Ar"].flatMap((stem) => Array.from({ length: 20 }, (_, index) => `${stem}${index + 1}`))
const PLAIN = ["R", "R'", "R''", "R1'", "R2''", "Rc", "Rx", "Ry", "X", "L", "Q", "A", "G", "E", "J", "M", "Ar", "Ar'", "Y1", "Y2", "Z1", "Z2", "T1", "Hal", "Het", "Alk"]

test("the names patents give variables stay variables, not elements or abbreviations", () => {
  assert.deepEqual([...PLAIN, ...NUMBERED].filter((name) => !isVariableName(name)), [])
})

test("names that are an element, an isotope or an abbreviation are not variables (written as the atom or group)", () => {
  // Y is yttrium, Z benzyloxycarbonyl, Ra and Rb radium and rubidium, T and D tritium and deuterium, Cy cyclohexyl.
  assert.deepEqual(["Y", "Z", "Ra", "Rb", "T", "D", "Cy", "Me", "Ph", "Cl"].filter(isVariableName), [])
})
