import { BOND_LENGTH } from "../constants.ts"
import type { Molecule, Point } from "../types.ts"
import type { ScaffoldSpec } from "./catalog.ts"

/**
 * A scaffold ready to use: its molecule (ids 1, 2… in numbering order, centred on the
 * origin), the atom of each locant, and the two atoms of each lettered peripheral bond.
 */
export type Scaffold = {
  name: string
  zh: string
  group: ScaffoldSpec["group"]
  molecule: Molecule
  /** Locant → atom id: "C3" → 3, "N9" → 12. */
  atoms: Record<string, number>
  /** Peripheral bond letter → its atoms: "a" → [C1, C2], in numbering order. */
  edges: Record<string, [number, number]>
}

/** "C4a" → C; the element is the locant's capital letter and any lower-case one after it. */
const elementOf = (locant: string) => /^[A-Z][a-z]?(?=\d)/.exec(locant)?.[0] ?? "C"

/** "C4a" → [4, "a"], for ordering locants the way numbering runs. */
function locantKey(locant: string): [number, string] {
  const match = /(\d+)([a-z]?)$/.exec(locant)
  return match ? [Number(match[1]), match[2]] : [0, ""]
}

const byNumbering = (a: string, b: string) => {
  const [na, la] = locantKey(a)
  const [nb, lb] = locantKey(b)
  return na - nb || la.localeCompare(lb)
}

/**
 * Lays the rings out as regular polygons, the first round the origin, each later one fused
 * on the bond it shares with those already placed, on the side away from them.
 */
function layOut(rings: string[][]): Map<string, Point> {
  const at = new Map<string, Point>()
  const first = rings[0]
  const radius = BOND_LENGTH / (2 * Math.sin(Math.PI / first.length))
  first.forEach((locant, index) => {
    const angle = Math.PI / 2 + (2 * Math.PI * index) / first.length
    at.set(locant, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) })
  })
  for (const ring of rings.slice(1)) {
    const n = ring.length
    const shared = ring.findIndex((locant, index) => at.has(locant) && at.has(ring[(index + 1) % n]))
    if (shared < 0) throw new Error(`scaffold ring ${ring.join(",")} shares no bond with the rings before it`)
    const [p, q] = [at.get(ring[shared])!, at.get(ring[(shared + 1) % n])!]
    // The side away from the placed atoms next to that bond.
    const placed = [...at.values()]
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    const centroid = { x: placed.reduce((sum, point) => sum + point.x, 0) / placed.length, y: placed.reduce((sum, point) => sum + point.y, 0) / placed.length }
    let normal = { x: -(q.y - p.y), y: q.x - p.x }
    if (normal.x * (centroid.x - mid.x) + normal.y * (centroid.y - mid.y) > 0) normal = { x: -normal.x, y: -normal.y }
    const length = Math.hypot(normal.x, normal.y)
    const apothem = BOND_LENGTH / (2 * Math.tan(Math.PI / n))
    const centre = { x: mid.x + (normal.x / length) * apothem, y: mid.y + (normal.y / length) * apothem }
    const r = BOND_LENGTH / (2 * Math.sin(Math.PI / n))
    const start = Math.atan2(p.y - centre.y, p.x - centre.x)
    // Step round so the next atom in the list lands on q.
    const step = (2 * Math.PI) / n
    const lands = (sign: number) => Math.hypot(centre.x + r * Math.cos(start + sign * step) - q.x, centre.y + r * Math.sin(start + sign * step) - q.y)
    const sign = lands(1) < lands(-1) ? 1 : -1
    for (let m = 0; m < n; m++) {
      const locant = ring[(shared + m) % n]
      if (!at.has(locant)) at.set(locant, { x: centre.x + r * Math.cos(start + sign * m * step), y: centre.y + r * Math.sin(start + sign * m * step) })
    }
  }
  return at
}

