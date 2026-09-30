import { pointFrom } from "../geometry.ts"
import { atomById, bondLengthAt, componentOf, neighbors, sproutAngle } from "../molecule.ts"
import { applyOps, type Op } from "../ops.ts"
import type { Drawing, Molecule } from "../types.ts"
import { smallestRings } from "../molecule/cycles.ts"
import { BRIDGES, type BridgeName } from "./bridges.ts"
import { representativesOf } from "./representatives.ts"
import { alternativesOf, placeholders, undefinedVariables } from "./variables.ts"

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** How many combinations the concrete alternatives allow, generated or not. */
  total: number
  /** Per variable, how many class alternatives were left out: all of them, unless representatives stand in. */
  classesLeftOut: Record<string, number>
  /** Per variable, the representative labels that stood in for its classes. */
  represented: Record<string, string[]>
  /** Placeholder labels with no definition: they stay placeholders in every molecule. */
  undefinedNames: string[]
  /** Variables with only classes: nothing concrete to put there, so nothing is generated. */
  onlyClasses: string[]
  /** Combinations that could not be built, and why (at most five are kept). */
  failures: Array<{ choice: Array<{ name: string; text: string }>; error: string }>
  /** How many combinations failed in all. */
  failed: number
}

/**
 * One placeholder atom and what it may become. `where` is how it sits: at the end of a
 * branch, inside a ring, or between two atoms of a chain (a linker such as L).
 */
type Site = { atom: number; name: string; labels: string[]; where: "end" | "ring" | "link" }

/** Stands for a direct bond among a site's choices ("L is a single bond"). */
export const BOND = "单键"

/**
 * What putting a choice on a placeholder takes. At a branch end it is swapped for the piece
 * (or dropped for H, leaving an implicit hydrogen). In a ring it is relabelled in place,
 * which suits X = O or S. Between two atoms, a bond or a divalent ring joins them, while an
 * element such as O or S takes the placeholder's place.
 */
function opsFor(site: Site, text: string): Op[] {
  if (site.where === "ring") return [{ op: "label", atom: site.atom, text }]
  if (site.where === "link") {
    if (text === BOND) return [{ op: "replace", atoms: [site.atom], with: { bond: true } }]
    if (Object.hasOwn(BRIDGES, text)) return [{ op: "replace", atoms: [site.atom], with: { bridge: text as BridgeName } }]
    return [{ op: "label", atom: site.atom, text }]
  }
  if (text === "H") return [{ op: "remove", atoms: [site.atom] }]
  return [{ op: "replace", atoms: [site.atom], with: { label: text } }]
}

/** How a placeholder sits in the (laid out) molecule. */
function whereOf(mol: Molecule, atom: number, inRing: Set<number>): Site["where"] {
  if (inRing.has(atom)) return "ring"
  return neighbors(mol, atom).length >= 2 ? "link" : "end"
}

export type EnumerateOptions = {
  /** Most molecules to build; the total is counted regardless. */
  limit?: number
  /** Let typical members stand in for each class (methyl, ethyl… for alkyl); else classes are left out. */
  representatives?: boolean
}

/** A way of making every variable attachment's bond, with the placeholders it displaces gone. */
type Layout = { drawing: Drawing; where: Array<{ name: string; text: string }> } | { error: string; where: Array<{ name: string; text: string }> }

/**
 * Every way of placing the variable attachments, one candidate atom each. A candidate
 * that carries a placeholder (R10 on the ring carbon –L– lands on) loses it: the
 * attachment takes that position.
 */
function* layouts(drawing: Drawing): Generator<Layout> {
  const attachments = drawing.attachments ?? []
  const names = new Set(Object.keys(drawing.variables ?? {}))
  const label = (id: number) => drawing.molecule.atoms.find((atom) => atom.id === id)?.alias ?? `#${id}`
  const choice = attachments.map(() => 0)
  for (;;) {
    let laid: Drawing = { molecule: drawing.molecule, arrows: [], nextArrowId: drawing.nextArrowId, variables: drawing.variables }
    const where: Array<{ name: string; text: string }> = []
    let error: string | null = null
    for (const [index, attachment] of attachments.entries()) {
      const target = attachment.to[choice[index]]
      const displaced = neighbors(laid.molecule, target).filter((atom) => atom.alias && names.has(atom.alias) && neighbors(laid.molecule, atom.id).length === 1)
      where.push({ name: `${label(attachment.atom)} 连接位置`, text: displaced[0]?.alias ?? `#${target}` })
      const placed = attach(laid, attachment.atom, target, displaced.map((atom) => atom.id))
      if ("error" in placed) {
        error = placed.error
        break
      }
      laid = placed.drawing
    }
    yield error ? { error, where } : { drawing: laid, where }
    let index = attachments.length - 1
    for (; index >= 0; index--) {
      choice[index]++
      if (choice[index] < attachments[index].to.length) break
      choice[index] = 0
    }
    if (index < 0) return
  }
}

