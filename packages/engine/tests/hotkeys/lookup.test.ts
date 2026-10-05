import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { plainFormula } from "@structura/core/formula"
import { dist } from "@structura/core/geometry"
import { addAtom, atomById, bondOrderSum, createBondAt, emptyMolecule, neighbors } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
import type { HotTarget, Molecule } from "@structura/core/types"
import { ATOM_KEYS, BOND_KEYS, hasHotkey, hotkeyOps, selectionHotkeyOps, selectionTips } from "../../src/hotkeys/lookup.ts"
import { seeded } from "@structura/testkit"

const SINGLE = { order: 1 as const, stereo: "none" as const }

/** The ops on a drawing that holds just this molecule; `mol` is the molecule afterwards. */
function run(mol: Molecule, ops: Op[]) {
  const result = applyOps({ ...emptyDrawing(), molecule: mol }, ops)
  return { ...result, mol: result.drawing.molecule }
}

/** A hover key pressed over the target: its ops through applyOps, as the canvas does. */
function press(mol: Molecule, target: HotTarget, key: string): { mol: Molecule; next: HotTarget } | null {
  const ops = hotkeyOps(mol, target, key)
  if (!ops) return null
  const result = run(mol, ops)
  assert.ok(result.ok, result.ok ? "" : `key ${key}: ${result.error}`)
  assert.ok(result.next, `key ${key} leaves the cursor somewhere`)
  return { mol: result.mol, next: result.next }
}

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
    const step = press(mol, { type: "atom", id }, "1")
    assert.ok(step)
    mol = step.mol
    id = step.next.type === "atom" ? step.next.id : id
    assert.equal(plainFormula(mol), formula)
    assert.equal(bondOrderSum(mol, id), 1)
  }
})

test("0 grows straight up", () => {
  const start = ethane()
  const step = press(start.mol, { type: "atom", id: start.end }, "0")
  assert.ok(step && step.next.type === "atom")
  const born = atomById(step.mol, step.next.id)
  const from = atomById(step.mol, start.end)
  assert.ok(born && from)
  assert.ok(born.y < from.y - 20)
  assert.ok(Math.abs(born.x - from.x) < 1)
})

test("2 on a primary carbon adds a carbonyl and a methyl", () => {
  const start = ethane()
  const step = press(start.mol, { type: "atom", id: start.end }, "2")
  assert.ok(step && step.next.type === "atom")
  assert.equal(plainFormula(step.mol), "C3H6O")
  assert.equal(step.next.id === start.end, false)
  const methyl = atomById(step.mol, step.next.id)
  assert.equal(methyl?.el, "C")
  const amide = press(step.mol, step.next, "n")
  assert.ok(amide)
  assert.equal(plainFormula(amide.mol), "C2H5NO")
})

