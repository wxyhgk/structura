import { useState, type RefObject } from "react"
import { atomById, bondById } from "@structura/core/molecule"
import type { Scaffold } from "@structura/core/scaffolds"
import type { Molecule, Point } from "@structura/core/types"
import { defaultPick, scaffoldOps, type HoverTarget, type Run, type Viewport } from "@structura/engine"
import type { useHotspot } from "./useHotspot.ts"

/** The quick template field `/` opened: what it acts on (fixed when it opened) and where it shows. */
export type QuickField = { target: HoverTarget; world: Point; screen: Point }

/** The quick template field by the pointer: opening it, and placing the template picked. */
export function useQuickScaffold({
  current,
  hotspot,
  viewport,
  lastPointer,
  run,
}: {
  current: () => Molecule
  hotspot: ReturnType<typeof useHotspot>
  viewport: Viewport
  /** Where the pointer last was over the canvas, in client coordinates. */
  lastPointer: RefObject<{ x: number; y: number } | null>
  run: Run
}) {
  const [quick, setQuick] = useState<QuickField | null>(null)

  function open() {
    // What it will act on is fixed now: the pointer's atom or bond, else the hotspot, else
    // the spot under the pointer, so moving the pointer while typing changes nothing.
    const mol = current()
    const target = hotspot.under() ?? hotspot.active(mol)
    const { zoom: scale, pan: shift } = viewport.get()
    const client = lastPointer.current
    const world = client ? viewport.toWorld(client.x, client.y) : viewport.centre()
    const anchor = target?.type === "atom" ? atomById(mol, target.id) : target?.type === "bond" ? bondMiddle(mol, target.id) : world
    if (target?.type === "atom") hotspot.pin(target.id)
    setQuick({ target, world, screen: { x: shift.x + (anchor ?? world).x * scale, y: shift.y + (anchor ?? world).y * scale } })
  }

  function pick(scaffold: Scaffold) {
    const was = quick
    setQuick(null)
    if (was) run(scaffoldOps(defaultPick(scaffold.name), was.target, was.world))
  }

  return { quick, open, cancel: () => setQuick(null), pick }
}

/** The middle of a bond, where the quick template field shows when it will fuse there. */
function bondMiddle(mol: Molecule, id: number): Point | undefined {
  const bond = bondById(mol, id)
  const [a, b] = bond ? [atomById(mol, bond.a), atomById(mol, bond.b)] : []
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : undefined
}
