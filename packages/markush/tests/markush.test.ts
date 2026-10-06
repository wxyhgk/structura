import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { plainFormula } from "@structura/core/formula"
import { toMolfile } from "@structura/core/molfile"
import { alternativesOf, isVariableName } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Choice, Drawing } from "@structura/core/types"
import { errorsOf, validate } from "@structura/core/validate"
import { label, run } from "@structura/testkit"
import { alternativeProblem, enumerate, representativesOf, undefinedVariables } from "@structura/markush"

/** Cyclopentane with X in the ring at atom 1 and placeholders R1, R2 hanging off atoms 3 and 4. */
function scaffold(): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclopentane" },
    { op: "label", atom: 1, text: "X" },
    { op: "add_atom", el: "C", to: 3, as: "r1" },
    { op: "label", atom: "r1", text: "R1" },
    { op: "add_atom", el: "C", to: 4, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
  ])
}

test("variables are checked when they are defined, and can be removed", () => {
  const drawing = scaffold()
  const bad: Array<[Op, RegExp]> = [
    [{ op: "set_variable", name: "Me", alternatives: [label("H")] }, /not a variable name/],
    [{ op: "set_variable", name: "Cl", alternatives: [label("H")] }, /not a variable name/],
    [{ op: "set_variable", name: "R1", alternatives: [] }, /at least one/],
    [{ op: "set_variable", name: "R1", alternatives: [{ kind: "class", class: "wizard" as "alkyl" }] }, /unknown class/],
    [{ op: "set_variable", name: "R1", alternatives: [{ kind: "class", class: "alkyl", min: 30, max: 1 }] }, /above/],
    [{ op: "set_variable", name: "R1", alternatives: [label("  ")] }, /1 to 32/],
  ]
  for (const [op, message] of bad) {
    const result = applyOps(drawing, [op])
    assert.ok(!result.ok && message.test(result.error), JSON.stringify(op))
  }
  const defined = run(drawing, [{ op: "set_variable", name: "R1", alternatives: [label(" H "), { kind: "class", class: "alkyl", min: 1, max: 30 }] }])
  assert.deepEqual(alternativesOf(defined.variables, "R1")[0], { kind: "label", text: "H" }, "labels are trimmed")
  assert.deepEqual(undefinedVariables(defined), ["X", "R2"])
  const removed = run(defined, [{ op: "remove_variable", name: "R1" }])
  assert.equal(removed.variables, undefined)
  assert.ok(!applyOps(removed, [{ op: "remove_variable", name: "R1" }]).ok)
})

function formula() {
  return run(scaffold(), [
    { op: "set_variable", name: "X", alternatives: [label("O"), label("S")] },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("F"), label("CN"), { kind: "class", class: "alkyl", min: 1, max: 30 }] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("Me")] },
  ])
}

test("a generic formula expands into every concrete combination; classes stay out", () => {
  const result = enumerate(formula())
  assert.equal(result.total, 12)
  assert.equal(result.molecules.length, 12)
  assert.deepEqual(result.classesLeftOut, { R1: 1 })
  assert.deepEqual([result.undefinedNames, result.onlyClasses, result.failed], [[], [], 0])
  const formulas = result.molecules.map((mol) => plainFormula(mol))
  assert.equal(formulas[0], "C4H8O", "X = O, R1 = H, R2 = H: tetrahydrofuran")
  assert.ok(formulas.includes("C6H9NS"), "X = S, R1 = CN, R2 = Me")
  assert.equal(new Set(formulas).size, 12, "every combination is different")
  for (const mol of result.molecules) {
    assert.ok(mol.atoms.every((atom) => !atom.alias), "no placeholder is left")
    assert.deepEqual(errorsOf(validate(mol)), [])
  }
})

test("enumeration stops at the limit but still counts every combination", () => {
  const result = enumerate(formula(), { limit: 5 })
  assert.equal(result.molecules.length, 5)
  assert.equal(result.total, 12)
})

test("a variable with only classes, or none at all, is reported", () => {
  const onlyClasses = run(formula(), [{ op: "set_variable", name: "R2", alternatives: [{ kind: "class", class: "aryl", min: 6, max: 30 }] }])
  const blocked = enumerate(onlyClasses)
  assert.equal(blocked.molecules.length, 0)
  assert.deepEqual(blocked.onlyClasses, ["R2"])
  const missing = run(formula(), [{ op: "remove_variable", name: "R2" }])
  const partial = enumerate(missing)
  assert.equal(partial.molecules.length, 6)
  assert.deepEqual(partial.undefinedNames, ["R2"])
})

