import { BOND_LENGTH } from "./constants.ts"
import { bracketProblem } from "./drawing/brackets.ts"
import { elementOf } from "./elements/index.ts"
import { atomHydrogens } from "./formula.ts"
import { dist, distToSegment } from "./geometry.ts"
import { hiddenAtoms } from "./molecule/collapse.ts"
import type { Atom, Bond, Drawing, Molecule } from "./types.ts"

export type ProblemCode =
  | "duplicate-id"
  | "id-not-below-counter"
  | "bad-coordinate"
  | "bad-isotope"
  | "bad-atom"
  | "bad-bond"
  | "dangling-bond"
  | "self-bond"
  | "duplicate-bond"
  | "stereo-on-multiple-bond"
  | "look-on-special-bond"
  | "group-empty"
  | "group-unknown-atom"
  | "group-overlap"
  | "valence"
  | "bad-molfile"
  | "unsupported-mol-feature"
  | "missing-coordinates"
  | "flattened-3d"
  | "aromatic-unresolved"
  | "bad-bracket"
  | "atoms-overlap"
  | "atom-on-bond"
  | "long-bond"
  | "short-bond"

/**
 * Errors break an invariant the rest of the code relies on.
 * Warnings are chemistry a half-drawn structure is allowed to have, or slips in the drawing.
 */
export type Problem = {
  code: ProblemCode
  severity: "error" | "warning"
  atoms?: number[]
  bonds?: number[]
  arrows?: number[]
  groups?: number[]
  brackets?: number[]
  /** Which SDF record, counting from 1, when the problem comes from a file. */
  record?: number
  message: string
}

const WEDGES = new Set(["up", "down", "either"])

const ORDERS = new Set<unknown>([1, 2, 3])
const STEREOS = new Set<unknown>(["none", "up", "down", "either"])
const LOOKS = new Set<unknown>(["bold", "dashed", "shadow"])

