import { labelFor, type LabelBox } from "@structura/core/draw"
import { angleTo, dist, distToSegment, snapAngle } from "@structura/core/geometry"
import { SNAP_ATOM, atomById, atomIdsOfSelection, bondById, bondLengthAt, nearestAtom } from "@structura/core/molecule"
import type { Atom, HotTarget, Molecule, Point, Selection } from "@structura/core/types"
import type { HoverTarget } from "./types.ts"

// What the pointer is on: the nearest atom or bond, by how far the pointer is from each, within
// one reach that grows and shrinks with the drawing. No kind has a wider net than another, so
// none leaves the next a gap or takes its ground.

/**
 * The share of a bond's length round an atom that is the atom's own, even where its bonds run
 * in; the pointer reaches as far, give or take what REACH allows. A zoomed-out bond keeps the
 * middle of its length to itself.
 */
const SHARE = 0.3
/** The reach in screen pixels, at least and at most, with a mouse and with a finger. */
const REACH = { fine: { least: 8, most: 16 }, coarse: { least: 16, most: 28 } }
/** How much nearer (screen pixels) something must be to take the pointer from what it is on, so a boundary does not flicker. */
const KEEP = 2

/** How the pointer aims: with a finger (it reaches further), and what it is on now (kept on a boundary). */
export type Aim = { coarse?: boolean; keep?: HoverTarget }

/** How far from anything the pointer still takes it, in drawing units. */
export function reachOf(mol: Molecule, zoom: number, coarse = false): number {
  const { least, most } = coarse ? REACH.coarse : REACH.fine
  return Math.min(most, Math.max(least, SHARE * layoutOf(mol).bondLength * zoom)) / zoom
}

/** What hit-testing needs of a molecule beyond itself, worked out once for each: the pointer asks on every move. */
type Layout = { atoms: Map<number, Atom>; boxes: Map<number, LabelBox>; bondLength: number }
const layouts = new WeakMap<Molecule, Layout>()
function layoutOf(mol: Molecule): Layout {
  let layout = layouts.get(mol)
  if (!layout) {
    const boxes = new Map<number, LabelBox>()
    for (const atom of mol.atoms) {
      const label = labelFor(mol, atom, false)
      if (label) boxes.set(atom.id, label.box)
    }
    layout = { atoms: new Map(mol.atoms.map((atom) => [atom.id, atom])), boxes, bondLength: bondLengthAt(mol) }
    layouts.set(mol, layout)
  }
  return layout
}

function boxDistance(box: LabelBox, point: Point): number {
  return Math.hypot(Math.max(box.left - point.x, 0, point.x - box.right), Math.max(box.top - point.y, 0, point.y - box.bottom))
}

/**
 * The atom or bond nearest the pointer, and how near (in drawing units): an atom is as near
 * as its label's box, or its own ground round it (nothing inside them), so it wins over the
 * bonds running into it there. The nearest atom first, then any bond nearer still.
 */
export function nearestTarget(mol: Molecule, point: Point, zoom: number, aim: Aim = {}): { target: HotTarget; distance: number } | null {
  const reach = reachOf(mol, zoom, aim.coarse)
  const { atoms, boxes, bondLength } = layoutOf(mol)
  const own = SHARE * bondLength
  /** How near the pointer is to it (null: out of reach), and how near it counts in the contest. */
  const measure = (target: HotTarget): number | null => {
    if (target.type === "atom") {
      const atom = atoms.get(target.id)
      if (!atom) return null
      const fromBox = boxes.has(atom.id) ? boxDistance(boxes.get(atom.id)!, point) : Infinity
      const fromAtom = dist(atom, point)
      if (Math.min(fromBox, fromAtom) > reach) return null
      return Math.min(fromBox, Math.max(0, fromAtom - own))
    }
    const bond = mol.bonds.find((item) => item.id === target.id)
    const [a, b] = bond ? [atoms.get(bond.a), atoms.get(bond.b)] : []
    if (!a || !b) return null
    const distance = distToSegment(point, a, b)
    return distance <= reach ? distance : null
  }
  let best: { target: HotTarget; distance: number } | null = null
  let nearestAtom = Infinity
  for (const atom of mol.atoms) {
    const box = boxes.get(atom.id)
    const near = Math.min(box ? boxDistance(box, point) : Infinity, dist(atom, point))
    if (near >= nearestAtom || near > reach) continue
    nearestAtom = near
    const target = { type: "atom" as const, id: atom.id }
    best = { target, distance: measure(target)! }
  }
  for (const bond of mol.bonds) {
    const a = atoms.get(bond.a)
    const b = atoms.get(bond.b)
    if (!a || !b) continue
    const distance = distToSegment(point, a, b)
    if (distance <= reach && (!best || distance < best.distance)) best = { target: { type: "bond", id: bond.id }, distance }
  }
  // On a boundary the pointer stays on what it was on, unless the other is clearly nearer.
  if (best && aim.keep && !sameHover(aim.keep, best.target)) {
    const kept = measure(aim.keep)
    if (kept != null && kept <= best.distance + KEEP / zoom) return { target: { type: aim.keep.type, id: aim.keep.id }, distance: kept }
  }
  return best
}

