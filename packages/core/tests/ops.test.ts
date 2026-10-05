import assert from "node:assert/strict"
import test from "node:test"
import { addReactionArrow, emptyDrawing } from "../src/drawing.ts"
import { plainFormula } from "../src/formula.ts"
import { addAtom, atomById, bondById, boundsCenter, createBondAt, emptyMolecule, neighbors, tumbleAtoms } from "../src/molecule.ts"
import { applyOps, type Op } from "../src/ops.ts"
import type { Molecule } from "../src/types.ts"
import { validate } from "../src/validate.ts"
import { seeded } from "@structura/testkit"

const SINGLE = { order: 1 as const, stereo: "none" as const }

/** The ops on a drawing that holds just this molecule; `mol` is the molecule afterwards. */
function run(mol: Molecule, ops: Op[]) {
  const result = applyOps({ ...emptyDrawing(), molecule: mol }, ops)
  return { ...result, mol: result.drawing.molecule }
}

function ok(mol: Molecule, ops: Op[]) {
  const result = run(mol, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result
}

test("a molecule can be built from nothing with named atoms", () => {
  const acid = ok(emptyMolecule(), [
    { op: "add_atom", el: "C", as: "methyl" },
    { op: "add_atom", el: "C", to: "methyl", as: "carboxyl" },
    { op: "add_atom", el: "O", to: "carboxyl", order: 2 },
    { op: "add_atom", el: "O", to: "carboxyl", as: "hydroxyl" },
  ])
  assert.equal(plainFormula(acid.mol), "C2H4O2")
  assert.deepEqual(Object.keys(acid.names), ["methyl", "carboxyl", "hydroxyl"])
  assert.equal(atomById(acid.mol, acid.names.hydroxyl)?.el, "O")
  assert.deepEqual(validate(acid.mol), [])
})

test("a batch is all or nothing and says which op failed", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const result = run(start, [
    { op: "set_element", atom: 1, el: "N" },
    { op: "set_element", atom: 99, el: "O" },
  ])
  assert.equal(result.ok, false)
  assert.equal(result.mol, start)
  if (!result.ok) {
    assert.equal(result.index, 1)
    assert.match(result.error, /#99/)
  }
})

test("mistakes are reported instead of guessed at", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const cases: Array<[Op[], RegExp]> = [
    [[{ op: "add_atom", el: "C", to: "nobody" }], /no atom is named "nobody"/],
    [[{ op: "add_atom", el: "Xx", to: 1 }], /not an element/],
    [[{ op: "add_atom", el: "C", to: 1, as: "a" }, { op: "add_atom", el: "C", to: 2, as: "a" }], /already used/],
    [[{ op: "add_bond", a: 1, b: 2 }], /already bonded/],
    [[{ op: "set_charge", atom: 1, charge: 5 }], /outside/],
    [[{ op: "set_bond", bond: { between: [1, 1] }, order: 2 }], /not bonded/],
    [[{ op: "set_bond", bond: 1, order: 2, stereo: "up" }], /single bond/],
    [[{ op: "add_ring", atom: 1, size: 9 }], /no ring of size 9/],
    [[{ op: "add_ring", atom: 1, size: 5, aromatic: true }], /six-membered/],
    [[{ op: "add_group", to: 1, name: "Zzz" }], /not a known abbreviation/],
  ]
  for (const [ops, message] of cases) {
    const result = run(start, ops)
    assert.equal(result.ok, false, JSON.stringify(ops))
    if (!result.ok) assert.match(result.error, message)
    assert.equal(result.mol, start)
  }
})

test("rings, groups and labels go through the same code as the editor", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const built = ok(start, [
    { op: "add_ring", atom: 2, size: 6, aromatic: true, as: "para" },
    { op: "add_group", to: "para", name: "Boc" },
  ])
  assert.equal(plainFormula(built.mol), "C12H16O2", "toluene, since the end carbon joins the ring, with Boc para")

  const fused = ok(start, [{ op: "add_ring", bond: 1, size: 6, aromatic: true }])
  assert.equal(plainFormula(fused.mol), "C6H6")

  const labelled = ok(start, [{ op: "label", atom: 2, text: "OMe" }])
  assert.equal(plainFormula(labelled.mol), "C2H6O")
})