export function validate(mol: Molecule): Problem[] {
  const problems: Problem[] = []
  const atomIds = new Set<number>()
  for (const atom of mol.atoms) {
    if (atomIds.has(atom.id)) {
      problems.push({ code: "duplicate-id", severity: "error", atoms: [atom.id], message: `atom #${atom.id} appears twice` })
    }
    atomIds.add(atom.id)
    if (atom.id >= mol.nextAtomId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        atoms: [atom.id],
        message: `atom #${atom.id} is not below nextAtomId ${mol.nextAtomId}`,
      })
    }
    if (atom.isotope != null && !(Number.isInteger(atom.isotope) && atom.isotope >= 1 && atom.isotope <= 999)) {
      problems.push({ code: "bad-isotope", severity: "error", atoms: [atom.id], message: `atom #${atom.id} has mass number ${atom.isotope}` })
    }
    if (typeof atom.el !== "string" || !elementOf(atom.el)) {
      problems.push({ code: "bad-atom", severity: "error", atoms: [atom.id], message: `atom #${atom.id} is "${atom.el}", not an element` })
    }
    if (!Number.isInteger(atom.charge) || Math.abs(atom.charge) > 8) {
      problems.push({ code: "bad-atom", severity: "error", atoms: [atom.id], message: `atom #${atom.id} has charge ${JSON.stringify(atom.charge)}` })
    }
    if (atom.alias != null && typeof atom.alias !== "string") {
      problems.push({ code: "bad-atom", severity: "error", atoms: [atom.id], message: `atom #${atom.id} has a label that is not text` })
    }
    if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y)) {
      problems.push({ code: "bad-coordinate", severity: "error", atoms: [atom.id], message: `atom #${atom.id} has a non-finite coordinate` })
    }
  }

  const bondIds = new Set<number>()
  const pairs = new Map<string, number>()
  for (const bond of mol.bonds) {
    if (bondIds.has(bond.id)) {
      problems.push({ code: "duplicate-id", severity: "error", bonds: [bond.id], message: `bond #${bond.id} appears twice` })
    }
    bondIds.add(bond.id)
    if (bond.id >= mol.nextBondId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        bonds: [bond.id],
        message: `bond #${bond.id} is not below nextBondId ${mol.nextBondId}`,
      })
    }
    if (bond.a === bond.b) {
      problems.push({ code: "self-bond", severity: "error", bonds: [bond.id], atoms: [bond.a], message: `bond #${bond.id} joins atom #${bond.a} to itself` })
      continue
    }
    const missing = [bond.a, bond.b].filter((id) => !atomIds.has(id))
    if (missing.length > 0) {
      problems.push({
        code: "dangling-bond",
        severity: "error",
        bonds: [bond.id],
        atoms: missing,
        message: `bond #${bond.id} points at missing atom ${missing.map((id) => `#${id}`).join(", ")}`,
      })
    }
    const key = bond.a < bond.b ? `${bond.a}-${bond.b}` : `${bond.b}-${bond.a}`
    const first = pairs.get(key)
    if (first != null) {
      problems.push({
        code: "duplicate-bond",
        severity: "error",
        bonds: [first, bond.id],
        atoms: [bond.a, bond.b],
        message: `bonds #${first} and #${bond.id} both join #${bond.a} and #${bond.b}`,
      })
    } else {
      pairs.set(key, bond.id)
    }
    // Values outside what the types allow (an op or a file can carry anything): never kept.
    const wrong = [
      !ORDERS.has(bond.order) && `order ${JSON.stringify(bond.order)}`,
      !STEREOS.has(bond.stereo) && `stereo ${JSON.stringify(bond.stereo)}`,
      bond.look != null && !LOOKS.has(bond.look) && `look ${JSON.stringify(bond.look)}`,
      bond.emphasis != null && !LOOKS.has(bond.emphasis) && `emphasis ${JSON.stringify(bond.emphasis)}`,
    ].filter(Boolean)
    if (wrong.length > 0) problems.push({ code: "bad-bond", severity: "error", bonds: [bond.id], message: `bond #${bond.id} has ${wrong.join(", ")}` })
    if (bond.order !== 1 && WEDGES.has(bond.stereo)) {
      problems.push({
        code: "stereo-on-multiple-bond",
        severity: "error",
        bonds: [bond.id],
        message: `bond #${bond.id} has order ${bond.order} and stereo "${bond.stereo}"`,
      })
    }
    if (bond.look && (bond.order !== 1 || bond.stereo !== "none")) {
      problems.push({
        code: "look-on-special-bond",
        severity: "error",
        bonds: [bond.id],
        message: `bond #${bond.id} has look "${bond.look}" but is not a plain single bond`,
      })
    }
  }

  const groupIds = new Set<number>()
  const owner = new Map<number, number>()
  for (const group of mol.groups) {
    if (groupIds.has(group.id)) {
      problems.push({ code: "duplicate-id", severity: "error", groups: [group.id], message: `group #${group.id} appears twice` })
    }
    groupIds.add(group.id)
    if (group.id >= mol.nextGroupId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        groups: [group.id],
        message: `group #${group.id} is not below nextGroupId ${mol.nextGroupId}`,
      })
    }
    if (group.atoms.length === 0) {
      problems.push({ code: "group-empty", severity: "error", groups: [group.id], message: `group #${group.id} (${group.label}) has no atoms` })
    }
    const missing = group.atoms.filter((id) => !atomIds.has(id))
    if (missing.length > 0) {
      problems.push({
        code: "group-unknown-atom",
        severity: "error",
        groups: [group.id],
        atoms: missing,
        message: `group #${group.id} (${group.label}) lists missing atom ${missing.map((id) => `#${id}`).join(", ")}`,
      })
    }
    for (const id of group.atoms) {
      const other = owner.get(id)
      if (other != null && other !== group.id) {
        problems.push({
          code: "group-overlap",
          severity: "error",
          groups: [other, group.id],
          atoms: [id],
          message: `atom #${id} belongs to groups #${other} and #${group.id}`,
        })
      }
      owner.set(id, group.id)
    }
  }

  for (const atom of mol.atoms) {
    if (!atomHydrogens(mol, atom.id).error) continue
    problems.push({ code: "valence", severity: "warning", atoms: [atom.id], message: `atom #${atom.id} (${atom.el}) exceeds its valence` })
  }
  return problems
}

