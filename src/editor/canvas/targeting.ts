import { ATOM_HIT, BOND_HIT, HOVER_ATOM, HOVER_BOND, SNAP_ATOM } from "@/chem/constants"
import { angleTo, snapAngle } from "@/chem/geometry"
import { atomById, atomIdsOfSelection, bondLengthAt, nearestAtom, nearestBond } from "@/chem/molecule"
import type { Molecule, Point, Selection } from "@/chem/types"
import type { HoverTarget } from "./types.ts"

export function hitOf(mol: Molecule, point: Point, zoom: number) {
  const atom = nearestAtom(mol, point, ATOM_HIT / zoom)
  if (atom) return { type: "atom" as const, id: atom.id }
  const bond = nearestBond(mol, point, BOND_HIT / zoom)
  if (bond) return { type: "bond" as const, id: bond.id }
  return null
}

export function hoverOf(mol: Molecule, point: Point, zoom: number): HoverTarget {
  const atom = nearestAtom(mol, point, HOVER_ATOM / zoom)
  if (atom) return { type: "atom", id: atom.id }
  const bond = nearestBond(mol, point, HOVER_BOND / zoom)
  if (bond) return { type: "bond", id: bond.id }
  return null
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

export function handleCursor(kind: FrameHandle): string {
  if (kind === "rotate") return "grab"
  if (kind === "n" || kind === "s") return "ns-resize"
  if (kind === "e" || kind === "w") return "ew-resize"
  if (kind === "ne" || kind === "sw") return "nesw-resize"
  return "nwse-resize"
}

export function clampScale(value: number): number {
  const sign = value < 0 ? -1 : 1
  return sign * Math.min(6, Math.max(0.2, Math.abs(value)))
}