test("a wedge named by its atoms starts at the first one", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const wedged = ok(start, [{ op: "set_bond", bond: { between: [2, 1] }, stereo: "up" }])
  assert.equal(bondById(wedged.mol, 1)?.a, 2)
  assert.equal(bondById(wedged.mol, 1)?.stereo, "up")
})

test("warnings come back but do not stop the edit", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const crowded = ok(start, [
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 1 },
  ])
  assert.deepEqual(crowded.problems.map((problem) => problem.code), ["valence"])
})

/** Small deterministic generator so a failure always replays the same way. */
test("random batches either apply cleanly or change nothing", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const next = seeded(seed)
    const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)]
    let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
    for (let step = 0; step < 40; step++) {
      // Some refs point at atoms that do not exist, on purpose.
      const ref = () => (next() < 0.9 && mol.atoms.length > 0 ? pick(mol.atoms).id : 9999)
      const bondRef = () => (next() < 0.9 && mol.bonds.length > 0 ? pick(mol.bonds).id : 9999)
      const ops: Op[] = Array.from({ length: 1 + Math.floor(next() * 3) }, (): Op => {
        switch (Math.floor(next() * 10)) {
          case 0:
            return { op: "add_atom", el: pick(["C", "N", "O", "S"]), to: ref(), order: pick([1, 2] as const) }
          case 1:
            return { op: "set_element", atom: ref(), el: pick(["C", "N", "O", "Cl"]) }
          case 2:
            return { op: "set_charge", atom: ref(), charge: pick([-1, 0, 1]) }
          case 3:
            return { op: "set_bond", bond: bondRef(), order: pick([1, 2, 3] as const) }
          case 4:
            return { op: "remove", atoms: [ref()] }
          case 5:
            return { op: "add_ring", atom: ref(), size: pick([3, 5, 6]), aromatic: next() < 0.3 }
          case 6:
            return { op: "add_ring", bond: bondRef(), size: pick([5, 6]) }
          case 7:
            return { op: "add_group", to: ref(), name: pick(["Me", "Ph", "Boc", "OMe", "NO2", "SO2"]) }
          case 8:
            return { op: "add_recipe", to: ref(), name: pick(["carbonyl", "fork", "tert-butyl", "nitro", "chair"] as const) }
          default:
            return { op: "rotate", atoms: mol.atoms.map((atom) => atom.id), angle: next() }
        }
      })
      const result = run(mol, ops)
      if (result.ok) {
        assert.deepEqual(validate(result.mol).filter((problem) => problem.severity === "error"), [], `seed ${seed} step ${step}`)
        mol = result.mol
      } else {
        assert.equal(result.mol, mol, `seed ${seed} step ${step}: a failed batch must not change anything`)
      }
      if (mol.atoms.length === 0) mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
    }
  }
})

test("add_atom always adds the atom it was asked for, even next to another atom", () => {
  // Put an O exactly where the next chain atom would go.
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const spot = run(start, [{ op: "add_atom", el: "C", to: 2, as: "probe" }])
  assert.ok(spot.ok)
  const probe = atomById(spot.mol, spot.names.probe)!
  const crowded = addAtom(start, "O", probe.x + 3, probe.y + 3).mol
  const result = ok(crowded, [{ op: "add_atom", el: "N", to: 2, as: "n" }])
  assert.equal(atomById(result.mol, result.names.n)?.el, "N")
  assert.ok(result.names.n >= crowded.nextAtomId, "a new atom, not the O that was already there")
  assert.deepEqual(result.added.atoms, [result.names.n])
})

test("a recipe never bonds to an unrelated atom sitting where it builds", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const spot = ok(start, [{ op: "add_atom", el: "C", to: 2, as: "probe" }])
  const probe = atomById(spot.mol, spot.names.probe)!
  const stray = addAtom(start, "O", probe.x + 3, probe.y + 3)
  const result = ok(stray.mol, [{ op: "add_recipe", to: 2, name: "azide" }])
  assert.equal(neighbors(result.mol, stray.id).length, 0, "the stray O stays unbonded")
  assert.equal(result.added.atoms.length, 3)
  assert.equal(plainFormula(result.mol), "C2H7N3O", "ethyl azide next to a lone water")
})

