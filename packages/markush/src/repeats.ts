import { crossingBonds } from "@structura/core/drawing"
import { atomById, deleteSelection, duplicateAtoms } from "@structura/core/molecule"
import type { Bond, Bracket, Drawing, Molecule, Point } from "@structura/core/types"
import { odometer } from "./odometer.ts"
import type { Pick } from "./picks.ts"

// Repeat units [ … ]n written out: the unit k times over, chained head to tail through the
// two bonds that cross its brackets, for each k from the count's min to its max.

/** A repeat bracket that cannot be written out, and why: not exactly two bonds cross it. */
export type RepeatSkip = { name: string; bracket: number; crossing: number }

/** A rigid motion of the page, p ↦ m·p + t, as [a b; c d] and t; `mirror` when it turns the page over. */
type Motion = { a: number; b: number; c: number; d: number; tx: number; ty: number; mirror: boolean }

const apply = (m: Motion, p: Point): Point => ({ x: m.a * p.x + m.b * p.y + m.tx, y: m.c * p.x + m.d * p.y + m.ty })

/** First `first`, then `then`. */
function compose(then: Motion, first: Motion): Motion {
  const t = apply(then, { x: first.tx, y: first.ty })
  return {
    a: then.a * first.a + then.b * first.c,
    b: then.a * first.b + then.b * first.d,
    c: then.c * first.a + then.d * first.c,
    d: then.c * first.b + then.d * first.d,
    tx: t.x,
    ty: t.y,
    mirror: then.mirror !== first.mirror,
  }
}

function invert(m: Motion): Motion {
  const det = m.a * m.d - m.b * m.c
  const a = m.d / det
  const b = -m.b / det
  const c = -m.c / det
  const d = m.a / det
  return { a, b, c, d, tx: -(a * m.tx + b * m.ty), ty: -(c * m.tx + d * m.ty), mirror: m.mirror }
}

const STILL: Motion = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0, mirror: false }

function power(m: Motion, times: number): Motion {
  let result = STILL
  const step = times < 0 ? invert(m) : m
  for (let i = 0; i < Math.abs(times); i++) result = compose(step, result)
  return result
}

/** Turns of less than this between the bond in and the bond out count as a straight run. */
const STRAIGHT = (15 * Math.PI) / 180

/**
 * The motion taking one unit to the next: the bond in (`outer1`–`inner1`) onto the bond
 * out (`inner2`–`outer2`), so the next unit's head sits where the next atom was. When the
 * two bonds run the same way (a para-linked ring, an even chain), a shift; when they zigzag
 * (–[CH2]–, an odd chain), a glide that mirrors each unit, so the chain keeps zigzagging.
 */
function stepOf(outer1: Point, inner1: Point, inner2: Point, outer2: Point): Motion {
  const into = Math.atan2(inner1.y - outer1.y, inner1.x - outer1.x)
  const out = Math.atan2(outer2.y - inner2.y, outer2.x - inner2.x)
  let turn = out - into
  turn = Math.atan2(Math.sin(turn), Math.cos(turn))
  // p ↦ R (p - outer1) + inner2: R a rotation by `turn`, or the reflection taking `into` to `out`.
  const mirror = Math.abs(turn) >= STRAIGHT
  const angle = mirror ? into + out : turn
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const [a, b, c, d] = mirror ? [cos, sin, sin, -cos] : [cos, -sin, sin, cos]
  return { a, b, c, d, tx: inner2.x - (a * outer1.x + b * outer1.y), ty: inner2.y - (c * outer1.x + d * outer1.y), mirror }
}

/** The atoms reached from `from` without going through `blocked`. */
function reachable(mol: Molecule, from: number, blocked: Set<number>): Set<number> {
  const seen = new Set([from])
  const queue = [from]
  while (queue.length > 0) {
    const at = queue.pop()!
    for (const bond of mol.bonds) {
      const other = bond.a === at ? bond.b : bond.b === at ? bond.a : null
      if (other == null || seen.has(other) || blocked.has(other)) continue
      seen.add(other)
      queue.push(other)
    }
  }
  return seen
}

/** Wedges seen in a mirror: up and down swap, so turning the page over keeps each centre as it was. */
const mirrored = (bond: Bond): Bond => (bond.stereo === "up" ? { ...bond, stereo: "down" } : bond.stereo === "down" ? { ...bond, stereo: "up" } : bond)

/** `mol` with the atoms in `ids` moved by `motion` (and the bonds among them mirrored when it mirrors). */
function moved(mol: Molecule, ids: Set<number>, motion: Motion): Molecule {
  return {
    ...mol,
    atoms: mol.atoms.map((atom) => (ids.has(atom.id) ? { ...atom, ...apply(motion, atom) } : atom)),
    bonds: motion.mirror ? mol.bonds.map((bond) => (ids.has(bond.a) && ids.has(bond.b) ? mirrored(bond) : bond)) : mol.bonds,
  }
}

/** `mol` with a bond like `like` (its order, stereo and look) between `a` (in `like.a`'s place) and `b`. */
function bondLike(mol: Molecule, like: Bond, a: number, b: number): Molecule {
  const { id: _old, a: _a, b: _b, ...style } = like
  return { ...mol, bonds: [...mol.bonds, { ...style, id: mol.nextBondId, a, b }], nextBondId: mol.nextBondId + 1 }
}

