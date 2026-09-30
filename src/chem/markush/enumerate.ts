import { elementOf } from "../elements/index.ts"
import { pointFrom } from "../geometry.ts"
import { knownLabel } from "../label.ts"
import { atomById, bondLengthAt, componentOf, neighbors, sproutAngle } from "../molecule.ts"
import { applyOps, type Op } from "../ops.ts"
import type { Choice, Drawing, Molecule } from "../types.ts"
import { representativesOf } from "./representatives.ts"
import { siteKind, type SiteKind } from "./sites.ts"
import { alternativesOf, isVariableName, placeholders, undefinedVariables } from "./variables.ts"

/** One thing in a combination: a placeholder's choice, or where an attachment was made. */
export type Pick = { name: string; choice: Choice } | { name: string; position: string }

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** How many combinations the fitting choices allow, generated or not. */
  total: number
  /** Per variable, how many class alternatives were left out: all of them, unless representatives stand in. */
  classesLeftOut: Record<string, number>
  /** Per variable, the representatives that stood in for its classes. */
  represented: Record<string, Choice[]>
  /**
   * Per variable, choices that cannot go where its placeholder sits, and were skipped: a
   * bond or a divalent ring at a branch end, a group inside a ring, a group where a linker is.
   */
  misfits: Record<string, Choice[]>
  /** Placeholder labels with no definition: they stay placeholders in every molecule. */
  undefinedNames: string[]
  /** Variables with nothing concrete to put there (only classes, or nothing that fits), so nothing is generated. */
  onlyClasses: string[]
  /** Combinations that could not be built, and why (at most five are kept). */
  failures: Array<{ choice: Pick[]; error: string }>
  /** How many combinations failed in all. */
  failed: number
}

/** One placeholder atom, how it sits (see siteKind), and what it may become there. */
type Site = { atom: number; name: string; choices: Choice[]; where: SiteKind }

const same = (a: Choice, b: Choice) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Whether a choice can go where a placeholder sits. A branch end takes a group or an atom
 * (never a bond or a divalent ring); a ring position takes an element; a linker takes a
 * bond, a divalent ring or an element such as O or S, never a group that ends a branch.
 */
function fits(where: SiteKind, choice: Choice): boolean {
  if (where === "end") return choice.kind === "label"
  const element = choice.kind === "label" && elementOf(choice.text) != null
  if (where === "ring") return element
  return choice.kind !== "label" || element
}

/**
 * What putting a choice on a placeholder takes. At a branch end it is swapped for the piece
 * (or dropped for H, leaving an implicit hydrogen). In a ring it is relabelled in place. A
 * linker becomes a bond or a divalent ring joining its two neighbours, or an element in place.
 */
function opsFor(site: Site, choice: Choice): Op[] {
  if (choice.kind === "bond") return [{ op: "replace", atoms: [site.atom], with: { bond: true } }]
  if (choice.kind === "bridge") return [{ op: "replace", atoms: [site.atom], with: { bridge: choice.name } }]
  if (site.where !== "end") return [{ op: "label", atom: site.atom, text: choice.text }]
  if (choice.text === "H") return [{ op: "remove", atoms: [site.atom] }]
  return [{ op: "replace", atoms: [site.atom], with: { label: choice.text } }]
}

/**
 * A label a built molecule must not keep: a defined variable's placeholder, or text that is
 * no element or group (so a choice put a word where a structure belonged). Placeholders of
 * variables with no definition are expected to stay.
 */
function leftover(mol: Molecule, defined: Set<string>): string | null {
  for (const atom of mol.atoms) {
    if (!atom.alias) continue
    if (defined.has(atom.alias)) return `the placeholder ${atom.alias} was not replaced`
    if (!isVariableName(atom.alias) && !knownLabel(atom.alias)) return `"${atom.alias}" is not a structure`
  }
  return null
}

export type EnumerateOptions = {
  /** Most molecules to build; the total is counted regardless. */
  limit?: number
  /** Let typical members stand in for each class (methyl, ethyl… for alkyl); else classes are left out. */
  representatives?: boolean
}