test("2 on a chain atom with two bonds only adds the oxygen", () => {
  const start = ethane()
  const grown = press(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const step = press(grown.mol, { type: "atom", id: start.end }, "2")
  assert.ok(step && step.next.type === "atom")
  assert.equal(step.next.id, start.end)
  assert.equal(plainFormula(step.mol), "C3H6O")
  assert.equal(step.mol.atoms.length, 4)
})

test("3 makes the singly bonded atom a benzene carbon, with the hotspot at para", () => {
  const start = ethane()
  const phenyl = press(start.mol, { type: "atom", id: start.end }, "3")
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
  const acyl = press(phenyl.mol, phenyl.next, "2")
  assert.ok(acyl && acyl.next.type === "atom")
  assert.equal(plainFormula(acyl.mol), "C9H10O")
  const extended = press(acyl.mol, acyl.next, "1")
  assert.ok(extended)
  assert.equal(plainFormula(extended.mol), "C10H12O")
})

test("bond keys change order, style, or fuse", () => {
  const start = ethane()
  const doubled = press(start.mol, { type: "bond", id: start.bond }, "2")
  assert.ok(doubled)
  assert.equal(doubled.mol.bonds[0]?.order, 2)
  assert.equal(doubled.mol.atoms.length, 2)
  const tripled = press(start.mol, { type: "bond", id: start.bond }, "3")
  assert.equal(tripled?.mol.bonds[0]?.order, 3)
  const phenyl = press(start.mol, { type: "bond", id: start.bond }, "a")
  assert.equal(phenyl?.mol.atoms.length, 6)
  const pentene = press(start.mol, { type: "bond", id: start.bond }, "z")
  assert.equal(pentene?.mol.atoms.length, 5)
  assert.equal(pentene?.mol.bonds.filter((bond) => bond.order === 2).length, 1)
  const bold = press(start.mol, { type: "bond", id: start.bond }, "b")
  assert.equal(bold?.mol.bonds[0]?.look, "bold")
  assert.equal(bold?.mol.bonds[0]?.stereo, "none")
  const dashedDouble = press(doubled.mol, { type: "bond", id: start.bond }, "D")
  assert.equal(dashedDouble?.mol.bonds[0]?.order, 2)
  assert.equal(dashedDouble?.mol.bonds[0]?.emphasis, "dashed")
})

test("a on a bond fuses benzene", () => {
  const start = ethane()
  const fused = press(start.mol, { type: "bond", id: start.bond }, "a")
  assert.ok(fused && fused.next.type === "atom")
  assert.equal(fused.mol.atoms.length, 6)
  assert.equal(plainFormula(fused.mol), "C6H6")
})

test("letter case changes the group", () => {
  const start = ethane()
  const alcohol = press(start.mol, { type: "atom", id: start.end }, "o")
  assert.ok(alcohol)
  assert.equal(plainFormula(alcohol.mol), "CH4O")
  const methoxy = press(start.mol, { type: "atom", id: start.end }, "O")
  assert.ok(methoxy)
  assert.equal(atomById(methoxy.mol, start.end)?.el, "O")
  assert.equal(plainFormula(methoxy.mol), "C2H6O")
  const phenyl = press(start.mol, { type: "atom", id: start.end }, "P")
  assert.ok(phenyl)
  assert.equal(phenyl.mol.atoms.length, 7)
  assert.deepEqual(phenyl.mol.groups.map((group) => [group.label, group.atoms[0], group.atoms.length]), [["Ph", start.end, 6]])
  assert.equal(plainFormula(phenyl.mol), "C7H8")
})

test("K is tert-butyl on a primary carbon and a stereo pair midway", () => {
  const start = ethane()
  const butyl = press(start.mol, { type: "atom", id: start.end }, "K")
  assert.ok(butyl && butyl.next.type === "atom")
  assert.equal(plainFormula(butyl.mol), "C5H12")
  assert.equal(butyl.mol.atoms.length, 5)
  assert.equal(butyl.mol.bonds.length, 4)
  assert.equal(butyl.next.id, start.end)
  assert.equal(neighbors(butyl.mol, start.end).length, 4)
  const grown = press(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const pair = press(grown.mol, { type: "atom", id: start.end }, "K")
  assert.ok(pair)
  assert.equal(pair.mol.atoms.length, 5)
  const stereos = pair.mol.bonds.map((bond) => bond.stereo).sort()
  assert.deepEqual(stereos.filter((stereo) => stereo === "up" || stereo === "down"), ["down", "up"])
})

test("K on a longer chain end makes that atom the quaternary carbon", () => {
  const start = ethane()
  const grown = press(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown && grown.next.type === "atom")
  const butyl = press(grown.mol, grown.next, "K")
  assert.ok(butyl)
  assert.equal(plainFormula(butyl.mol), "C6H14")
  assert.equal(butyl.mol.atoms.length, 6)
  assert.equal(neighbors(butyl.mol, grown.next.id).length, 4)
  const hub = atomById(butyl.mol, grown.next.id)
  assert.ok(hub)
  for (const methyl of neighbors(butyl.mol, grown.next.id)) assert.ok(Math.abs(dist(hub, methyl) - 40) < 1)
  const lone = addAtom(emptyMolecule(), "C", 0, 0)
  const isobutane = press(lone.mol, { type: "atom", id: lone.id }, "K")
  assert.ok(isobutane)
  assert.equal(plainFormula(isobutane.mol), "C4H10")
})

test("shifted label keys turn the hovered end atom into the group", () => {
  const start = ethane()
  const cases: Array<[string, string, string]> = [
    ["F", "C", "C2H3F3"],
    ["N", "N", "CH3NO2"],
    ["M", "Mg", "CH3BrMg"],
  ]
  for (const [key, el, formula] of cases) {
    const step = press(start.mol, { type: "atom", id: start.end }, key)
    assert.ok(step)
    assert.equal(atomById(step.mol, start.end)?.el, el)
    assert.equal(plainFormula(step.mol), formula)
  }
  const nitro = press(start.mol, { type: "atom", id: start.end }, "N")
  assert.equal(nitro && atomById(nitro.mol, start.end)?.charge, 1)
  const grown = press(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const ether = press(grown.mol, { type: "atom", id: start.end }, "O")
  assert.ok(ether)
  assert.equal(atomById(ether.mol, start.end)?.el, "C")
  assert.equal(plainFormula(ether.mol), "C4H10O")
})

test("9 forks two substituents and 6 on a substituted atom is spiro", () => {
  const start = ethane()
  const fork = press(start.mol, { type: "atom", id: start.end }, "9")
  assert.ok(fork)
  assert.equal(plainFormula(fork.mol), "C4H10")
  const grown = press(start.mol, { type: "atom", id: start.end }, "1")
  assert.ok(grown)
  const spiro = press(grown.mol, { type: "atom", id: start.end }, "6")
  assert.ok(spiro)
  assert.equal(neighbors(spiro.mol, start.end).length, 4)
})

test("j and J chairs mirror across the chain", () => {
  const placed = addAtom(emptyMolecule(), "C", 0, 0)
  const up = press(placed.mol, { type: "atom", id: placed.id }, "j")
  const down = press(placed.mol, { type: "atom", id: placed.id }, "J")
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
  const label = (text: string) => {
    const result = run(start.mol, [{ op: "label", atom: start.end, text }])
    assert.ok(result.ok)
    return result.mol
  }
  const chlorine = label("Cl")
  assert.equal(atomById(chlorine, start.end)?.el, "Cl")
  assert.equal(atomById(chlorine, start.end)?.alias, undefined)
  const methyl = label("Me")
  assert.equal(atomById(methyl, start.end)?.alias, undefined)
  assert.deepEqual(methyl.groups.map((group) => group.label), ["Me"])
  assert.equal(plainFormula(methyl), "C2H6")
})

test("hasHotkey knows which keys mean something on atoms and bonds", () => {
  assert.ok(hasHotkey("atom", "x"))
  assert.ok(hasHotkey("atom", "1"))
  assert.ok(!hasHotkey("atom", "g"))
  assert.ok(hasHotkey("bond", "6"))
  assert.ok(!hasHotkey("bond", "x"))
  assert.ok(!hasHotkey("atom", "toString"))
  const start = ethane()
  assert.equal(hotkeyOps(start.mol, { type: "atom", id: start.end }, "§"), null, "a key that means nothing sends nothing")
  assert.equal(hotkeyOps(start.mol, { type: "bond", id: start.bond }, "toString"), null)
})

test("d makes deuterium instead of a label", () => {
  const carbon = addAtom(emptyMolecule(), "C", 0, 0)
  const mol = press(carbon.mol, { type: "atom", id: carbon.id }, "h")!.mol
  const hydrogen = press(mol, { type: "atom", id: carbon.id }, "1")!
  const step = press(hydrogen.mol, hydrogen.next, "d")
  assert.ok(step && hydrogen.next.type === "atom")
  assert.equal(atomById(step.mol, hydrogen.next.id)?.el, "H")
  assert.equal(atomById(step.mol, hydrogen.next.id)?.isotope, 2)
  assert.deepEqual(step.next, hydrogen.next, "the cursor stays on the atom")
})

test("keys and named recipes build the same groups", () => {
  const start = ethane()
  const pairs: Array<[string, string]> = [["nitro", "N"], ["tert-butyl", "K"], ["carbonyl", "2"], ["trifluoromethyl", "F"], ["chair", "j"]]
  for (const [name, key] of pairs) {
    const byName = run(start.mol, [{ op: "add_recipe", to: start.end, name: name as never }])
    const byKey = press(start.mol, { type: "atom", id: start.end }, key)
    assert.ok(byName.ok && byKey)
    assert.equal(plainFormula(byName.mol), plainFormula(byKey.mol), name)
  }
})

test("one key on several selected atoms is one edit and follows every new tip", () => {
  const start = ethane()
  const selected = start.mol.atoms.map((atom) => atom.id)
  const ops = selectionHotkeyOps(start.mol, { atoms: selected, bonds: [] }, "x")
  assert.ok(ops)
  const result = run(start.mol, ops)
  assert.ok(result.ok)
  assert.equal(plainFormula(result.mol), "C4H10")
  const tips = selectionTips(selected, result.names)
  assert.equal(new Set(tips).size, 2)
  tips.forEach((tip, index) => {
    assert.notEqual(tip, selected[index])
    assert.ok(atomById(result.mol, tip))
  })

  const oxygens = run(start.mol, selectionHotkeyOps(start.mol, { atoms: selected, bonds: [] }, "o")!)
  assert.ok(oxygens.ok)
  assert.deepEqual(selectionTips(selected, oxygens.names), selected, "a key that changes atoms in place keeps them")

  const bonds = run(start.mol, selectionHotkeyOps(start.mol, { atoms: [], bonds: [start.bond] }, "2")!)
  assert.ok(bonds.ok)
  assert.equal(bonds.mol.bonds[0].order, 2, "with only bonds selected, bond keys apply")
  assert.equal(selectionHotkeyOps(start.mol, { atoms: selected, bonds: [] }, "§"), null)
  assert.equal(selectionHotkeyOps(start.mol, { atoms: [], bonds: [] }, "x"), null)
})

test("bond keys set the whole look, emphasis included, and fuse chairs", () => {
  const start = ethane()
  const bold = press(press(start.mol, { type: "bond", id: start.bond }, "B")!.mol, { type: "bond", id: start.bond }, "2")
  assert.equal(bold?.mol.bonds[0]?.emphasis, undefined, "2 is a plain double bond, not the emphasised one it replaces")
  const wedge = press(start.mol, { type: "bond", id: start.bond }, "w")
  assert.equal(wedge?.mol.bonds[0]?.stereo, "up")
  const up = press(start.mol, { type: "bond", id: start.bond }, "9")
  const down = press(start.mol, { type: "bond", id: start.bond }, "0")
  assert.ok(up && down && up.next.type === "atom")
  assert.equal(plainFormula(up.mol), "C6H12")
  assert.notDeepEqual(up.mol.atoms, down.mol.atoms)
})

/** Small deterministic generator so a failure always replays the same way. */
test("random key presses never break the molecule", () => {
  const atomKeys = Object.keys(ATOM_KEYS)
  const bondKeys = Object.keys(BOND_KEYS)
  for (let seed = 1; seed <= 30; seed++) {
    const next = seeded(seed)
    const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)]
    let mol = ethane().mol
    for (let step = 0; step < 60; step++) {
      const onBond = next() < 0.3 && mol.bonds.length > 0
      const target: HotTarget = onBond ? { type: "bond", id: pick(mol.bonds).id } : { type: "atom", id: pick(mol.atoms).id }
      const key = pick(onBond ? bondKeys : atomKeys)
      const result = run(mol, hotkeyOps(mol, target, key)!)
      // A key may find no room (a ring on a crowded bond), but never leaves a broken molecule.
      if (!result.ok) assert.doesNotMatch(result.error, /break/, `seed ${seed}, step ${step}: ${target.type} key ${key}`)
      else mol = result.mol
      if (mol.atoms.length > 120) mol = ethane().mol
    }
  }
})