/**
 * The atom or bond under the pointer: what a press acts on, and what the hover marks before
 * it (the same, so what lights up is what a click takes).
 */
export function hitOf(mol: Molecule, point: Point, zoom: number, aim?: Aim): HotTarget | null {
  return nearestTarget(mol, point, zoom, aim)?.target ?? null
}

export function hoverOf(mol: Molecule, point: Point, zoom: number, aim?: Aim): HoverTarget {
  return hitOf(mol, point, zoom, aim)
}

export function sameHover(a: HoverTarget, b: HoverTarget): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.type === b.type && a.id === b.id
}

export function bondEnd(
  origin: Point,
  pointer: Point,
  mol: Molecule,
  ignore: number | null,
  alt: boolean,
  zoom: number,
): Point {
  const near = nearestAtom(mol, pointer, SNAP_ATOM / zoom, ignore ?? undefined)
  if (near) return near
  const raw = angleTo(origin, pointer)
  const angle = alt ? raw : snapAngle(raw)
  const length = bondLengthAt(mol, ignore ?? undefined)
  return { x: origin.x + length * Math.cos(angle), y: origin.y - length * Math.sin(angle) }
}

export type FrameHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate"

export type SelectionFrame = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  center: Point
  ids: number[]
  handles: { kind: FrameHandle; x: number; y: number }[]
}

const FRAME_PAD = 18

export function selectionFrame(mol: Molecule, selection: Selection): SelectionFrame | null {
  const ids = atomIdsOfSelection(mol, selection)
  if (ids.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of ids) {
    const atom = atomById(mol, id)
    if (!atom) continue
    minX = Math.min(minX, atom.x)
    minY = Math.min(minY, atom.y)
    maxX = Math.max(maxX, atom.x)
    maxY = Math.max(maxY, atom.y)
  }
  if (!Number.isFinite(minX)) return null
  minX -= FRAME_PAD
  minY -= FRAME_PAD
  maxX += FRAME_PAD
  maxY += FRAME_PAD
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const handles: SelectionFrame["handles"] = [
    { kind: "nw", x: minX, y: minY },
    { kind: "n", x: cx, y: minY },
    { kind: "ne", x: maxX, y: minY },
    { kind: "e", x: maxX, y: cy },
    { kind: "se", x: maxX, y: maxY },
    { kind: "s", x: cx, y: maxY },
    { kind: "sw", x: minX, y: maxY },
    { kind: "w", x: minX, y: cy },
    { kind: "rotate", x: cx, y: minY - 22 },
  ]
  return { minX, minY, maxX, maxY, center: { x: cx, y: cy }, ids, handles }
}

export function frameAt(frame: SelectionFrame, point: Point, zoom: number): FrameHandle | null {
  const radius = 9 / zoom
  const ordered = [...frame.handles].sort((a, b) => Number(b.kind === "rotate") - Number(a.kind === "rotate"))
  for (const handle of ordered) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= radius) return handle.kind
  }
  return null
}

export function clampScale(value: number): number {
  const sign = value < 0 ? -1 : 1
  return sign * Math.min(6, Math.max(0.2, Math.abs(value)))
}

/** The atoms a drag from `hit` carries: the whole selection when it grabs part of it, else just what it grabbed. */
export function dragIds(
  mol: Molecule,
  selection: Selection,
  hit: HotTarget,
): number[] {
  if (hit.type === "atom") {
    if (selection.atoms.includes(hit.id)) return [...selection.atoms]
    return [hit.id]
  }
  const bond = bondById(mol, hit.id)
  if (!bond) return []
  if (selection.bonds.includes(hit.id) || selection.atoms.includes(bond.a) || selection.atoms.includes(bond.b)) {
    return [...new Set([...selection.atoms, bond.a, bond.b])]
  }
  return [bond.a, bond.b]
}
