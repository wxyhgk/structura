import type { Molecule } from "../types.ts"
import { cloneMolecule } from "./graph.ts"
import { bondLengthAt } from "./measure.ts"
import { relax } from "./relax.ts"

// Groups drawn out where a template first put them (a compound table showing Bn, Mes… in
// full) can land on each other or on the rest of the molecule. untangleGroups moves only
// those groups until nothing overlaps: first by flipping and swinging each one whole, which
// keeps every bond length, then, for what that leaves, by relax().

/** Atoms closer than this, in bond lengths, overlap (bonded atoms and 1-3 pairs aside). */
const TOO_CLOSE = 0.5
/** How far relax() may stretch or squeeze a bond, as a fraction of a bond, to clear an overlap. */
const STRETCH = 0.2
/** Swings tried about the atom a group hangs from, in degrees. */
const SWINGS = [20, -20, 40, -40, 60, -60]

type Layout = {
  ids: number[]
  x: Float64Array
  y: Float64Array
  /** Bonds as atom index pairs. */
  bonds: Array<[number, number]>
  /** i * n + j for bonded pairs, both ways. */
  bonded: Set<number>
  /** i * n + j for pairs with a common neighbour, both ways. */
  near: Set<number>
  /** Atoms that may move: the score only counts pairs and crossings touching them. */
  moving: Uint8Array
}

function layoutOf(mol: Molecule, moving: Set<number>): Layout {
  const ids = mol.atoms.map((atom) => atom.id)
  const n = ids.length
  const index = new Map(ids.map((id, at) => [id, at]))
  const bonds: Array<[number, number]> = []
  const around: number[][] = ids.map(() => [])
  const bonded = new Set<number>()
  for (const bond of mol.bonds) {
    const a = index.get(bond.a)
    const b = index.get(bond.b)
    if (a == null || b == null) continue
    bonds.push([a, b])
    around[a].push(b)
    around[b].push(a)
    bonded.add(a * n + b).add(b * n + a)
  }
  const near = new Set<number>()
  for (const list of around) for (const a of list) for (const b of list) if (a !== b) near.add(a * n + b)
  return {
    ids,
    x: Float64Array.from(mol.atoms, (atom) => atom.x),
    y: Float64Array.from(mol.atoms, (atom) => atom.y),
    bonds,
    bonded,
    near,
    moving: Uint8Array.from(ids, (id) => (moving.has(id) ? 1 : 0)),
  }
}

function crosses(l: Layout, [a, b]: [number, number], [c, d]: [number, number]): boolean {
  if (a === c || a === d || b === c || b === d) return false
  const side = (p: number, q: number, r: number) => (l.x[r] - l.x[p]) * (l.y[q] - l.y[p]) - (l.y[r] - l.y[p]) * (l.x[q] - l.x[p])
  return side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0
}

/**
 * How badly the moving atoms are placed, as smilesDrawer scores it (getOverlapScore): for
 * each pair not bonded and nearer than a bond, how much nearer; plus one per crossing.
 * `defects` counts what a reader would see: pairs too close and crossing bonds.
 */
function assess(l: Layout, bond: number): { score: number; defects: number } {
  const n = l.ids.length
  let score = 0
  let defects = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!l.moving[i] && !l.moving[j]) continue
      if (l.bonded.has(i * n + j)) continue
      const d = Math.hypot(l.x[i] - l.x[j], l.y[i] - l.y[j])
      if (d < bond) score += (bond - d) / bond
      if (d < TOO_CLOSE * bond && !l.near.has(i * n + j)) defects++
    }
  }
  for (let i = 0; i < l.bonds.length; i++) {
    const [a, b] = l.bonds[i]
    for (let j = i + 1; j < l.bonds.length; j++) {
      const [c, d] = l.bonds[j]
      if (!l.moving[a] && !l.moving[b] && !l.moving[c] && !l.moving[d]) continue
      if (!crosses(l, l.bonds[i], l.bonds[j])) continue
      score += 1
      defects++
    }
  }
  return { score, defects }
}

/** A group that hangs from one atom outside it: its members and that atom, as indices. */
type Hanging = { members: number[]; anchor: number; pivot: number; mirrored: boolean }

function hanging(l: Layout, atoms: number[]): Hanging | null {
  const index = new Map(l.ids.map((id, at) => [id, at]))
  const members = atoms.flatMap((id) => (index.has(id) ? [index.get(id)!] : []))
  const inside = new Set(members)
  const leaving = l.bonds.filter(([a, b]) => inside.has(a) !== inside.has(b))
  if (leaving.length !== 1) return null
  const [a, b] = leaving[0]
  return inside.has(a) ? { members, anchor: a, pivot: b, mirrored: false } : { members, anchor: b, pivot: a, mirrored: false }
}

