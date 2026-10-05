import assert from "node:assert/strict"
import test from "node:test"
import { addReactionArrow, emptyDrawing } from "../src/drawing.ts"
import { setAtomLabel } from "../src/label.ts"
import {
  attachRingAt,
  bumpCharge,
  createBondAt,
  deleteSelection,
  emptyMolecule,
  flipAtoms,
  fuseChairAt,
  fuseRingAt,
  growRing,
  placeRing,
  rotateAtoms,
  setBondLook,
  setBondOrder,
  setElement,
  spiroRing,
  sprout,
  tumbleAtoms,
} from "../src/molecule.ts"
import { RECIPES, type RecipeName } from "../src/molecule/recipes.ts"
import type { BondStyle, Molecule, RingKind } from "../src/types.ts"
import { errorsOf, validate, validateDrawing, type Problem } from "../src/validate.ts"
import { seeded } from "@structura/testkit"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function codes(problems: Problem[]): string[] {
  return problems.map((problem) => problem.code).sort()
}

function ethane(): Molecule {
  return createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
}

test("a freshly drawn molecule has no problems", () => {
  assert.deepEqual(validate(ethane()), [])
  assert.deepEqual(validate(placeRing(emptyMolecule(), { x: 0, y: 0 }, "benzene")), [])
})

test("broken invariants are reported as errors with the ids involved", () => {
  const mol = ethane()
  const [a, b] = mol.atoms
  const bond = mol.bonds[0]

  const dangling = { ...mol, bonds: [{ ...bond, b: 99 }] }
  assert.deepEqual(codes(validate(dangling)), ["dangling-bond"])
  assert.deepEqual(validate(dangling)[0].atoms, [99])

  const twice = { ...mol, bonds: [bond, { ...bond, id: mol.nextBondId, a: bond.b, b: bond.a }], nextBondId: mol.nextBondId + 1 }
  assert.deepEqual(codes(validate(twice)), ["duplicate-bond"])

  const loop = { ...mol, bonds: [{ ...bond, b: bond.a }] }
  assert.deepEqual(codes(validate(loop)), ["self-bond"])

  const clash = { ...mol, atoms: [a, { ...b, id: a.id }] }
  assert.ok(codes(validate(clash)).includes("duplicate-id"))

  const ahead = { ...mol, nextAtomId: a.id }
  assert.deepEqual(codes(validate(ahead)), ["id-not-below-counter", "id-not-below-counter"])

  const lost = { ...mol, atoms: [{ ...a, x: Number.NaN }, b] }
  assert.deepEqual(codes(validate(lost)), ["bad-coordinate"])

  const wedged = { ...mol, bonds: [{ ...bond, order: 2 as const, stereo: "up" as const }] }
  assert.deepEqual(codes(validate(wedged)), ["stereo-on-multiple-bond"])

  const boldWedge = { ...mol, bonds: [{ ...bond, stereo: "up" as const, look: "bold" as const }] }
  assert.deepEqual(codes(validate(boldWedge)), ["look-on-special-bond"])
})

test("an overfilled atom is only a warning", () => {
  let mol = emptyMolecule()
  mol = createBondAt(mol, { x: 0, y: 0 }, SINGLE)
  const center = mol.atoms[0].id
  for (let index = 0; index < 4; index++) mol = sprout(mol, center, SINGLE)
  const problems = validate(mol)
  assert.deepEqual(codes(problems), ["valence"])
  assert.equal(problems[0].severity, "warning")
  assert.deepEqual(problems[0].atoms, [center])
  assert.deepEqual(errorsOf(problems), [])
})

test("drawing checks arrows on top of the molecule", () => {
  const molecule = ethane()
  const drawing = addReactionArrow({ ...emptyDrawing(), molecule }, molecule.atoms.map((atom) => atom.id), "right")
  assert.deepEqual(validateDrawing(drawing), [])
  const clash = { ...drawing, arrows: [...drawing.arrows, { ...drawing.arrows[0] }] }
  assert.deepEqual(codes(validateDrawing(clash)), ["duplicate-id"])
})