test("clicking an atom joins the atom its new bond lands on, at any drawing scale", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const big = ok(start, [{ op: "scale", atoms: [1, 2], sx: 2, sy: 2, center: { x: 0, y: 0 } }]).mol
  const tip = ok(big, [{ op: "add_atom", el: "C", to: 2, as: "tip" }])
  const where = atomById(tip.mol, tip.names.tip)!
  // 20 px off is beyond the 12 px click radius, but within it once scaled to 80 px bonds.
  const near = addAtom(big, "C", where.x + 20, where.y)
  const clicked = ok(near.mol, [{ op: "draw_bond", from: 2 }])
  assert.deepEqual(clicked.added.atoms, [])
  assert.equal(neighbors(clicked.mol, near.id).length, 1)
})

test("the result lists exactly the atoms and bonds a batch created", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const ring = ok(start, [{ op: "add_ring", atom: 2, size: 6, aromatic: true }])
  assert.equal(ring.added.atoms.length, 5, "the end carbon joins the ring; five new atoms")
  assert.equal(ring.added.bonds.length, 6)
  assert.ok(ring.added.atoms.every((id) => id >= start.nextAtomId))

  const removed = ok(ring.mol, [{ op: "remove", atoms: [ring.added.atoms[0]] }])
  assert.deepEqual(removed.added, { atoms: [], bonds: [], arrows: [] })

  const relabelled = ok(start, [{ op: "set_element", atom: 2, el: "N" }])
  assert.deepEqual(relabelled.added, { atoms: [], bonds: [], arrows: [] })
})

test("drawing ops do what the mouse tools do", () => {
  const empty = emptyMolecule()
  const clicked = ok(empty, [{ op: "draw_bond", start: { x: 0, y: 0 } }])
  assert.equal(plainFormula(clicked.mol), "C2H6")
  assert.equal(clicked.added.atoms.length, 2)

  const dragged = ok(clicked.mol, [{ op: "draw_bond", from: 2, start: { x: 40, y: 0 }, end: { x: 60, y: -34.6 }, order: 2 }])
  assert.equal(dragged.mol.bonds.at(-1)?.order, 2)
  const joined = ok(dragged.mol, [{ op: "draw_bond", from: dragged.added.atoms[0], start: { x: 60, y: -34.6 }, end: { x: 0, y: 0 } }])
  assert.equal(joined.added.atoms.length, 0, "ending on an existing atom joins it")

  const chain = ok(empty, [{ op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 34.6, y: -20 }, { x: 69.3, y: 0 }, { x: 103.9, y: -20 }] }])
  assert.equal(plainFormula(chain.mol), "C4H10")

  const placed = ok(empty, [{ op: "place_atom", el: "N", at: { x: 5, y: 5 } }])
  assert.equal(plainFormula(placed.mol), "H3N")
  const ring = ok(empty, [{ op: "add_ring", at: { x: 0, y: 0 }, size: 6, aromatic: true }])
  assert.equal(plainFormula(ring.mol), "C6H6")
  assert.equal(run(empty, [{ op: "add_ring", at: { x: 0, y: 0 }, atom: 1, size: 6 }]).ok, false)
})

test("scaling and duplicating report what they did", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const scaled = ok(start, [{ op: "scale", atoms: [1, 2], sx: 2, sy: 2, center: { x: 0, y: 0 } }])
  assert.equal(atomById(scaled.mol, 2)?.x, 80)
  assert.equal(run(start, [{ op: "scale", atoms: [1, 2], sx: 0, sy: 1 }]).ok, false)

  const copy = ok(start, [{ op: "duplicate", atoms: [1, 2] }])
  assert.equal(copy.added.atoms.length, 2)
  assert.equal(copy.added.bonds.length, 1)
})

test("a ring can be named by kind, which also reaches cyclopentene", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const fused = ok(start, [{ op: "add_ring", bond: 1, kind: "cyclopentene" }])
  assert.equal(plainFormula(fused.mol), "C5H8")
  assert.equal(plainFormula(ok(emptyMolecule(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).mol), "C6H6")
  const bad = run(start, [{ op: "add_ring", bond: 1, kind: "cyclodecane" as never }])
  assert.equal(bad.ok, false)
  assert.equal(run(start, [{ op: "add_ring", bond: 1 }]).ok, false, "size or kind is required")
})

test("an unknown recipe is named with the ones there are", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const bad = run(start, [{ op: "add_recipe", to: 2, name: "unobtainium" as never }])
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.match(bad.error, /not a known recipe.*nitro/)
})

