import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import type { Molecule } from "@structura/core/types"
import { fragmentEnds } from "@structura/markush"
import { run } from "@structura/testkit"
import { pickSite, sitesOf, sitesProblem, sitesShown, sketchedPiece } from "@structura/engine"

/** What is drawn in the sketch pad: a methoxy, O (atom 1) then C (atom 2). */
const methoxy = (): Molecule =>
  run(emptyDrawing(), [
    { op: "place_atom", el: "O", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
  ]).molecule

/** The elements of the atoms the piece's "*" atoms sit on, in "*" order. */
const heads = (piece: Molecule) => fragmentEnds(piece).map((end) => piece.atoms.find((atom) => atom.id === end.head)?.el)

test("a group with no site set joins by its first atom drawn, shown as the default", () => {
  const mol = methoxy()
  assert.deepEqual(sitesShown(mol, [], "end"), { sites: [1], assumed: true })
  const result = sketchedPiece(mol, [], "end")
  assert.ok("piece" in result)
  assert.deepEqual(heads(result.piece), ["O"])
})

test("a group's site moves with one click, and a click on it takes it back to the default", () => {
  const sites = pickSite([], 2, "end")
  assert.deepEqual(sites, [2])
  const result = sketchedPiece(methoxy(), sites, "end")
  assert.ok("piece" in result)
  assert.deepEqual(heads(result.piece), ["C"])
  assert.deepEqual(pickSite(sites, 2, "end"), [])
})

test("a linker takes two sites on different atoms, the third click replacing the oldest", () => {
  const mol = methoxy()
  assert.match(sitesProblem(mol, [], "link") ?? "", /两个位点/)
  let sites = pickSite([], 1, "link")
  assert.match(sitesProblem(mol, sites, "link") ?? "", /还差一个/)
  sites = pickSite(sites, 2, "link")
  assert.equal(sitesProblem(mol, sites, "link"), null)
  const result = sketchedPiece(mol, sites, "link")
  assert.ok("piece" in result)
  assert.deepEqual(heads(result.piece), ["O", "C"])
  assert.deepEqual(pickSite(sites, 1, "link"), [2], "clicking a site takes it away")
})

test("a ring atom's site is one atom bonded twice", () => {
  const mol = run(emptyDrawing(), [{ op: "place_atom", el: "N", at: { x: 0, y: 0 } }]).molecule
  assert.ok(sitesProblem(mol, [], "ring"))
  const sites = pickSite([], 1, "ring")
  assert.deepEqual(sites, [1, 1])
  const result = sketchedPiece(mol, sites, "ring")
  assert.ok("piece" in result, "problem" in result ? result.problem : "")
  assert.deepEqual(heads(result.piece), ["N", "N"])
})

test("a site whose atom was erased is gone", () => {
  const mol = methoxy()
  const erased = run({ ...emptyDrawing(), molecule: mol }, [{ op: "remove", atoms: [2] }]).molecule
  assert.deepEqual(sitesShown(erased, [2], "end"), { sites: [1], assumed: true })
})

test("a saved piece opens in the pad with its sites, and saves back the same", () => {
  const first = sketchedPiece(methoxy(), [2], "end")
  assert.ok("piece" in first)
  const opened = sitesOf(first.piece)
  assert.equal(opened.mol.atoms.length, 2, "the * atoms are taken off")
  assert.equal(opened.mol.atoms.find((atom) => atom.id === opened.sites[0])?.el, "C")
  const again = sketchedPiece(opened.mol, opened.sites, "end")
  assert.ok("piece" in again)
  assert.deepEqual(heads(again.piece), ["C"])
})

test("an empty pad says so", () => {
  assert.ok("problem" in sketchedPiece(emptyDrawing().molecule, [], "end"))
})