/** Small deterministic generator so a failure always replays the same way. */
const RECIPE_NAMES = Object.keys(RECIPES) as RecipeName[]
const LOOKS: BondStyle[] = [
  { order: 2, stereo: "none" },
  { order: 3, stereo: "none" },
  { order: 1, stereo: "up" },
  { order: 1, stereo: "either" },
  { order: 1, stereo: "none", look: "bold" },
  { order: 1, stereo: "none", look: "shadow" },
  { order: 2, stereo: "none", emphasis: "dashed" },
]
const RINGS: RingKind[] = ["benzene", "cyclohexane", "cyclopentane", "cyclobutane", "cyclopropane", "cycloheptane"]
const LABELS = ["N", "O", "Cl", "Me", "Ph", "Boc", "D", "Xyz", "", "Ac", "Ts", "TBS", "CO2Me", "NO2", "SO2", "CF3", "13C"]

test("random edits never break an invariant", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const next = seeded(seed)
    const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)]
    let mol = ethane()
    const log: string[] = []
    for (let step = 0; step < 80; step++) {
      const atom = mol.atoms.length > 0 ? pick(mol.atoms) : null
      const bond = mol.bonds.length > 0 ? pick(mol.bonds) : null
      const roll = next()
      let label: string
      if (!atom) {
        mol = ethane()
        label = "restart"
      } else if (roll < 0.35) {
        const name = pick(RECIPE_NAMES)
        mol = RECIPES[name](mol, atom.id).mol
        label = `atom #${atom.id} recipe ${name}`
      } else if (roll < 0.5 && bond) {
        const chair = next() < 0.3
        mol = chair ? fuseChairAt(mol, bond.id, next() < 0.5 ? 1 : -1).mol : setBondLook(mol, bond.id, pick(LOOKS))
        label = `bond #${bond.id} ${chair ? "chair" : "look"}`
      } else if (roll < 0.58) {
        mol = sprout(mol, atom.id, SINGLE, pick(["C", "N", "O"]))
        label = `sprout #${atom.id}`
      } else if (roll < 0.63) {
        mol = attachRingAt(mol, atom.id, pick(RINGS)).mol
        label = `attach ring #${atom.id}`
      } else if (roll < 0.68 && bond) {
        mol = fuseRingAt(mol, bond.id, pick(RINGS), next() < 0.5 ? 1 : -1).mol
        label = `fuse ring #${bond.id}`
      } else if (roll < 0.71) {
        mol = spiroRing(mol, atom.id, pick(RINGS)).mol
        label = `spiro #${atom.id}`
      } else if (roll < 0.74) {
        mol = growRing(mol, atom.id, pick(RINGS)).mol
        label = `grow ring #${atom.id}`
      } else if (roll < 0.8) {
        mol = deleteSelection(mol, next() < 0.5 || !bond ? { atoms: [atom.id], bonds: [] } : { atoms: [], bonds: [bond.id] })
        label = `delete near #${atom.id}`
      } else if (roll < 0.84) {
        mol = setAtomLabel(mol, atom.id, pick(LABELS))
        label = `label #${atom.id}`
      } else if (roll < 0.87) {
        mol = setElement(mol, [atom.id], pick(["N", "O", "S", "C"]))
        label = `element #${atom.id}`
      } else if (roll < 0.89) {
        mol = bumpCharge(mol, [atom.id], next() < 0.5 ? 1 : -1)
        label = `charge #${atom.id}`
      } else if (roll < 0.92 && bond) {
        mol = setBondOrder(mol, [bond.id], pick([1, 2, 3] as const))
        label = `order #${bond.id}`
      } else {
        const ids = mol.atoms.map((item) => item.id)
        const choice = next()
        if (choice < 0.33) mol = rotateAtoms(mol, ids, { x: 0, y: 0 }, next() * Math.PI)
        else if (choice < 0.66) mol = flipAtoms(mol, ids, next() < 0.5 ? "horizontal" : "vertical")
        else mol = tumbleAtoms(mol, ids, { x: 0, y: 0 }, next() < 0.5 ? "x" : "y", Math.PI / 12).mol
        label = "transform all"
      }
      log.push(label)
      const errors = errorsOf(validate(mol))
      assert.deepEqual(errors, [], `seed ${seed}, step ${step}: ${log.slice(-5).join(" → ")}`)
    }
  }
})