/** The two bonds through a repeat bracket, as the atoms each joins (inside, outside), or how many cross it when not two. */
function throughBonds(mol: Molecule, bracket: Bracket): { head: { bond: Bond; inner: number; outer: number }; tail: { bond: Bond; inner: number; outer: number } } | number {
  const ids = crossingBonds(mol, bracket.atoms)
  if (ids.length !== 2) return ids.length
  const inside = new Set(bracket.atoms)
  const [head, tail] = ids.map((id) => {
    const bond = mol.bonds.find((item) => item.id === id)!
    return inside.has(bond.a) ? { bond, inner: bond.a, outer: bond.b } : { bond, inner: bond.b, outer: bond.a }
  })
  return { head, tail }
}

/**
 * The molecule with a repeat unit written out `times` times (0: gone, its two neighbours
 * bonded directly): the copies follow on from the unit, each where the next would grow, and
 * what lies beyond the tail moves along with the last of them (unless it is joined round to
 * the head, as in a ring, where it stays). Atoms keep their labels, so a placeholder inside
 * the unit is one more placeholder in each copy.
 */
function writeOut(mol: Molecule, bracket: Bracket, times: number): Molecule {
  const through = throughBonds(mol, bracket)
  if (typeof through === "number" || times === 1) return mol
  const { head, tail } = through
  const at = (id: number) => atomById(mol, id)!
  const step = stepOf(at(head.outer), at(head.inner), at(tail.inner), at(tail.outer))
  const unit = mol.atoms.filter((atom) => bracket.atoms.includes(atom.id)).map((atom) => atom.id)
  const beyond = reachable(mol, tail.outer, new Set(unit))
  const carried = beyond.has(head.outer) ? new Set<number>() : beyond
  let next: Molecule = { ...mol, bonds: mol.bonds.filter((bond) => bond.id !== tail.bond.id) }
  if (times === 0) {
    next = moved(deleteSelection(next, { atoms: unit, bonds: [] }), carried, power(step, -1))
    return bondLike(next, tail.bond, head.outer, tail.outer)
  }
  // The tail bond's own direction, for the bonds between units and on to what follows.
  const ends = (from: number, to: number): [number, number] => (tail.bond.a === tail.inner ? [from, to] : [to, from])
  let last = tail.inner
  for (let copy = 1; copy < times; copy++) {
    const made = duplicateAtoms(next, unit)
    const map = new Map(unit.map((id, index) => [id, made.ids[index]]))
    const motion = power(step, copy)
    const placed = new Map(unit.map((id) => [map.get(id)!, apply(motion, at(id))]))
    const fresh = new Set(made.ids)
    next = {
      ...made.mol,
      atoms: made.mol.atoms.map((atom) => (placed.has(atom.id) ? { ...atom, ...placed.get(atom.id)! } : atom)),
      bonds: motion.mirror ? made.mol.bonds.map((bond) => (fresh.has(bond.a) && fresh.has(bond.b) ? mirrored(bond) : bond)) : made.mol.bonds,
    }
    next = bondLike(next, tail.bond, ...ends(last, map.get(head.inner)!))
    last = map.get(tail.inner)!
  }
  next = moved(next, carried, power(step, times - 1))
  return bondLike(next, tail.bond, ...ends(last, tail.outer))
}

/** The formula's repeat brackets: those of `drawing` wholly on its atoms. */
function repeatBrackets(drawing: Drawing): Bracket[] {
  return (drawing.brackets ?? []).filter((bracket) => bracket.kind === "repeat" && bracket.repeat && bracket.atoms.every((id) => atomById(drawing.molecule, id)))
}

/** The repeat brackets that cannot be written out, with how many bonds cross each. */
export function repeatSkips(drawing: Drawing): RepeatSkip[] {
  return repeatBrackets(drawing).flatMap((bracket) => {
    const through = throughBonds(drawing.molecule, bracket)
    return typeof through === "number" ? [{ name: bracket.repeat!.name, bracket: bracket.id, crossing: through }] : []
  })
}

/**
 * Every way of counting the formula's repeat units, each repeat bracket on its own from its
 * min to its max: the formula with the units written out (those brackets gone) and the
 * counts as picks ("n" = 3). A bracket that cannot be written out (see repeatSkips) stays
 * as drawn. With no repeat brackets, the formula itself.
 */
export function* repeatVariants(drawing: Drawing): Generator<{ drawing: Drawing; where: Pick[] }> {
  const brackets = repeatBrackets(drawing).filter((bracket) => typeof throughBonds(drawing.molecule, bracket) !== "number")
  if (brackets.length === 0) return yield { drawing, where: [] }
  const counts = brackets.map((bracket) => Array.from({ length: bracket.repeat!.max - bracket.repeat!.min + 1 }, (_, index) => bracket.repeat!.min + index))
  const gone = new Set(brackets.map((bracket) => bracket.id))
  const rest = (drawing.brackets ?? []).filter((bracket) => !gone.has(bracket.id))
  for (const choice of odometer(counts.map((list) => list.length))) {
    let mol = drawing.molecule
    const where: Pick[] = []
    for (const [index, bracket] of brackets.entries()) {
      const times = counts[index][choice[index]]
      // An earlier unit written out no times may have taken this one's atoms with it.
      if (bracket.atoms.every((id) => atomById(mol, id))) mol = writeOut(mol, bracket, times)
      where.push({ name: bracket.repeat!.name, count: times })
    }
    const kept = rest.filter((bracket) => bracket.atoms.every((id) => atomById(mol, id)))
    const { brackets: _all, ...plain } = drawing
    yield { drawing: { ...plain, molecule: mol, ...(kept.length > 0 ? { brackets: kept } : {}) }, where }
  }
}
