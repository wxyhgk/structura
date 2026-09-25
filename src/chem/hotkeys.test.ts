import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "./formula.ts"
import { dist } from "./geometry.ts"
import { applyHotkey, setAtomLabel } from "./hotkeys.ts"
import { addAtom, atomById, bondOrderSum, createBondAt, emptyMolecule, neighbors } from "./molecule.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function ethane() {
  const mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const end = mol.atoms[1]
  assert.ok(end)
  return { mol, end: end.id, bond: mol.bonds[0].id }
}

test("1 extends the chain and parks on the new atom", () => {
  const start = ethane()
  let mol = start.mol
  let id = start.end
  for (const formula of ["C3H8", "C4H10", "C5H12"]) {
    const step = applyHotkey(mol, { type: "atom", id }, "1")
    assert.ok(step)
    mol = step.mol
    id = step.next.type === "atom" ? step.next.id : id
    assert.equal(plainFormula(mol), formula)
    assert.equal(bondOrderSum(mol, id), 1)
  }
})

test("0 grows straight up", () => {
  const start = ethane()
  const step = applyHotkey(start.mol, { type: "atom", id: start.end }, "0")
  assert.ok(step && step.next.type === "atom")
  const born = atomById(step.mol, step.next.id)
  const from = atomById(step.mol, start.end)
  assert.ok(born && from)
  assert.ok(born.y < from.y - 20)
  assert.ok(Math.abs(born.x - from.x) < 1)
})

test("2 on a primary carbon adds a carbonyl and a methyl", () => {
  const start = ethane()
  const step = applyHotkey(start.mol, { type: "atom", id: start.end }, "2")
  assert.ok(step && step.next.type === "atom")
  assert.equal(plainFormula(step.mol), "C3H6O")
  assert.equal(step.next.id === start.end, false)
  const methyl = atomById(step.mol, step.next.id)
  assert.equal(methyl?.el, "C")
  const amide = applyHotkey(step.mol, step.next, "n")
  assert.ok(amide)
  assert.equal(plainFormula(amide.mol), "C2H5NO")
})