/** Turns the members about the pivot by `angle`, after mirroring them in the pivot–anchor line if asked. */
function place(l: Layout, from: { x: Float64Array; y: Float64Array }, group: Hanging, mirror: boolean, angle: number) {
  const px = l.x[group.pivot]
  const py = l.y[group.pivot]
  const ax = from.x[group.anchor] - px
  const ay = from.y[group.anchor] - py
  const length = Math.hypot(ax, ay) || 1
  const ux = ax / length
  const uy = ay / length
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (const at of group.members) {
    let dx = from.x[at] - px
    let dy = from.y[at] - py
    if (mirror) {
      const along = dx * ux + dy * uy
      dx = 2 * along * ux - dx
      dy = 2 * along * uy - dy
    }
    l.x[at] = px + dx * cos - dy * sin
    l.y[at] = py + dx * sin + dy * cos
  }
}

/**
 * Moves each group to its best pose among flips and swings about the atom it hangs from,
 * smilesDrawer's way (rotate a subtree, keep it if the overlap score drops). Rigid, so no
 * bond changes length. Returns whether anything moved.
 */
function swingGroups(l: Layout, groups: Hanging[], bond: number): boolean {
  let moved = false
  for (let pass = 0; pass < 2; pass++) {
    let improved = false
    for (const group of groups) {
      const start = { x: Float64Array.from(l.x), y: Float64Array.from(l.y) }
      let best = { score: assess(l, bond).score, mirror: false, angle: 0 }
      for (const mirror of [false, true]) {
        for (const degrees of [0, ...SWINGS]) {
          if (!mirror && degrees === 0) continue
          const angle = (degrees * Math.PI) / 180
          place(l, start, group, mirror, angle)
          const { score } = assess(l, bond)
          if (score < best.score - 1e-6) best = { score, mirror, angle }
        }
      }
      place(l, start, group, best.mirror, best.angle)
      if (best.mirror || best.angle !== 0) {
        improved = true
        if (best.mirror) group.mirrored = !group.mirrored
      }
    }
    if (!improved) break
    moved = true
  }
  return moved
}

function moleculeAt(mol: Molecule, l: Layout, groups: Hanging[]): Molecule {
  const next = cloneMolecule(mol)
  next.atoms.forEach((atom, at) => {
    atom.x = l.x[at]
    atom.y = l.y[at]
  })
  // A mirrored group is turned over: its wedges and hashes swap so they keep their meaning.
  const flipped = new Set(groups.filter((group) => group.mirrored).flatMap((group) => group.members.map((at) => l.ids[at])))
  for (const bond of next.bonds) {
    if (!flipped.has(bond.a)) continue
    if (bond.stereo === "up") bond.stereo = "down"
    else if (bond.stereo === "down") bond.stereo = "up"
  }
  return next
}

/** The bond touching a moving atom furthest from `bond` in length, as a fraction of it. */
function worstStretch(l: Layout, bond: number): number {
  let worst = 0
  for (const [a, b] of l.bonds) {
    if (!l.moving[a] && !l.moving[b]) continue
    worst = Math.max(worst, Math.abs(Math.hypot(l.x[a] - l.x[b], l.y[a] - l.y[b]) - bond) / bond)
  }
  return worst
}

/**
 * The molecule with the given groups (drawn out, each moving whole) cleared of each other
 * and of the rest, or as it was when nothing overlaps. Nothing outside the groups moves.
 * Flipping and swinging come first since they keep every bond length; relax() only gets
 * what they leave, and its result is kept only when it overlaps less without stretching a
 * bond past STRETCH (relax moves groups whole, so the bonds they hang by give).
 */
export function untangleGroups(mol: Molecule, groupIds: Iterable<number>): Molecule {
  const chosen = new Set(groupIds)
  const groups = mol.groups.filter((group) => chosen.has(group.id))
  const moving = new Set(groups.flatMap((group) => group.atoms))
  if (moving.size === 0) return mol
  const bond = bondLengthAt(mol)
  const layout = layoutOf(mol, moving)
  if (assess(layout, bond).defects === 0) return mol

  const swinging = groups.flatMap((group) => hanging(layout, group.atoms) ?? [])
  const swung = swingGroups(layout, swinging, bond) ? moleculeAt(mol, layout, swinging) : mol
  const left = assess(layout, bond).defects
  if (left === 0) return swung

  const relaxed = relax(swung, { atoms: moving })
  const after = layoutOf(relaxed, moving)
  const fewer = assess(after, bond).defects < left
  const stretched = worstStretch(after, bond) > Math.max(STRETCH, worstStretch(layout, bond))
  return fewer && !stretched ? relaxed : swung
}
