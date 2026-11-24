import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { emptyMolecule } from "@structura/core/molecule"
import { createBondAt } from "@structura/core/layout"
import { applyOps, type Op } from "@structura/core/ops"
import type { HotTarget, Molecule, Selection } from "@structura/core/types"
import { hoverKey, type HoverKeyHost } from "@structura/engine"

const SINGLE = { order: 1 as const, stereo: "none" as const }

/** A canvas over this molecule that records what the key did: edits run through applyOps, as the editor runs them. */
function canvas(mol: Molecule, hot: HotTarget, more: Partial<HoverKeyHost> = {}) {
  const seen = { mol, selection: null as Selection | null, remembered: null as HotTarget | null, unpinned: false, label: null as number | null }
  const host: HoverKeyHost = {
    mol,
    hot,
    selection: { atoms: [], bonds: [] },
    pointer: null,
    zoom: 1,
    run: (ops: Op[]) => {
      const result = applyOps({ ...emptyDrawing(), molecule: seen.mol }, ops)
      if (!result.ok) return null
      seen.mol = result.drawing.molecule
      return result
    },
    setSelection: (selection) => (seen.selection = selection),
    remember: (next) => (seen.remembered = next),
    unpin: () => (seen.unpinned = true),
    openLabel: (atom) => ((seen.label = atom), true),
    ...more,
  }
  return { host, seen }
}

const press = (key: string, extra: Partial<{ shiftKey: boolean; metaKey: boolean }> = {}) => ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra })

function ethane() {
  const mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  return { mol, start: mol.atoms[0].id, end: mol.atoms[1].id, bond: mol.bonds[0].id }
}

test("g selects what is under the pointer; Tab its whole molecule and lets the hotspot go; Enter opens the label", () => {
  const start = ethane()
  const onBond = canvas(start.mol, { type: "bond", id: start.bond })
  assert.equal(hoverKey(press("g"), onBond.host), true)
  assert.deepEqual(onBond.seen.selection, { atoms: [], bonds: [start.bond] })
  const onAtom = canvas(start.mol, { type: "atom", id: start.end })
  assert.equal(hoverKey(press("Tab"), onAtom.host), true)
  assert.deepEqual(onAtom.seen.selection?.atoms.toSorted(), [start.start, start.end].toSorted())
  assert.equal(onAtom.seen.unpinned, true)
  assert.equal(hoverKey(press("Enter"), onAtom.host), true)
  assert.equal(onAtom.seen.label, start.end)
})

test("arrows walk the hotspot to the bonded atom that way, but not with a selection or from a bond", () => {
  const start = ethane()
  const walk = canvas(start.mol, { type: "atom", id: start.end })
  assert.equal(hoverKey(press("ArrowLeft"), walk.host), true)
  assert.deepEqual(walk.seen.remembered, { type: "atom", id: start.start })
  const selected = canvas(start.mol, { type: "atom", id: start.end }, { selection: { atoms: [start.start], bonds: [] } })
  assert.equal(hoverKey(press("ArrowLeft"), selected.host), false)
  assert.equal(hoverKey(press("ArrowLeft"), canvas(start.mol, { type: "bond", id: start.bond }).host), false)
})

test("a chemistry key edits and leaves the hotspot on the new tip; ⌘ keys and keys that mean nothing are left alone", () => {
  const start = ethane()
  const grow = canvas(start.mol, { type: "atom", id: start.end })
  assert.equal(hoverKey(press("1"), grow.host), true)
  assert.equal(grow.seen.mol.atoms.length, 3)
  assert.equal(grow.seen.remembered?.type, "atom")
  assert.equal(hoverKey(press("1", { metaKey: true }), canvas(start.mol, { type: "atom", id: start.end }).host), false)
  assert.equal(hoverKey(press("F12"), canvas(start.mol, { type: "atom", id: start.end }).host), false)
})

test("a ring key goes to the pointer's side of the bond, and where there is room when the pointer is on the line", () => {
  const start = ethane()
  const [a, b] = start.mol.atoms
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const ringY = (pointer: { x: number; y: number } | null, zoom = 1) => {
    const it = canvas(start.mol, { type: "bond", id: start.bond }, { pointer, zoom })
    assert.equal(hoverKey(press("a"), it.host), true)
    return it.seen.mol.atoms.reduce((sum, atom) => sum + atom.y, 0) / it.seen.mol.atoms.length - a.y
  }
  assert.ok(ringY({ x: middle.x, y: middle.y - 5 }) < 0)
  assert.ok(ringY({ x: middle.x, y: middle.y + 5 }) > 0)
  // 1.5 drawing units off the line is 3 screen pixels at 200%: past the dead band, so it decides.
  assert.ok(ringY({ x: middle.x, y: middle.y + 1.5 }, 2) > 0)
  // At 100% it is inside the band: the side with room, the same as no pointer at all.
  assert.equal(Math.sign(ringY({ x: middle.x, y: middle.y + 1.5 })), Math.sign(ringY(null)))
})
