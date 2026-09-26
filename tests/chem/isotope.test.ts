import assert from "node:assert/strict"
import test from "node:test"
import { buildScene } from "../../src/chem/draw.ts"
import { elementMass } from "../../src/chem/elements/index.ts"
import { molecularWeight, plainFormula } from "../../src/chem/formula.ts"
import { applyHotkey } from "../../src/chem/hotkeys.ts"
import { setAtomLabel } from "../../src/chem/label.ts"
import { addAtom, atomById, createBondAt, emptyMolecule, setElement, sprout } from "../../src/chem/molecule.ts"
import { toMolfile } from "../../src/chem/molfile.ts"
import type { Molecule } from "../../src/chem/types.ts"
import { validate } from "../../src/chem/validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

/** Methane with one hydrogen drawn out, so the label can be rewritten. */
function methaneWithH(): { mol: Molecule; carbon: number; hydrogen: number } {
  const carbon = addAtom(emptyMolecule(), "C", 0, 0)
  const mol = sprout(carbon.mol, carbon.id, SINGLE, "H")
  const hydrogen = mol.atoms[1].id
  return { mol, carbon: carbon.id, hydrogen }
}

test("D is hydrogen with mass number 2, written CH3D and weighed exactly", () => {
  const { mol, hydrogen } = methaneWithH()
  const deuterated = setAtomLabel(mol, hydrogen, "D")
  const atom = atomById(deuterated, hydrogen)
  assert.equal(atom?.el, "H")
  assert.equal(atom?.isotope, 2)
  assert.equal(atom?.alias, undefined)
  assert.equal(plainFormula(deuterated), "CH3D")
  const extra = molecularWeight(deuterated) - molecularWeight(mol)
  assert.ok(Math.abs(extra - (2.014102 - elementMass("H"))) < 1e-9)
})

test("the d hotkey makes deuterium instead of a label", () => {
  const { mol, hydrogen } = methaneWithH()
  const step = applyHotkey(mol, { type: "atom", id: hydrogen }, "d")
  assert.ok(step)
  assert.equal(atomById(step.mol, hydrogen)?.isotope, 2)
  assert.equal(plainFormula(step.mol), "CH3D")
})

test("a mass number in front of a symbol sets the isotope", () => {
  const { mol, carbon } = methaneWithH()
  const labelled = setAtomLabel(mol, carbon, "13C")
  assert.equal(atomById(labelled, carbon)?.isotope, 13)
  assert.equal(plainFormula(labelled), "CH4")
  assert.ok(Math.abs(molecularWeight(labelled) - molecularWeight(mol) - (13.003355 - elementMass("C"))) < 1e-9)
  assert.equal(atomById(setAtomLabel(mol, carbon, "15N"), carbon)?.el, "N")
  assert.equal(atomById(setAtomLabel(mol, carbon, "T"), carbon)?.isotope, 3)
  assert.equal(atomById(setAtomLabel(mol, carbon, "12Xx"), carbon)?.alias, "12Xx")
})

test("changing the element drops the mass number", () => {
  const { mol, carbon } = methaneWithH()
  const labelled = setAtomLabel(mol, carbon, "13C")
  assert.equal(atomById(setElement(labelled, [carbon], "N"), carbon)?.isotope, undefined)
})

test("labels show D as a letter and other isotopes as a leading mass number", () => {
  const { mol, carbon, hydrogen } = methaneWithH()
  const texts = (next: Molecule, id: number) =>
    buildScene(next, false).labels.find((label) => label.atomId === id)?.runs.map((run) => run.text)
  assert.deepEqual(texts(setAtomLabel(mol, hydrogen, "D"), hydrogen), ["D"])
  const heavy = texts(setAtomLabel(mol, carbon, "13C"), carbon)
  assert.ok(heavy?.includes("13") && heavy.includes("C"))

  const chain = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const middle = chain.atoms[0].id
  const shown = buildScene(setAtomLabel(chain, middle, "13C"), false).labels.find((label) => label.atomId === middle)
  assert.ok(shown, "an isotopic carbon is labelled even inside a chain")
})

test("isotopes are written as M  ISO lines", () => {
  const { mol, carbon, hydrogen } = methaneWithH()
  const labelled = setAtomLabel(setAtomLabel(mol, hydrogen, "D"), carbon, "13C")
  const lines = toMolfile(labelled).split("\n").filter((line) => line.startsWith("M  ISO"))
  assert.deepEqual(lines, ["M  ISO  2   1  13   2   2"])
})

test("a mass number must be a whole number from 1 to 999", () => {
  const { mol, carbon } = methaneWithH()
  const broken = { ...mol, atoms: mol.atoms.map((atom) => (atom.id === carbon ? { ...atom, isotope: 0 } : atom)) }
  assert.deepEqual(validate(broken).map((problem) => problem.code), ["bad-isotope"])
})