test("R2 can share R1's list, as in 'R1 to R4 each independently are…'", () => {
  const drawing = run(scaffold(), [
    { op: "set_variable", name: "X", alternatives: [label("O")] },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("F")] },
    { op: "set_variable", name: "R2", sameAs: "R1" },
  ])
  // Each placeholder still chooses on its own: 2 × 2 combinations.
  const result = enumerate(drawing)
  assert.equal(result.total, 4)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)).sort(), ["C4H6F2O", "C4H7FO", "C4H7FO", "C4H8O"])
  // Editing R1 changes what R2 offers too.
  const more = run(drawing, [{ op: "set_variable", name: "R1", alternatives: [label("H"), label("F"), label("Cl")] }])
  assert.equal(enumerate(more).total, 9)

  const refused: Array<[Op, RegExp]> = [
    [{ op: "set_variable", name: "R2", sameAs: "R2" }, /its own list/],
    [{ op: "set_variable", name: "R2", sameAs: "R9" }, /no list of its own/],
    [{ op: "set_variable", name: "R1", sameAs: "X" }, /share R1's list/],
    [{ op: "remove_variable", name: "R1" }, /share R1's list/],
  ]
  for (const [op, message] of refused) {
    const outcome = applyOps(drawing, [op])
    assert.ok(!outcome.ok && message.test(outcome.error), JSON.stringify(op))
  }
})

test("with representatives, typical members inside each class's range stand in for it", () => {
  const withClasses = (...alternatives: Array<{ kind: "class"; class: "alkyl" | "aryl" | "heteroaryl" | "silyl" | "amino"; min?: number; max?: number; substituted?: boolean }>) =>
    run(formula(), [
      { op: "set_variable", name: "X", alternatives: [label("O")] },
      { op: "set_variable", name: "R1", alternatives },
      { op: "set_variable", name: "R2", alternatives: [label("H")] },
    ])

  const alkyl = enumerate(withClasses({ kind: "class", class: "alkyl", min: 1, max: 30 }), { representatives: true })
  const texts = (choices: Choice[] | undefined) => choices?.map((choice) => (choice.kind === "label" ? choice.text : choice.kind))
  assert.deepEqual(texts(alkyl.represented.R1), ["Me", "Et", "iPr", "tBu", "CF3"])
  assert.deepEqual([alkyl.molecules.length, alkyl.failed], [5, 0])
  assert.deepEqual(alkyl.classesLeftOut, {})

  const smallAryl = enumerate(withClasses({ kind: "class", class: "aryl", min: 6, max: 10, substituted: false }), { representatives: true })
  assert.deepEqual(texts(smallAryl.represented.R1), ["Ph", "1-Naphthyl", "2-Naphthyl"])

  // As in a real claim: heteroaryl, silyl and amino only. Every stand-in must build.
  const claim = enumerate(
    withClasses({ kind: "class", class: "heteroaryl", min: 3, max: 30 }, { kind: "class", class: "silyl" }, { kind: "class", class: "amino" }),
    { representatives: true },
  )
  assert.equal(claim.failed, 0, JSON.stringify(claim.failures))
  assert.equal(claim.molecules.length, 11)
  const formulas = new Set(claim.molecules.map((mol) => plainFormula(mol)))
  assert.ok(formulas.has("C4H9NO"), "amino: NH2 on the ring")
  assert.ok(formulas.has("C4H10OSi"), "silyl: SiH3 on the ring")

  const none = enumerate(withClasses({ kind: "class", class: "heteroaryl", substituted: true }), { representatives: true })
  assert.deepEqual([none.onlyClasses, none.classesLeftOut], [["R1"], { R1: 1 }])
  // Without representatives, classes are left out as before.
  assert.deepEqual(enumerate(withClasses({ kind: "class", class: "alkyl" })).onlyClasses, ["R1"])
})

test("Ar typed on a bonded atom is the aryl placeholder; argon comes from a lone atom or the element tools", () => {
  const typed = run(emptyDrawing(), [
    { op: "add_atom", el: "C", as: "c" },
    { op: "add_atom", el: "C", to: "c", as: "ar" },
    { op: "label", atom: "ar", text: "Ar" },
    { op: "add_atom", el: "C", to: "c", as: "ar1" },
    { op: "label", atom: "ar1", text: "Ar1" },
    { op: "add_atom", el: "C", to: "c", as: "prime" },
    { op: "label", atom: "prime", text: "Ar'" },
    { op: "add_atom", el: "C", to: "c", as: "picked" },
    { op: "set_element", atom: "picked", el: "Ar" },
    { op: "add_atom", el: "C", as: "lone" },
    { op: "label", atom: "lone", text: "Ar" },
  ])
  const atoms = typed.molecule.atoms.map((atom) => [atom.el, atom.alias ?? null])
  assert.deepEqual(atoms, [["C", null], ["C", "Ar"], ["C", "Ar1"], ["C", "Ar'"], ["Ar", null], ["Ar", null]])
  assert.deepEqual(undefinedVariables(typed).sort(), ["Ar", "Ar'", "Ar1"])
  const molfile = toMolfile(typed.molecule)
  assert.match(molfile, /^A {2}\s*2\nAr$/m, "Ar is exported as an alias")
})