/**
 * Turns the layout the way such systems are drawn: lying wide rather than tall, and with
 * its heteroatoms (the N–H of carbazole, the O of dibenzofuran) at the bottom.
 */
function orient(at: Map<string, Point>): Map<string, Point> {
  const points = [...at.entries()]
  const spread = (angle: number) => {
    const xs = points.map(([, point]) => point.x * Math.cos(angle) - point.y * Math.sin(angle))
    const ys = points.map(([, point]) => point.x * Math.sin(angle) + point.y * Math.cos(angle))
    return Math.max(...xs) - Math.min(...xs) - (Math.max(...ys) - Math.min(...ys))
  }
  let best = 0
  for (let degrees = 0; degrees < 180; degrees += 15) if (spread((degrees * Math.PI) / 180) > spread(best) + 1e-6) best = (degrees * Math.PI) / 180
  let turned = points.map(([locant, point]) => [locant, { x: point.x * Math.cos(best) - point.y * Math.sin(best), y: point.x * Math.sin(best) + point.y * Math.cos(best) }] as const)
  const xs = turned.map(([, point]) => point.x)
  const ys = turned.map(([, point]) => point.y)
  const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  turned = turned.map(([locant, point]) => [locant, { x: point.x - centre.x, y: point.y - centre.y }] as const)
  const hetero = turned.filter(([locant]) => elementOf(locant) !== "C")
  // Screen y grows downward: heteroatoms belong where y is large.
  if (hetero.length > 0 && hetero.reduce((sum, [, point]) => sum + point.y, 0) < 0) turned = turned.map(([locant, point]) => [locant, { x: point.x, y: -point.y }] as const)
  return new Map(turned.map(([locant, point]) => [locant, { x: Math.round(point.x * 100) / 100 || 0, y: Math.round(point.y * 100) / 100 || 0 }]))
}

export function buildScaffold(spec: ScaffoldSpec): Scaffold {
  const at = orient(layOut(spec.rings))
  const order = spec.order ?? [...at.keys()].sort(byNumbering)
  const atoms = Object.fromEntries(order.map((locant, index) => [locant, index + 1]))
  const key = (a: string, b: string) => [a, b].sort().join("~")
  const doubles = new Set(spec.doubles.map(([a, b]) => key(a, b)))
  const aromaticRings = new Set(spec.aromatic ?? spec.rings.map((_, index) => index))
  const bonds = new Map<string, { a: string; b: string; aromatic: boolean }>()
  spec.rings.forEach((ring, index) => {
    ring.forEach((locant, position) => {
      const next = ring[(position + 1) % ring.length]
      const known = bonds.get(key(locant, next))
      bonds.set(key(locant, next), { a: locant, b: next, aromatic: (known?.aromatic ?? false) || aromaticRings.has(index) })
    })
  })
  const molecule: Molecule = {
    atoms: order.map((locant) => ({ id: atoms[locant], el: elementOf(locant), x: at.get(locant)!.x, y: at.get(locant)!.y, charge: 0 })),
    bonds: [...bonds.entries()].map(([pair, bond], index) => ({
      id: index + 1,
      a: atoms[bond.a],
      b: atoms[bond.b],
      order: doubles.has(pair) ? 2 : 1,
      stereo: "none" as const,
      ...(bond.aromatic ? { aromatic: true } : {}),
    })),
    groups: [],
    nextAtomId: order.length + 1,
    nextBondId: bonds.size + 1,
    nextGroupId: 1,
  }
  // The outside, in numbering order: each step between bonded atoms is the next letter.
  const edges: Record<string, [number, number]> = {}
  let letter = 0
  for (const [index, locant] of order.entries()) {
    const next = order[(index + 1) % order.length]
    if (bonds.has(key(locant, next))) edges[String.fromCharCode(97 + letter++)] = [atoms[locant], atoms[next]]
  }
  return { name: spec.name, zh: spec.zh, group: spec.group, molecule, atoms, edges }
}
