import { hydrogenCount } from "@structura/core/formula"
import { atomById, bondOrderSum, componentOf, deleteSelection } from "@structura/core/molecule"
import type { Drawing } from "@structura/core/types"
import type { ChoiceResolver } from "./choices.ts"
import { attach, placements } from "./layouts.ts"
import { displacedAt } from "./positions.ts"
import type { Site } from "./place.ts"

// What a formula's layouts come to, worked out from its attachments instead of by making
// each layout: a repeated attachment on a fused ring can stand for millions of them. An
// attachment with its piece apart from the ring, whose candidates are plain atoms, adds
// to a layout what it adds to every layout it is in: a factor for each copy of its piece,
// and a factor for each placeholder it displaces. Attachments that share candidate atoms
// are counted together, position by position, against the room each atom has.

/** What the layouts of one formula (with its repeat units written out) allow. */
export type UnitCount = {
  /** Combinations over all the layouts that can be made. */
  combinations: number
  /** Layouts left out because a candidate has no room. */
  occupied: number
  /** Variables with a placeholder that has no choice that fits, in some layout that can be made. */
  unfilled: string[]
  /** The candidates with room for a piece: layouts that use no others are the only ones that can be made. */
  usable: Set<number>
  /** Whether the layouts that put these candidates (per attachment) under the pieces have room for them all, without making them. */
  fits: (targets: number[][]) => boolean
  /** Whether `combinations` and `occupied` are bounds (too many positions shared to count them exactly). */
  estimated: boolean
}

/** Most partial results one count may hold at a time, before it gives up being exact. */
const BUDGET = 400_000

/** One group of attachments that share candidates, in the order they are made. */
type Group = {
  slots: Array<{ to: number[]; min: number; max: number }>
  /** For each candidate atom, the last slot that lists it (after which its use no longer matters). */
  last: Map<number, number>
  /** How many pieces each candidate atom can take. */
  room: Map<number, number>
}

type Weights = {
  /** What putting slot's piece on `target` multiplies a layout's combinations by. */
  take: (slot: number, target: number) => number
  /** What leaving `target` without a piece multiplies them by (the placeholder it carries stays). */
  keep: (target: number) => number
}

type Limits = { forbid?: number; force?: { slot: number; target: number } }

type State = { weight: number; used: number[]; count: number }

/**
 * The sum, over every way the group's attachments can be made without a candidate taking
 * more pieces than it has room for, of the product of the weights. Null when it would take
 * more than BUDGET partial results. `limits` leave a candidate out of use, or insist on one.
 */
function total(group: Group, weights: Weights, limits: Limits = {}): number | null {
  const targets = [...group.last.keys()]
  const where = new Map(targets.map((target, index) => [target, index]))
  let states = new Map<string, State>([["", { weight: 1, used: targets.map(() => 0), count: 0 }]])
  for (const [slot, { to, min, max }] of group.slots.entries()) {
    let current = new Map<string, State>()
    for (const state of states.values()) current.set(`${state.used.join(",")}|0`, { ...state, count: 0 })
    for (const target of to) {
      const index = where.get(target)!
      const final = group.last.get(target) === slot
      const next = new Map<string, State>()
      const add = (state: State, taken: boolean) => {
        const used = state.used.slice()
        const now = used[index] + (taken ? 1 : 0)
        let weight = state.weight * (taken ? weights.take(slot, target) : 1)
        if (final && now === 0) weight *= weights.keep(target)
        used[index] = final ? 0 : now
        const count = state.count + (taken ? 1 : 0)
        const key = `${used.join(",")}|${count}`
        const held = next.get(key)
        if (held) held.weight += weight
        else next.set(key, { weight, used, count })
      }
      const forced = limits.force?.slot === slot && limits.force.target === target
      for (const state of current.values()) {
        if (!forced) add(state, false)
        if (state.count < max && state.used[index] < (group.room.get(target) ?? 0) && limits.forbid !== target) add(state, true)
      }
      current = next
      if (current.size > BUDGET) return null
    }
    // Only the ways that made enough pieces go on, the count forgotten.
    states = new Map()
    for (const state of current.values()) {
      if (state.count < min || state.count > max) continue
      const key = state.used.join(",")
      const held = states.get(key)
      if (held) held.weight += state.weight
      else states.set(key, { ...state, count: 0 })
    }
  }
  let sum = 0
  for (const state of states.values()) sum += state.weight
  return sum
}