test("add_atom can wedge its bond and aim it", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const wedged = ok(start, [{ op: "add_atom", el: "C", to: 2, stereo: "up", as: "tip" }])
  const bond = wedged.mol.bonds.at(-1)!
  assert.deepEqual([bond.a, bond.b, bond.stereo], [2, wedged.names.tip, "up"], "the wedge starts at `to`")

  const up = ok(start, [{ op: "add_atom", el: "C", to: 2, angle: Math.PI / 2, as: "tip" }])
  const from = atomById(up.mol, 2)!
  const tip = atomById(up.mol, up.names.tip)!
  assert.ok(Math.abs(tip.x - from.x) < 1e-9 && tip.y < from.y - 39, "π/2 grows straight up the page")
  assert.deepEqual(up.next, { type: "atom", id: up.names.tip })

  assert.equal(run(start, [{ op: "add_atom", el: "C", to: 2, order: 2, stereo: "up" }]).ok, false)
  assert.equal(run(start, [{ op: "add_atom", el: "C", angle: 1 }]).ok, false, "an angle needs `to`")
})

test("set_bond sets and clears the emphasised side of a double bond", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const dashed = ok(start, [{ op: "set_bond", bond: 1, order: 2, emphasis: "dashed" }])
  assert.equal(bondById(dashed.mol, 1)?.emphasis, "dashed")
  assert.equal(bondById(dashed.mol, 1)?.order, 2)
  const kept = ok(dashed.mol, [{ op: "set_bond", bond: 1, order: 2 }])
  assert.equal(bondById(kept.mol, 1)?.emphasis, "dashed", "left out, the emphasis stays")
  const cleared = ok(dashed.mol, [{ op: "set_bond", bond: 1, emphasis: null }])
  assert.equal(bondById(cleared.mol, 1)?.emphasis, undefined)
  assert.equal(run(start, [{ op: "set_bond", bond: 1, emphasis: "bold" }]).ok, false, "a single bond has no second stroke")
})

test("add_ring with chair folds a cyclohexane chair onto a bond or an atom", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const up = ok(start, [{ op: "add_ring", bond: 1, chair: 1, as: "far" }])
  const down = ok(start, [{ op: "add_ring", bond: 1, chair: -1 }])
  assert.equal(plainFormula(up.mol), "C6H12")
  assert.deepEqual(up.next, { type: "atom", id: up.names.far })
  const side = (mol: Molecule) => Math.sign(mol.atoms.reduce((sum, atom) => sum + atom.y, 0))
  assert.equal(side(up.mol), -side(down.mol), "-1 mirrors it across the bond")

  const onAtom = ok(start, [{ op: "add_ring", atom: 2, chair: -1 }])
  const recipe = ok(start, [{ op: "add_recipe", to: 2, name: "chair-flipped" }])
  assert.deepEqual(onAtom.mol, recipe.mol)
  assert.deepEqual(onAtom.next, recipe.next)

  assert.equal(run(start, [{ op: "add_ring", bond: 1, chair: 1, kind: "benzene" }]).ok, false)
  assert.equal(run(start, [{ op: "add_ring", at: { x: 0, y: 0 }, chair: 1 }]).ok, false)
})

test("ops that change an atom or bond in place leave the cursor on it", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  assert.deepEqual(ok(start, [{ op: "set_element", atom: 2, el: "O" }]).next, { type: "atom", id: 2 })
  assert.deepEqual(ok(start, [{ op: "set_charge", atom: 2, charge: 1 }]).next, { type: "atom", id: 2 })
  assert.deepEqual(ok(start, [{ op: "set_isotope", atom: 2, isotope: 13 }]).next, { type: "atom", id: 2 })
  assert.deepEqual(ok(start, [{ op: "set_bond", bond: 1, order: 2 }]).next, { type: "bond", id: 1 })
})

test("an arrow is drawn beside the atoms and reported as added", () => {
  const molecule = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const start = { ...emptyDrawing(), molecule }
  const result = applyOps(start, [{ op: "add_arrow", atoms: [1, 2], direction: "right" }])
  assert.ok(result.ok)
  assert.deepEqual(result.drawing, addReactionArrow(start, [1, 2], "right"))
  assert.deepEqual(result.added, { atoms: [], bonds: [], arrows: [1] })
  assert.equal(result.drawing.molecule, molecule, "the molecule is untouched")
  assert.equal(applyOps(start, [{ op: "add_arrow", atoms: [], direction: "up" }]).ok, false)
  assert.equal(applyOps(start, [{ op: "add_arrow", atoms: [7], direction: "up" }]).ok, false)
})

