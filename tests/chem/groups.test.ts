import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "../../src/chem/constants.ts"
import { dist } from "../../src/chem/geometry.ts"
import { plainFormula } from "../../src/chem/formula.ts"
import { setAtomLabel } from "../../src/chem/label.ts"
import {
  atomById,
  createBondAt,
  deleteSelection,
  emptyMolecule,
  groupOf,
  insertGroup,
  moveAtoms,
  rotateAtoms,
  setElement,
  sprout,
} from "../../src/chem/molecule.ts"
import { allTemplates, keptAsLabel, templateFor } from "../../src/chem/templates.ts"
import type { Molecule } from "../../src/chem/types.ts"
import { validate } from "../../src/chem/validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function ethane(): { mol: Molecule; end: number } {
  const mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  return { mol, end: mol.atoms[1].id }
}

function counts(formula: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const [, el, n] of formula.replace(/[+-]\d*$/, "").matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    map.set(el, (map.get(el) ?? 0) + (n ? Number(n) : 1))
  }
  return map
}

const BRIDGED = new Set(["9-BBN"])

test("every abbreviation lands with RDKit's formula, sane bonds and no valence problem", () => {
  const wrong: string[] = []
  for (const template of allTemplates().filter((item) => item.attachments === 1)) {
    const { mol, end } = ethane()
    const placed = insertGroup(mol, end, template)
    if (!placed) {
      wrong.push(`${template.label}: not placed`)
      continue
    }
    const expected = counts(template.formula)
    expected.set("C", (expected.get("C") ?? 0) + 1)
    expected.set("H", (expected.get("H") ?? 0) + 3)
    // A bridged bicycle cannot be drawn flat with equal bonds; its bridge comes out short.
    const shortest = BRIDGED.has(template.label) ? 0.45 : 0.6
    const got = counts(plainFormula(placed.mol))
    const same = [...new Set([...expected.keys(), ...got.keys()])].every((el) => (expected.get(el) ?? 0) === (got.get(el) ?? 0))
    if (!same) wrong.push(`${template.label}: ${plainFormula(placed.mol)}, expected CH3 + ${template.formula}`)
    const problems = validate(placed.mol)
    if (problems.length > 0) wrong.push(`${template.label}: ${problems.map((problem) => problem.message).join("; ")}`)
    for (const bond of placed.mol.bonds) {
      const a = atomById(placed.mol, bond.a)
      const b = atomById(placed.mol, bond.b)
      if (!a || !b) continue
      const length = dist(a, b)
      if (length < BOND_LENGTH * shortest || length > BOND_LENGTH * 1.6) {
        wrong.push(`${template.label}: bond ${a.el}–${b.el} is ${length.toFixed(1)} px`)
      }
    }
  }
  assert.deepEqual(wrong, [])
})

test("the attachment bond keeps its length and direction", () => {
  const { mol, end } = ethane()
  const before = atomById(mol, end)
  const placed = insertGroup(mol, end, templateFor("Ph")!)
  assert.ok(placed && before)
  const anchor = atomById(placed.mol, placed.id)
  assert.equal(anchor?.x, before.x)
  assert.equal(anchor?.y, before.y)
  const ring = placed.mol.atoms.filter((atom) => atom.id !== mol.atoms[0].id && atom.id !== end)
  const start = mol.atoms[0]
  for (const atom of ring) assert.ok(dist(atom, start) > dist(before, start), "the ring grows away from the chain")
})

test("a group on a chain atom hangs off a new bond", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  mol = sprout(mol, mol.atoms[1].id, SINGLE)
  const middle = mol.atoms[1].id
  const placed = insertGroup(mol, middle, templateFor("tBu")!)
  assert.ok(placed)
  assert.notEqual(placed.id, middle)
  assert.equal(plainFormula(placed.mol), "C7H16")
  assert.equal(groupOf(placed.mol, middle), undefined)
})

test("a divalent group replaces a chain atom that has exactly two bonds", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  mol = sprout(mol, mol.atoms[1].id, SINGLE)
  const middle = mol.atoms[1].id
  const sulfonyl = insertGroup(mol, middle, templateFor("SO2")!)
  assert.ok(sulfonyl)
  assert.equal(sulfonyl.id, middle)
  assert.equal(plainFormula(sulfonyl.mol), "C2H6O2S")
  assert.equal(insertGroup(mol, mol.atoms[0].id, templateFor("SO2")!), null)
})

test("typing a label makes the group; Ac, Ts and Pr mean groups, other symbols stay elements", () => {
  const { mol, end } = ethane()
  const acetyl = setAtomLabel(mol, end, "Ac")
  assert.deepEqual(acetyl.groups.map((group) => group.label), ["Ac"])
  assert.equal(plainFormula(acetyl), "C3H6O")
  assert.equal(setAtomLabel(mol, end, "Co").groups.length, 0)
  assert.equal(atomById(setAtomLabel(mol, end, "Co"), end)?.el, "Co")
  const ester = setAtomLabel(mol, end, "CO2Me")
  assert.equal(plainFormula(ester), "C3H6O2")
  assert.equal(ester.groups.length, 0, "a rarer abbreviation is drawn out as plain atoms")
  assert.equal(setAtomLabel(mol, end, "t-Bu").groups[0]?.label, "t-Bu")
  assert.equal(plainFormula(setAtomLabel(mol, end, "t-Bu")), "C5H12")
  assert.equal(atomById(setAtomLabel(mol, end, "Xyz"), end)?.alias, "Xyz")
})

test("retyping a group's label swaps the whole group", () => {
  const { mol, end } = ethane()
  const phenyl = setAtomLabel(mol, end, "Ph")
  const boc = setAtomLabel(phenyl, end, "Boc")
  assert.equal(plainFormula(boc), "C6H12O2")
  assert.deepEqual(boc.groups.map((group) => group.label), ["Boc"])
  assert.deepEqual(validate(boc), [])
})

test("editing a member turns the group back into plain atoms; moving keeps it", () => {
  const { mol, end } = ethane()
  const phenyl = setAtomLabel(mol, end, "Ph")
  const group = phenyl.groups[0]
  const member = group.atoms[3]

  assert.equal(setElement(phenyl, [member], "N").groups.length, 0)
  const trimmed = deleteSelection(phenyl, { atoms: [member], bonds: [] })
  assert.equal(trimmed.groups.length, 0)
  assert.equal(trimmed.atoms.length, phenyl.atoms.length - 1)
  assert.equal(sprout(phenyl, member, SINGLE).groups.length, 0)

  const ids = phenyl.atoms.map((atom) => atom.id)
  assert.equal(moveAtoms(phenyl, ids, 10, 5).groups.length, 1)
  assert.equal(rotateAtoms(phenyl, ids, { x: 0, y: 0 }, 1).groups.length, 1)
})

test("only the common abbreviations stay as labels", () => {
  const kept = allTemplates().filter(keptAsLabel).map((template) => template.label)
  assert.deepEqual(kept.sort(), ["Ac", "Bn", "Boc", "Bz", "Cbz", "Et", "Fmoc", "Me", "Ph", "TBS", "TMS", "Ts", "iPr", "tBu"].sort())
  const { mol, end } = ethane()
  assert.equal(setAtomLabel(mol, end, "CH3").groups[0]?.label, "CH3")
  assert.equal(setAtomLabel(mol, end, "NO2").groups.length, 0)
  assert.equal(setAtomLabel(mol, end, "TIPS").groups.length, 0)
})