/** How many pieces an atom can take: bonds it can still make (the placeholders at `removed` bond order making way). */
function roomAt(drawing: Drawing, target: number, removed: number): number {
  const atom = atomById(drawing.molecule, target)!
  if (atom.alias) return 0
  const sum = bondOrderSum(drawing.molecule, target) - removed
  let room = 0
  while (room < 8 && hydrogenCount(atom.el, atom.charge, sum + room).h >= 1) room++
  return room
}

const product = (sites: Site[]) => sites.reduce((result, site) => result * site.choices.length, 1)
const zeroNames = (sites: Site[]) => sites.filter((site) => site.choices.length === 0).map((site) => site.name)

/**
 * Counts the layouts of `drawing` (a formula with its repeat units written out) and their
 * combinations without making them; null when they are not of the plain kind this can
 * count: a piece that holds a candidate, two that share atoms, a placeholder that is
 * both displaced and a candidate. Those are counted layout by layout instead.
 */
export function countUnit(drawing: Drawing, resolver: ChoiceResolver): UnitCount | null {
  const mol = drawing.molecule
  const attachments = drawing.attachments ?? []
  const variables = drawing.variables ?? {}
  const names = new Set(Object.keys(variables))
  if (attachments.some((attachment) => !atomById(mol, attachment.atom) || new Set(attachment.to).size !== attachment.to.length || attachment.to.some((id) => !atomById(mol, id)))) return null
  const pieces = attachments.map((attachment) => componentOf(mol, attachment.atom))
  const carried = new Set(pieces.flat())
  if (carried.size !== pieces.reduce((sum, piece) => sum + piece.length, 0)) return null
  const candidates = new Set(attachments.flatMap((attachment) => attachment.to))
  if ([...candidates].some((id) => carried.has(id))) return null
  // The placeholders each candidate gives up when a piece takes its place.
  const displaced = new Map<number, number[]>()
  for (const target of candidates) {
    const found = displacedAt(mol, target, names).filter((id) => !carried.has(id))
    if (found.length > 0) displaced.set(target, found)
  }
  const gone = new Set([...displaced.values()].flat())
  if ([...gone].some((id) => candidates.has(id))) return null

  const frame = (molecule: Drawing["molecule"]): Drawing => ({ molecule, arrows: [], nextArrowId: drawing.nextArrowId, variables: drawing.variables })
  const room = new Map<number, number>()
  for (const target of candidates) {
    const removed = mol.bonds.filter((bond) => (bond.a === target && gone.has(bond.b)) || (bond.b === target && gone.has(bond.a))).reduce((sum, bond) => sum + bond.order, 0)
    room.set(target, roomAt(drawing, target, removed))
  }

  // Everything that is neither a piece nor a displaced placeholder is in every layout as it is.
  const standing = frame(deleteSelection(mol, { atoms: [...carried, ...gone], bonds: [] }))
  const baseSites = resolver.sitesOf(standing, [], true)
  const withDisplaced = frame(deleteSelection(mol, { atoms: [...carried], bonds: [] }))
  const keepAt = new Map<number, Site[]>()
  for (const site of resolver.sitesOf(withDisplaced, [], true)) {
    if (!gone.has(site.atom)) continue
    const target = [...displaced].find(([, found]) => found.includes(site.atom))![0]
    keepAt.set(target, [...(keepAt.get(target) ?? []), site])
  }

  // What a piece adds where it is put: its placeholders, as they sit once it is bonded there.
  const probes = new Map<string, { sites: Site[]; drawing: Drawing }>()
  for (const [slot, attachment] of attachments.entries()) {
    if (attachment.repeat ? attachment.repeat.max < 1 : false) continue
    if (!pieces[slot].some((id) => names.has(atomById(mol, id)?.alias ?? ""))) continue
    for (const target of attachment.to) {
      if ((room.get(target) ?? 0) < 1) continue
      const others = [...carried].filter((id) => !pieces[slot].includes(id))
      const placed = attach(frame(deleteSelection(mol, { atoms: others, bonds: [] })), attachment.atom, target, displaced.get(target) ?? [], false)
      if (!("drawing" in placed)) return null
      probes.set(`${slot}:${target}`, { drawing: placed.drawing, sites: resolver.sitesOf(placed.drawing, [], true).filter((site) => pieces[slot].includes(site.atom)) })
    }
  }

  // Attachments that share a candidate (even one with no room) are counted together.
  const parent = attachments.map((_, index) => index)
  const root = (index: number): number => (parent[index] === index ? index : (parent[index] = root(parent[index])))
  const owner = new Map<number, number>()
  for (const [slot, attachment] of attachments.entries()) {
    for (const target of attachment.to) {
      const first = owner.get(target)
      if (first == null) owner.set(target, slot)
      else parent[root(slot)] = root(first)
    }
  }
  const groups = new Map<number, number[]>()
  for (const slot of attachments.keys()) groups.set(root(slot), [...(groups.get(root(slot)) ?? []), slot])
  const built = [...groups.values()].map((members) => {
    const group: Group = { slots: [], last: new Map(), room }
    const index = new Map<number, number>()
    for (const [at, slot] of members.entries()) {
      const { to, repeat } = attachments[slot]
      group.slots.push({ to, min: repeat?.min ?? 1, max: repeat?.max ?? 1 })
      index.set(slot, at)
      for (const target of to) group.last.set(target, at)
    }
    return { group, members, index }
  })

  const weigh = (members: number[]): Weights => ({
    take: (at, target) => {
      const probe = probes.get(`${members[at]}:${target}`)
      return probe ? product(probe.sites) : 1
    },
    keep: (target) => product(keepAt.get(target) ?? []),
  })
  const unit: Weights = { take: () => 1, keep: () => 1 }
  let estimated = false
  /** A group's sum, or when it is too big to count exactly, what its attachments come to if each stood alone. */
  const sum = (entry: (typeof built)[number], weights: Weights, limits?: Limits): number => {
    const exact = total(entry.group, weights, limits)
    if (exact != null) return exact
    estimated = true
    return entry.group.slots.reduce((result, slot, at) => {
      const alone: Group = { slots: [slot], last: new Map(slot.to.map((target) => [target, 0])), room }
      return result * (total(alone, { ...weights, take: (_, target) => weights.take(at, target) }, limits?.force?.slot === at ? { force: { slot: 0, target: limits.force.target } } : { forbid: limits?.forbid }) ?? 0)
    }, 1)
  }

  const layouts = Number(attachments.reduce((result, attachment) => result * placements(attachment).size, 1n))
  const counts = built.map((entry) => ({ entry, weighed: sum(entry, weigh(entry.members)), valid: sum(entry, unit) }))
  const valid = counts.reduce((result, { valid }) => result * valid, 1)
  const standingCount = product(baseSites)
  const combinations = valid === 0 ? 0 : counts.reduce((result, { weighed }) => result * weighed, standingCount)
  const unfilled = new Set<string>()
  if (valid > 0) {
    for (const name of zeroNames(baseSites)) unfilled.add(name)
    /** Whether some layout can be made with the given limits on one group. */
    const possible = (entry: (typeof built)[number], limits: Limits) => {
      const others = counts.filter((other) => other.entry !== entry).reduce((result, { valid }) => result * valid, 1)
      return others * sum(entry, unit, limits) > 0
    }
    let leftBare = false
    for (const [target, sites] of keepAt) {
      const entry = built.find(({ group }) => group.last.has(target))!
      if (!possible(entry, { forbid: target })) continue
      leftBare = true
      for (const name of zeroNames(sites)) unfilled.add(name)
    }
    for (const [key, { sites }] of probes) {
      const [slot, target] = key.split(":").map(Number)
      const entry = built.find(({ members }) => members.includes(slot))!
      const names = zeroNames(sites)
      if (names.length > 0 && possible(entry, { force: { slot: entry.index.get(slot)!, target } })) for (const name of names) unfilled.add(name)
    }
    // What a layout that exists would have noted about where the placeholders sit.
    resolver.sitesOf(standing, [], false)
    if (leftBare) resolver.sitesOf(withDisplaced, [], false)
    for (const { drawing: placed } of probes.values()) resolver.sitesOf(placed, [], false)
  }
  const fits = (targets: number[][]) => {
    const used = new Map<number, number>()
    for (const targetsOf of targets) {
      for (const target of targetsOf) {
        const now = (used.get(target) ?? 0) + 1
        if (now > (room.get(target) ?? 0)) return false
        used.set(target, now)
      }
    }
    return true
  }
  return { combinations, occupied: Math.max(0, layouts - valid), unfilled: [...unfilled], usable: new Set([...candidates].filter((target) => (room.get(target) ?? 0) > 0)), fits, estimated }
}