export function validateDrawing(drawing: Drawing): Problem[] {
  const problems = [...validate(drawing.molecule), ...geometryProblems(drawing.molecule)]
  const ids = new Set<number>()
  for (const arrow of drawing.arrows) {
    if (ids.has(arrow.id)) {
      problems.push({ code: "duplicate-id", severity: "error", arrows: [arrow.id], message: `arrow #${arrow.id} appears twice` })
    }
    ids.add(arrow.id)
    if (arrow.id >= drawing.nextArrowId) {
      problems.push({
        code: "id-not-below-counter",
        severity: "error",
        arrows: [arrow.id],
        message: `arrow #${arrow.id} is not below nextArrowId ${drawing.nextArrowId}`,
      })
    }
    if (![arrow.x1, arrow.y1, arrow.x2, arrow.y2].every(Number.isFinite)) {
      problems.push({ code: "bad-coordinate", severity: "error", arrows: [arrow.id], message: `arrow #${arrow.id} has a non-finite coordinate` })
    }
  }
  problems.push(...bracketProblems(drawing))
  return problems
}

/** Brackets that list missing atoms, repeat an id, or carry a count they cannot have. */
function bracketProblems(drawing: Drawing): Problem[] {
  if (drawing.brackets == null) return []
  if (!Array.isArray(drawing.brackets)) return [{ code: "bad-bracket", severity: "error", message: "the brackets are not a list" }]
  const problems: Problem[] = []
  const ids = new Set<number>()
  const counter = drawing.nextBracketId ?? 1
  for (const bracket of drawing.brackets) {
    if (!Number.isInteger(bracket?.id)) {
      problems.push({ code: "bad-bracket", severity: "error", message: "a bracket has no id" })
      continue
    }
    if (ids.has(bracket.id)) problems.push({ code: "duplicate-id", severity: "error", brackets: [bracket.id], message: `bracket #${bracket.id} appears twice` })
    ids.add(bracket.id)
    if (bracket.id >= counter) {
      problems.push({ code: "id-not-below-counter", severity: "error", brackets: [bracket.id], message: `bracket #${bracket.id} is not below nextBracketId ${counter}` })
    }
    const problem = bracketProblem(drawing.molecule, bracket)
    if (problem) problems.push({ code: "bad-bracket", severity: "error", brackets: [bracket.id], message: problem })
  }
  return problems
}

// Drawing slips, measured in bond lengths. Loose on purpose, as hosts may ask before saving
// anything reported: whatever the templates, scaffolds and drawing tools lay out passes with
// room to spare (closest: 0.27 apart, 0.13 off a bond, bonds 1.4 times the median), and so
// do RDKit's crowded bridged depictions (camphor's methyls: 0.17 apart on bonds of 0.37).

/** Atoms not bonded to each other and closer than this are drawn on top of each other. */
const OVERLAP = 0.125
/** An atom this close to a bond's line, away from its ends, lies on the bond. */
const ON_BOND = 0.08
/** Bonds longer or shorter than these times their molecule's median. */
const LONG = 2.5
const SHORT = 0.3
/** Fewer bonds than this say too little about a molecule's usual length to call one out. */
const FEWEST_BONDS = 3

/** The middle value, or the mean of the middle two. */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const half = sorted.length / 2
  return Number.isInteger(half) ? (sorted[half - 1] + sorted[half]) / 2 : sorted[Math.floor(half)]
}

/** Union-find over ids: `join` two, `top` of one. Not recursive: a long chain is deep. */
function sets() {
  const parent = new Map<number, number>()
  const top = (id: number): number => {
    let found = id
    while ((parent.get(found) ?? found) !== found) found = parent.get(found)!
    for (let at = id; at !== found; ) {
      const up = parent.get(at)!
      parent.set(at, found)
      at = up
    }
    return found
  }
  return { top, join: (a: number, b: number) => parent.set(top(a), top(b)) }
}

/**
 * Atoms drawn on top of each other, an atom lying on a bond it is not part of, and bonds far
 * longer or shorter than the rest: warnings, as the chemistry is not wrong. Only what is shown
 * counts (not the atoms behind a collapsed label). Lengths go by each molecule's own median
 * bond, so a drawing, or one molecule in it, may be drawn at any size.
 */
