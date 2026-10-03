import assert from "node:assert/strict"
import test from "node:test"
import { hotkeyOps } from "../../src/editor/hotkeys/lookup.ts"
import { stepPictures } from "../../src/guide/figures/marks.ts"
import * as drawing from "../../src/guide/tutorials/drawing.ts"
import * as markush from "../../src/guide/tutorials/markush.ts"
import type { GuideContext } from "../../src/guide/types.ts"

const context: GuideContext = { mod: "⌘", pressKey: (mol, atom, key) => hotkeyOps(mol, { type: "atom", id: atom }, key), openShortcuts: () => {} }
const tutorials = { ...drawing, ...markush }

test("every tutorial plays through the editor's own ops and keys, its marks on atoms that are there", () => {
  for (const [name, make] of Object.entries(tutorials)) {
    const steps = make(context)
    assert.ok(steps.length >= 4, `${name} has steps`)
    for (const [index, step] of steps.entries()) {
      const ids = new Set(step.drawing.molecule.atoms.map((atom) => atom.id))
      const atoms = (step.marks ?? []).flatMap((mark) =>
        mark.kind === "select" ? mark.atoms : "atom" in mark ? [mark.atom] : mark.kind === "click" && typeof mark.at === "number" ? [mark.at] : mark.kind === "drag" && typeof mark.from === "number" ? [mark.from] : [],
      )
      for (const atom of atoms) assert.ok(ids.has(atom), `${name} step ${index + 1}: atom #${atom} is marked but not drawn`)
      assert.ok(step.text.length > 4, `${name} step ${index + 1} says what to do`)
    }
    assert.equal(make(context), steps, `${name} is built once`)
  }
})

test("a tutorial's steps share one frame, so the drawing does not jump between steps", () => {
  for (const [name, make] of Object.entries(tutorials)) {
    const pictures = stepPictures(make(context))
    const frames = new Set(pictures.map((svg) => /viewBox="([^"]+)"/.exec(svg)?.[1]))
    assert.equal(frames.size, 1, name)
  }
})

test("the first molecule really is 4-ethyltoluene, built by hover keys", async () => {
  const { plainFormula } = await import("@structura/core/formula")
  const steps = drawing.firstMolecule(context)
  assert.equal(plainFormula(steps.at(-1)!.drawing.molecule), "C9H12")
  assert.equal(plainFormula(markush.drawnPiece(context).at(-1)!.drawing.molecule), "C11H15N")
})