test("OH, NH2, SH, HO and H2N are the element with its hydrogens, not placeholders", () => {
  for (const name of ["OH", "NH2", "SH", "HO", "H2N"]) assert.ok(!isVariableName(name), name)
  const typed = applyOps(emptyDrawing(), [
    { op: "add_atom", el: "C", as: "c" },
    { op: "add_atom", el: "C", to: "c", as: "o" },
    { op: "label", atom: "o", text: "OH" },
    { op: "add_atom", el: "C", to: "c", as: "n" },
    { op: "label", atom: "n", text: "NH2" },
  ])
  assert.ok(typed.ok)
  assert.deepEqual(typed.drawing.molecule.atoms.map((atom) => [atom.el, atom.alias ?? null]), [["C", null], ["O", null], ["N", null]])
  assert.equal(plainFormula(typed.drawing.molecule), "CH5NO")
})

test("a choice that cannot go where its placeholder sits is skipped and reported, never built wrong", () => {
  const cases: Array<[string, Op[], string]> = [
    ["a bond at a branch end", [{ op: "set_variable", name: "R1", alternatives: [label("H"), { kind: "bond" }] }], "R1"],
    ["an arylene at a branch end", [{ op: "set_variable", name: "R1", alternatives: [label("H"), { kind: "class", class: "arylene" }] }], "R1"],
    ["an aryl group inside the ring", [{ op: "set_variable", name: "X", alternatives: [label("O"), { kind: "class", class: "aryl" }] }], "X"],
  ]
  for (const [why, ops, name] of cases) {
    const result = enumerate(run(formula(), ops), { representatives: true })
    assert.ok((result.misfits[name] ?? []).length > 0, `${why}: reported as not fitting`)
    assert.equal(result.failed, 0, why)
    for (const mol of result.molecules) assert.ok(mol.atoms.every((atom) => !atom.alias), `${why}: nothing left as a label`)
  }
  // Nothing at all fits: the variable is reported and nothing is built.
  const none = enumerate(run(formula(), [{ op: "set_variable", name: "X", alternatives: [label("Ph")] }]))
  assert.deepEqual([none.molecules.length, none.onlyClasses], [0, ["X"]])
})

test("a placeholder between two atoms takes an element in place, and none is left behind", () => {
  // R1 (atom 6) carries a methyl, so it links the ring to that methyl: O makes an ether.
  const drawing = run(formula(), [
    { op: "add_atom", el: "C", to: 6 },
    { op: "set_variable", name: "R1", alternatives: [label("O"), label("S")] },
  ])
  const result = enumerate(drawing)
  assert.deepEqual([result.molecules.length, result.failed], [8, 0])
  for (const mol of result.molecules) assert.ok(!mol.atoms.some((atom) => atom.alias), "no placeholder is left")
  assert.ok(result.molecules.some((mol) => plainFormula(mol) === "C5H10O2"), "X = O, R1 = O, R2 = H: a methoxy ether")
})

test("a class's size counts carbons or ring members, as the claim says: C3–C5 heteroaryl takes pyridyl", () => {
  const names = (alternative: Parameters<typeof representativesOf>[0]) => representativesOf(alternative).map((choice) => (choice.kind === "label" ? choice.text : choice.kind))
  // OLED patents count carbons: pyridyl has five, so it is a C3–C5 heteroaryl.
  assert.ok(names({ kind: "class", class: "heteroaryl", min: 3, max: 5, unit: "carbons" }).includes("2-Pyridyl"))
  // Drug patents count ring members: a 5–6 membered heteroaryl is pyridyl, furyl… but not indolyl.
  const membered = names({ kind: "class", class: "heteroaryl", min: 5, max: 6, unit: "members" })
  assert.deepEqual(membered.sort(), ["2-Furyl", "2-Pyridyl", "2-Pyrimidinyl", "2-Thienyl"])
  // Left out, the unit is the class's usual one (ring members for heteroaryl).
  assert.deepEqual(names({ kind: "class", class: "heteroaryl", min: 5, max: 6 }).sort(), membered)
  // A biphenylyl has no single ring size, so a membered aryl range leaves it out.
  assert.ok(!names({ kind: "class", class: "aryl", min: 6, max: 12, unit: "members" }).includes("4-Biphenylyl"))
  assert.match(alternativeProblem({ kind: "class", class: "aryl", unit: "atoms" as never }) ?? "", /neither carbons nor members/)
})
