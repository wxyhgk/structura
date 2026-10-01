import type { Molecule, Point } from "../types.ts"
import { atomById, cloneMolecule } from "./graph.ts"

// Rigid moves of a set of atoms: shift, rotate, scale, mirror, and tilting out of the page.

export function moveAtoms(mol: Molecule, ids: number[], dx: number, dy: number): Molecule {
  if (dx === 0 && dy === 0) return mol
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.x += dx
    atom.y += dy
  }
  return next
}

export function centroidOf(mol: Molecule, ids: number[]): Point | null {
  const atoms = ids.flatMap((id) => {
    const atom = atomById(mol, id)
    return atom ? [atom] : []
  })
  if (atoms.length === 0) return null
  return {
    x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length,
    y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length,
  }
}

export function boundsCenter(mol: Molecule, ids: number[]): Point | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let count = 0
  for (const id of ids) {
    const atom = atomById(mol, id)
    if (!atom) continue
    count += 1
    minX = Math.min(minX, atom.x)
    minY = Math.min(minY, atom.y)
    maxX = Math.max(maxX, atom.x)
    maxY = Math.max(maxY, atom.y)
  }
  if (count === 0) return null
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

export function scaleAtoms(mol: Molecule, ids: number[], center: Point, sx: number, sy: number): Molecule {
  if (ids.length === 0 || (sx === 1 && sy === 1)) return mol
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.x = center.x + (atom.x - center.x) * sx
    atom.y = center.y + (atom.y - center.y) * sy
  }
  if ((sx < 0) !== (sy < 0)) {
    for (const bond of next.bonds) {
      if (!wanted.has(bond.a) || !wanted.has(bond.b)) continue
      if (bond.stereo === "up") bond.stereo = "down"
      else if (bond.stereo === "down") bond.stereo = "up"
    }
  }
  return next
}

export function rotateAtoms(mol: Molecule, ids: number[], center: Point, angle: number): Molecule {
  if (angle === 0 || ids.length === 0) return mol
  const wanted = new Set(ids)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    const dx = atom.x - center.x
    const dyUp = -(atom.y - center.y)
    const rx = dx * cos - dyUp * sin
    const ry = dx * sin + dyUp * cos
    atom.x = center.x + rx
    atom.y = center.y - ry
  }
  return next
}

export function flipAtoms(mol: Molecule, ids: number[], axis: "horizontal" | "vertical"): Molecule {
  const center = centroidOf(mol, ids)
  if (!center || ids.length === 0) return mol
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    if (axis === "horizontal") atom.x = center.x * 2 - atom.x
    else atom.y = center.y * 2 - atom.y
  }
  for (const bond of next.bonds) {
    if (!wanted.has(bond.a) || !wanted.has(bond.b)) continue
    if (bond.stereo === "up") bond.stereo = "down"
    else if (bond.stereo === "down") bond.stereo = "up"
  }
  return next
}

/**
 * Rotates atoms out of the page and projects them back. The depth each atom gains is
 * returned separately: it only matters to the next tumble, so the editor keeps it
 * next to the molecule instead of storing it on the atoms.
 */
export function tumbleAtoms(
  mol: Molecule,
  ids: number[],
  center: Point,
  axis: "x" | "y",
  angle: number,
  depth: ReadonlyMap<number, number> = new Map(),
): { mol: Molecule; depth: Map<number, number> } {
  const nextDepth = new Map(depth)
  if (angle === 0 || ids.length === 0) return { mol, depth: nextDepth }
  const wanted = new Set(ids)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    const z = depth.get(atom.id) ?? 0
    if (axis === "x") {
      const yUp = -(atom.y - center.y)
      const yNext = yUp * cos - z * sin
      nextDepth.set(atom.id, yUp * sin + z * cos)
      atom.y = center.y - yNext
    } else {
      const x = atom.x - center.x
      atom.x = center.x + x * cos - z * sin
      nextDepth.set(atom.id, x * sin + z * cos)
    }
  }
  return { mol: next, depth: nextDepth }
}