/** A way of making every variable attachment's bond, with the placeholders it displaces gone. */
type Layout = { drawing: Drawing; where: Pick[] } | { error: string; where: Pick[] }

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
    const where: Pick[] = []
    let error: string | null = null
    for (const [index, attachment] of attachments.entries()) {
      const target = attachment.to[choice[index]]
      const displaced = neighbors(laid.molecule, target).filter((atom) => atom.alias && names.has(atom.alias) && neighbors(laid.molecule, atom.id).length === 1)
      where.push({ name: label(attachment.atom), position: displaced[0]?.alias ?? `#${target}` })
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
 * attachment, and every combination of each placeholder's choices that fit where it sits,
 * each placeholder choosing on its own. A class ("(C1-C30)alkyl") is never expanded in
 * full; it is left out, or with `representatives` a few typical members inside its range
 * stand in for it. The result says which, and what was skipped as not fitting.
 */
export function enumerate(drawing: Drawing, { limit = 1000, representatives = false }: EnumerateOptions = {}): Enumeration {
  const variables = drawing.variables ?? {}
  const defined = new Set(Object.keys(variables))
  const undefinedNames = undefinedVariables(drawing)
  const classesLeftOut: Record<string, number> = {}
  const represented: Record<string, Choice[]> = {}
  const misfits: Record<string, Choice[]> = {}
  /** Each variable's choices, counting its classes once however many atoms carry it. */
  const choicesOf = new Map<string, Choice[]>()
  for (const { name } of placeholders(drawing)) {
    if (choicesOf.has(name)) continue
    const alternatives = alternativesOf(variables, name)
    const choices: Choice[] = alternatives.flatMap((item) => (item.kind === "class" ? [] : [item]))
    for (const item of alternatives) {
      if (item.kind !== "class") continue
      const standIns = representatives ? representativesOf(item).filter((choice) => !choices.some((other) => same(other, choice))) : []
      if (standIns.length === 0) classesLeftOut[name] = (classesLeftOut[name] ?? 0) + 1
      choices.push(...standIns)
      if (standIns.length > 0) represented[name] = [...(represented[name] ?? []), ...standIns]
    }
    choicesOf.set(name, choices)
  }
  const report = { classesLeftOut, represented, misfits, undefinedNames }
  const bare = [...choicesOf].flatMap(([name, choices]) => (choices.length === 0 ? [name] : []))
  if (bare.length > 0) return { molecules: [], total: 0, ...report, onlyClasses: bare, failures: [], failed: 0 }

  let total = 0
  const molecules: Molecule[] = []
  const failures: Enumeration["failures"] = []
  let failed = 0
  const unfilled = new Set<string>()
  const fail = (choice: Pick[], error: string) => {
    if (failed++ < 5) failures.push({ choice, error })
  }
  for (const layout of layouts(drawing)) {
    if ("error" in layout) {
      total++
      fail(layout.where, layout.error)
      continue
    }
    const laid = layout.drawing
    const sites: Site[] = placeholders(laid).map(({ atom, name }) => {
      const where = siteKind(laid, atom)
      const all = choicesOf.get(name)!
      const skipped = all.filter((choice) => !fits(where, choice))
      for (const choice of skipped) if (!(misfits[name] ?? []).some((other) => same(other, choice))) misfits[name] = [...(misfits[name] ?? []), choice]
      return { atom, name, where, choices: all.filter((choice) => fits(where, choice)) }
    })
    for (const site of sites) if (site.choices.length === 0) unfilled.add(site.name)
    const count = sites.reduce((product, site) => product * site.choices.length, 1)
    total += count
    // An odometer over the sites: the last placeholder turns fastest.
    const index = sites.map(() => 0)
    for (let made = 0; made < count && molecules.length + failed < limit; made++) {
      // Relabelling in place first, then links, then swaps, then removals, so no op aims at an
      // atom already gone and a link is made before the branch ends it carries are swapped.
      const chosen = sites.map((site, at) => ({ site, choice: site.choices[index[at]] }))
      const order = ({ site, choice }: (typeof chosen)[number]) =>
        site.where === "ring" ? 0 : site.where === "link" ? 1 : choice.kind === "label" && choice.text === "H" ? 3 : 2
      const ops = [...chosen].sort((a, b) => order(a) - order(b)).flatMap(({ site, choice }) => opsFor(site, choice))
      const picks: Pick[] = [...layout.where, ...chosen.map(({ site, choice }) => ({ name: site.name, choice }))]
      const result = applyOps({ ...laid, variables: undefined }, ops)
      const wrong = result.ok ? leftover(result.drawing.molecule, defined) : result.error
      if (result.ok && !wrong) molecules.push(result.drawing.molecule)
      else fail(picks, wrong!)
      for (let at = sites.length - 1; at >= 0; at--) {
        index[at]++
        if (index[at] < sites[at].choices.length) break
        index[at] = 0
      }
    }
  }
  return { molecules, total, ...report, onlyClasses: [...unfilled], failures, failed }
}