export function geometryProblems(mol: Molecule): Problem[] {
  const hidden = hiddenAtoms(mol)
  const atoms = mol.atoms.filter((atom) => !hidden.has(atom.id) && Number.isFinite(atom.x) && Number.isFinite(atom.y))
  const byId = new Map(atoms.map((atom) => [atom.id, atom]))
  const bonds = mol.bonds.filter((bond) => bond.a !== bond.b && byId.has(bond.a) && byId.has(bond.b))
  const length = (bond: Bond) => dist(byId.get(bond.a)!, byId.get(bond.b)!)

  // Each molecule's median bond; atoms on their own go by the whole drawing's. Bonds of no
  // length say nothing about the size (they are reported as short).
  const pieces = sets()
  for (const bond of bonds) pieces.join(bond.a, bond.b)
  const lengths = new Map<number, number[]>()
  const counts = new Map<number, number>()
  for (const bond of bonds) {
    const top = pieces.top(bond.a)
    counts.set(top, (counts.get(top) ?? 0) + 1)
    if (length(bond) <= 1) continue
    if (!lengths.has(top)) lengths.set(top, [])
    lengths.get(top)!.push(length(bond))
  }
  const usual = median(bonds.map(length).filter((value) => value > 1)) ?? BOND_LENGTH
  const medians = new Map([...lengths].map(([top, values]) => [top, median(values) ?? usual]))
  const unit = (id: number) => medians.get(pieces.top(id)) ?? usual
  const largest = Math.max(usual, ...medians.values())

  // Atoms by x, so each check looks only at the atoms within reach.
  const byX = [...atoms].sort((a, b) => a.x - b.x)
  const between = (from: number, to: number): Atom[] => {
    let low = 0
    let high = byX.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (byX[middle].x < from) low = middle + 1
      else high = middle
    }
    const found: Atom[] = []
    for (let index = low; index < byX.length && byX[index].x <= to; index++) found.push(byX[index])
    return found
  }

  const problems: Problem[] = []
  // Atoms on top of each other, one problem for each heap of them.
  const pair = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const bonded = new Set(bonds.map((bond) => pair(bond.a, bond.b)))
  const heaps = sets()
  const heaped = new Set<number>()
  byX.forEach((atom, index) => {
    for (let next = index + 1; next < byX.length && byX[next].x - atom.x < OVERLAP * largest; next++) {
      const other = byX[next]
      if (bonded.has(pair(atom.id, other.id)) || dist(atom, other) >= OVERLAP * Math.min(unit(atom.id), unit(other.id))) continue
      heaps.join(atom.id, other.id)
      heaped.add(atom.id).add(other.id)
    }
  })
  const members = new Map<number, number[]>()
  for (const atom of atoms) {
    if (!heaped.has(atom.id)) continue
    const top = heaps.top(atom.id)
    if (!members.has(top)) members.set(top, [])
    members.get(top)!.push(atom.id)
  }
  for (const ids of members.values()) {
    problems.push({ code: "atoms-overlap", severity: "warning", atoms: ids, message: `atoms ${ids.map((id) => `#${id}`).join(", ")} are drawn on top of each other` })
  }

  for (const bond of bonds) {
    const [a, b] = [byId.get(bond.a)!, byId.get(bond.b)!]
    const reach = unit(bond.a)
    const span = length(bond)
    for (const atom of span > 1 ? between(Math.min(a.x, b.x) - ON_BOND * reach, Math.max(a.x, b.x) + ON_BOND * reach) : []) {
      // Close to an end it sits on the atom there, which is reported as overlapping or a short bond.
      if (atom.id === bond.a || atom.id === bond.b || Math.min(dist(atom, a), dist(atom, b)) < OVERLAP * reach) continue
      if (distToSegment(atom, a, b) >= ON_BOND * reach) continue
      problems.push({ code: "atom-on-bond", severity: "warning", atoms: [atom.id, bond.a, bond.b], bonds: [bond.id], message: `atom #${atom.id} lies on bond #${bond.id} (#${bond.a}–#${bond.b})` })
    }
    const ratio = span / reach
    if ((counts.get(pieces.top(bond.a)) ?? 0) >= FEWEST_BONDS && (ratio > LONG || ratio < SHORT)) {
      problems.push({
        code: ratio > LONG ? "long-bond" : "short-bond",
        severity: "warning",
        atoms: [bond.a, bond.b],
        bonds: [bond.id],
        message: `bond #${bond.id} (#${bond.a}–#${bond.b}) is ${ratio.toFixed(1)} times as long as its molecule's usual bond`,
      })
    }
  }
  return problems
}

export function errorsOf(problems: Problem[]): Problem[] {
  return problems.filter((problem) => problem.severity === "error")
}