/**
 * Makes one attachment's bond: the placeholder on `target` goes, the attached piece (the
 * hub and everything it carries) is carried over to sit one bond out from `target`, the
 * way a substituent would grow there, then bonded and tidied. Nothing else moves.
 */
function attach(drawing: Drawing, hub: number, target: number, displaced: number[]): { drawing: Drawing } | { error: string } {
  const freed = displaced.length > 0 ? applyOps(drawing, [{ op: "remove", atoms: displaced }]) : { ok: true as const, drawing }
  if (!freed.ok) return { error: freed.error }
  const mol = freed.drawing.molecule
  const piece = componentOf(mol, hub)
  if (piece.includes(target)) return { error: `atom #${hub} is already joined to the ring it attaches to` }
  const from = atomById(mol, hub)!
  const spot = pointFrom(atomById(mol, target)!, sproutAngle(mol, target), bondLengthAt(mol, target))
  const result = applyOps(freed.drawing, [
    { op: "move", atoms: piece, dx: spot.x - from.x, dy: spot.y - from.y },
    { op: "add_bond", a: hub, b: target },
    ...(piece.length > 1 ? [{ op: "clean" as const, atoms: piece.filter((id) => id !== hub), lock: [hub] }] : []),
  ])
  return result.ok ? { drawing: result.drawing } : { error: result.error }
}

/**
 * Expands a generic formula into concrete molecules: every placement of each variable
 * attachment, and every combination of each placeholder's label alternatives, each
 * placeholder choosing on its own. A class ("(C1-C30)alkyl") is never expanded in full;
 * it is left out, or with `representatives` a few typical members inside its range stand
 * in for it. The result says which.
 */
export function enumerate(drawing: Drawing, { limit = 1000, representatives = false }: EnumerateOptions = {}): Enumeration {
  const variables = drawing.variables ?? {}
  const undefinedNames = undefinedVariables(drawing)
  const classesLeftOut: Record<string, number> = {}
  const represented: Record<string, string[]> = {}
  /** Each variable's concrete labels, counting its classes once however many atoms carry it. */
  const labelsOf = new Map<string, string[]>()
  for (const { name } of placeholders(drawing)) {
    if (labelsOf.has(name)) continue
    const alternatives = alternativesOf(variables, name)
    const labels = alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : item.kind === "bond" ? [BOND] : []))
    for (const item of alternatives) {
      if (item.kind !== "class") continue
      const standIns = representatives ? representativesOf(item).filter((label) => !labels.includes(label)) : []
      if (standIns.length === 0) classesLeftOut[name] = (classesLeftOut[name] ?? 0) + 1
      labels.push(...standIns)
      if (standIns.length > 0) represented[name] = [...(represented[name] ?? []), ...standIns]
    }
    labelsOf.set(name, labels)
  }
  const onlyClasses = [...labelsOf].flatMap(([name, labels]) => (labels.length === 0 ? [name] : []))
  const empty = { classesLeftOut, represented, undefinedNames }
  if (onlyClasses.length > 0) return { molecules: [], total: 0, ...empty, onlyClasses, failures: [], failed: 0 }

  let total = 0
  const molecules: Molecule[] = []
  const failures: Enumeration["failures"] = []
  let failed = 0
  const fail = (choice: Array<{ name: string; text: string }>, error: string) => {
    if (failed++ < 5) failures.push({ choice, error })
  }
  for (const layout of layouts(drawing)) {
    if ("error" in layout) {
      total++
      fail(layout.where, layout.error)
      continue
    }
    const laid = layout.drawing
    const inRing = new Set(smallestRings(laid.molecule).flat())
    const sites: Site[] = placeholders(laid).map(({ atom, name }) => ({ atom, name, labels: labelsOf.get(name)!, where: whereOf(laid.molecule, atom, inRing) }))
    const count = sites.reduce((product, site) => product * site.labels.length, 1)
    total += count
    // An odometer over the sites: the last placeholder turns fastest.
    const choice = sites.map(() => 0)
    for (let made = 0; made < count && molecules.length + failed < limit; made++) {
      // Relabelling in place first, then links, then swaps, then removals, so no op aims at an
      // atom already gone and a link is made before the branch ends it carries are swapped.
      const chosen = sites.map((site, index) => ({ site, text: site.labels[choice[index]] }))
      const order = ({ site, text }: (typeof chosen)[number]) => (site.where === "ring" ? 0 : site.where === "link" ? 1 : text === "H" ? 3 : 2)
      const ops = [...chosen].sort((a, b) => order(a) - order(b)).flatMap(({ site, text }) => opsFor(site, text))
      const result = applyOps({ ...laid, variables: undefined }, ops)
      if (result.ok) molecules.push(result.drawing.molecule)
      else fail([...layout.where, ...chosen.map(({ site, text }) => ({ name: site.name, text }))], result.error)
      for (let index = sites.length - 1; index >= 0; index--) {
        choice[index]++
        if (choice[index] < sites[index].labels.length) break
        choice[index] = 0
      }
    }
  }
  return { molecules, total, ...empty, onlyClasses: [], failures, failed }
}