test("tumbling hands back depth, so turns in steps match the chemistry's own", () => {
  const molecule = ok(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE), [{ op: "add_ring", atom: 2, size: 6 }]).mol
  const ids = molecule.atoms.map((atom) => atom.id)
  const center = boundsCenter(molecule, ids)!
  const step = Math.PI / 12
  const first = tumbleAtoms(molecule, ids, center, "y", step)
  const second = tumbleAtoms(first.mol, ids, center, "y", step, first.depth)

  const start = { ...emptyDrawing(), molecule }
  const once = applyOps(start, [{ op: "tumble", atoms: ids, axis: "y", angle: step }])
  assert.ok(once.ok && once.depth)
  assert.deepEqual(once.drawing.molecule, first.mol)
  const twice = applyOps(once.drawing, [{ op: "tumble", atoms: ids, axis: "y", angle: step, center, depth: once.depth }])
  assert.ok(twice.ok)
  assert.deepEqual(twice.drawing.molecule, second.mol)
  const batched = applyOps(start, [
    { op: "tumble", atoms: ids, axis: "y", angle: step },
    { op: "tumble", atoms: ids, axis: "y", angle: step, center },
  ])
  assert.ok(batched.ok)
  assert.deepEqual(batched.drawing.molecule, second.mol, "within a batch the depth carries over")
  assert.equal(ok(molecule, [{ op: "move", atoms: [1], dx: 1, dy: 0 }]).depth, undefined, "only a tumble leaves depth")
})

test("the result lists the atoms an edit moved", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  assert.deepEqual(ok(start, [{ op: "move", atoms: [2], dx: 5, dy: 0 }]).moved, [2])
  assert.deepEqual(ok(start, [{ op: "rotate", atoms: [1, 2], angle: Math.PI / 2 }]).moved, [1, 2])
  assert.deepEqual(ok(start, [{ op: "move", atoms: [2], dx: 5, dy: 0 }, { op: "move", atoms: [2], dx: -5, dy: 0 }]).moved, [], "moved back")
  const grown = ok(start, [{ op: "add_atom", el: "C", to: 2 }])
  assert.deepEqual(grown.moved, [], "new atoms are added, not moved")
  assert.deepEqual(ok(start, [{ op: "set_element", atom: 2, el: "N" }]).moved, [])
})

test("clean tidies atoms named earlier in the batch and leaves the rest alone", () => {
  const build: Op[] = [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 2, as: "a" },
    { op: "add_recipe", to: "a", name: "tert-butyl", as: "tbu" },
  ]
  const before = ok(emptyMolecule(), build)
  const result = ok(emptyMolecule(), [
    ...build,
    { op: "move", atoms: ["tbu"], dx: 17, dy: -11 },
    { op: "clean", atoms: ["tbu", 1], lock: [1] },
  ])
  const tbu = result.names.tbu
  for (const atom of result.mol.atoms) if (atom.id !== tbu) assert.deepEqual(atom, atomById(before.mol, atom.id))
  const centre = atomById(result.mol, tbu)!
  for (const other of neighbors(result.mol, tbu)) assert.ok(Math.abs(Math.hypot(other.x - centre.x, other.y - centre.y) - 40) < 2)
})

test("clean without atoms tidies the whole molecule", () => {
  const folded = ok(emptyMolecule(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "C", to: 2 },
    { op: "add_atom", el: "C", to: 3 },
  ])
  const [one, four] = [atomById(folded.mol, 1)!, atomById(folded.mol, 4)!]
  const squashed = ok(folded.mol, [{ op: "move", atoms: [4], dx: one.x - four.x, dy: one.y - four.y }])
  const cleaned = ok(squashed.mol, [{ op: "clean" }])
  const [a, b] = [atomById(cleaned.mol, 1)!, atomById(cleaned.mol, 4)!]
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 30)
  assert.equal(cleaned.mol.atoms.length, 4)
})

test("clean rejects atoms that are not there", () => {
  const start = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const unnamed = run(start, [{ op: "clean", atoms: ["nobody"] }])
  assert.ok(!unnamed.ok && /no atom is named "nobody"/.test(unnamed.error))
  const missing = run(start, [{ op: "clean", lock: [99] }])
  assert.ok(!missing.ok && /#99/.test(missing.error))
})