test("2 on a chain atom with two bonds only adds the oxygen", () => {
  const start = ethane()
  const grown = applyHotkey(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const step = applyHotkey(grown.mol, { type: "atom", id: start.end }, "2")
  assert.ok(step && step.next.type === "atom")
  assert.equal(step.next.id, start.end)
  assert.equal(plainFormula(step.mol), "C3H6O")
  assert.equal(step.mol.atoms.length, 4)
})

test("3 makes the singly bonded atom a benzene carbon, with the hotspot at para", () => {
  const start = ethane()
  const phenyl = applyHotkey(start.mol, { type: "atom", id: start.end }, "3")
  assert.ok(phenyl && phenyl.next.type === "atom")
  assert.equal(phenyl.mol.atoms.length, 7)
  assert.equal(plainFormula(phenyl.mol), "C7H8")
  assert.equal(neighbors(phenyl.mol, start.end).length, 3)
  const ipso = atomById(phenyl.mol, start.end)
  const para = atomById(phenyl.mol, phenyl.next.id)
  const methyl = atomById(phenyl.mol, start.mol.atoms[0].id)
  assert.ok(ipso && para && methyl)
  assert.ok(Math.abs(dist(ipso, para) - 80) < 1)
  assert.ok(dist(methyl, para) > dist(methyl, ipso))
  assert.ok(para)
  assert.equal(neighbors(phenyl.mol, para.id).length, 2)
  const acyl = applyHotkey(phenyl.mol, phenyl.next, "2")
  assert.ok(acyl && acyl.next.type === "atom")
  assert.equal(plainFormula(acyl.mol), "C9H10O")
  const extended = applyHotkey(acyl.mol, acyl.next, "1")
  assert.ok(extended)
  assert.equal(plainFormula(extended.mol), "C10H12O")
})

test("bond keys change order, style, or fuse", () => {
  const start = ethane()
  const doubled = applyHotkey(start.mol, { type: "bond", id: start.bond }, "2")
  assert.ok(doubled)
  assert.equal(doubled.mol.bonds[0]?.order, 2)
  assert.equal(doubled.mol.atoms.length, 2)
  const tripled = applyHotkey(start.mol, { type: "bond", id: start.bond }, "3")
  assert.equal(tripled?.mol.bonds[0]?.order, 3)
  const phenyl = applyHotkey(start.mol, { type: "bond", id: start.bond }, "a")
  assert.equal(phenyl?.mol.atoms.length, 6)
  const pentene = applyHotkey(start.mol, { type: "bond", id: start.bond }, "z")
  assert.equal(pentene?.mol.atoms.length, 5)
  assert.equal(pentene?.mol.bonds.filter((bond) => bond.order === 2).length, 1)
  const bold = applyHotkey(start.mol, { type: "bond", id: start.bond }, "b")
  assert.equal(bold?.mol.bonds[0]?.stereo, "bold")
  const dashedDouble = applyHotkey(doubled.mol, { type: "bond", id: start.bond }, "D")
  assert.equal(dashedDouble?.mol.bonds[0]?.order, 2)
  assert.equal(dashedDouble?.mol.bonds[0]?.emphasis, "dashed")
})

test("a on a bond fuses benzene", () => {
  const start = ethane()
  const fused = applyHotkey(start.mol, { type: "bond", id: start.bond }, "a")
  assert.ok(fused && fused.next.type === "atom")
  assert.equal(fused.mol.atoms.length, 6)
  assert.equal(plainFormula(fused.mol), "C6H6")
})

test("letter case changes the group", () => {
  const start = ethane()
  const alcohol = applyHotkey(start.mol, { type: "atom", id: start.end }, "o")
  assert.ok(alcohol)
  assert.equal(plainFormula(alcohol.mol), "CH4O")
  const methoxy = applyHotkey(start.mol, { type: "atom", id: start.end }, "O")
  assert.ok(methoxy)
  assert.equal(plainFormula(methoxy.mol), "C3H8O")
  const phenyl = applyHotkey(start.mol, { type: "atom", id: start.end }, "P")
  assert.ok(phenyl)
  assert.equal(phenyl.mol.atoms.length, 2)
  assert.equal(atomById(phenyl.mol, start.end)?.alias, "Ph")
  assert.equal(plainFormula(phenyl.mol), "C7H8")
})

test("K is tert-butyl on a primary carbon and a stereo pair midway", () => {
  const start = ethane()
  const butyl = applyHotkey(start.mol, { type: "atom", id: start.end }, "K")
  assert.ok(butyl)
  assert.equal(plainFormula(butyl.mol), "C6H14")
  const grown = applyHotkey(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const pair = applyHotkey(grown.mol, { type: "atom", id: start.end }, "K")
  assert.ok(pair)
  assert.equal(pair.mol.atoms.length, 5)
  const stereos = pair.mol.bonds.map((bond) => bond.stereo).sort()
  assert.deepEqual(stereos.filter((stereo) => stereo === "up" || stereo === "down"), ["down", "up"])
})

test("9 forks two substituents and 6 on a substituted atom is spiro", () => {
  const start = ethane()
  const fork = applyHotkey(start.mol, { type: "atom", id: start.end }, "9")
  assert.ok(fork)
  assert.equal(plainFormula(fork.mol), "C4H10")
  const grown = applyHotkey(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const spiro = applyHotkey(grown.mol, { type: "atom", id: start.end }, "6")
  assert.ok(spiro)
  assert.equal(neighbors(spiro.mol, start.end).length, 4)
})

test("j and J chairs mirror across the chain", () => {
  const placed = addAtom(emptyMolecule(), "C", 0, 0)
  const up = applyHotkey(placed.mol, { type: "atom", id: placed.id }, "j")
  const down = applyHotkey(placed.mol, { type: "atom", id: placed.id }, "J")
  assert.ok(up && down && up.next.type === "atom" && down.next.type === "atom")
  assert.equal(plainFormula(up.mol), "C7H14")
  const upFar = atomById(up.mol, up.next.id)
  const downFar = atomById(down.mol, down.next.id)
  assert.ok(upFar && downFar)
  assert.ok(Math.abs(upFar.y - downFar.y) < 1)
  const upSide = up.mol.atoms.find((atom) => atom.y < -10)
  const downSide = down.mol.atoms.find((atom) => atom.y > 10)
  assert.ok(upSide && downSide)
})

test("Enter label accepts an element or a nickname", () => {
  const start = ethane()
  const chlorine = setAtomLabel(start.mol, start.end, "Cl")
  assert.equal(atomById(chlorine, start.end)?.el, "Cl")
  assert.equal(atomById(chlorine, start.end)?.alias, undefined)
  const methyl = setAtomLabel(start.mol, start.end, "Me")
  assert.equal(atomById(methyl, start.end)?.alias, "Me")
  assert.equal(plainFormula(methyl), "C2H6")
})
