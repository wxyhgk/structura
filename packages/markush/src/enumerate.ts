import { elementOf } from "@structura/core/elements"
import { atomHydrogens } from "@structura/core/formula"
import { pointFrom } from "@structura/core/geometry"
import { knownLabel } from "@structura/core"
import { atomById, bondLengthAt, componentOf, deleteSelection, duplicateAtoms, neighbors, sproutAngle, subMolecule } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, Attachment, Choice, Drawing, Molecule, Proviso } from "@structura/core/types"
import { validate } from "@structura/core/validate"
import { fragmentFits, fragmentFormula, fragmentVariables } from "@structura/core/markush"
import { closeRing } from "./closures.ts"
import { odometer } from "./odometer.ts"
import { representativesOf } from "./representatives.ts"
import { siteKind, type SiteKind } from "./sites.ts"
import { alternativesOf, isVariableName } from "@structura/core/markush"
import { placeholders, undefinedVariables } from "./queries.ts"

/** One thing in a combination: a placeholder's choice, or where an attachment was made. */
export type Pick = { name: string; choice: Choice } | { name: string; position: string }

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** For each molecule, what each variable became and where each attachment went. */
  picks: Pick[][]
  /** How many combinations the fitting choices allow, generated or not. */
  total: number
  /**
   * Attachment placements left out because a candidate position already carries something
   * other than a placeholder (a ring carbon with a methyl has no hydrogen left to replace).
   */
  occupied: number
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
  /** Built molecules dropped as repeats of one already made (only with `identity`). */
  duplicates: number
  /** How many separate formulas the drawing holds (formula I, formula II…); each is expanded on its own. */
  formulas: number
  /** For each molecule, which formula it came from (1, 2…), in drawing order. */
  formulaOf: number[]
  /** Combinations or compounds left out because a proviso of the claim excludes them. */
  excluded: number
  /** Excluded compounds (by SMILES) that could not be checked, for want of `identifySmiles`. */
  uncheckedCompounds: number
}

/** One placeholder atom, how it sits (see siteKind), and what it may become there. */
type Site = { atom: number; name: string; choices: Choice[]; where: SiteKind }

const same = (a: Choice, b: Choice) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Whether a choice can go where a placeholder sits. A branch end takes a group or an atom
 * (never a bond or a divalent ring); a ring position takes an element; a linker takes a
 * bond, a divalent ring or an element such as O or S, never a group that ends a branch.
 * A drawn piece goes wherever its "*" marks match the placeholder's bonds (see fragmentFits).
 */
function fits(drawing: Drawing, atom: number, where: SiteKind, choice: Choice): boolean {
  if (choice.kind === "fragment") return fragmentFits(drawing.molecule, atom, choice.molecule)
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
  if (choice.kind === "fragment") return [{ op: "replace", atoms: [site.atom], with: { fragment: choice.molecule } }]
  if (choice.kind === "bond") return [{ op: "replace", atoms: [site.atom], with: { bond: true } }]
  if (choice.kind === "bridge") return [{ op: "replace", atoms: [site.atom], with: { bridge: choice.name } }]
  if (site.where !== "end") return [{ op: "label", atom: site.atom, text: choice.text }]
  if (choice.text === "H") return [{ op: "remove", atoms: [site.atom] }]
  return [{ op: "replace", atoms: [site.atom], with: { label: choice.text } }]
}

/**
 * The ops that put each chosen choice on its site, relabelling in place first, then links,
 * then swaps, then removals, so no op aims at an atom already gone and a link is made
 * before the branch ends it carries are swapped.
 */
function opsForAll(chosen: Array<{ site: Site; choice: Choice }>): Op[] {
  const order = ({ site, choice }: (typeof chosen)[number]) =>
    site.where === "ring" ? 0 : site.where === "link" ? 1 : choice.kind === "label" && choice.text === "H" ? 3 : 2
  return [...chosen].sort((a, b) => order(a) - order(b)).flatMap(({ site, choice }) => opsFor(site, choice))
}

/** How deep pieces may sit inside pieces (Ar = N–R5, R5 = …) before the rest is left out. */
const NESTING = 4

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

/** Atoms with more bonds than their element allows. */
function overValence(mol: Molecule): Set<number> {
  return new Set(validate(mol).flatMap((problem) => (problem.code === "valence" ? problem.atoms ?? [] : [])))
}

/**
 * Why a built molecule is chemically wrong where the formula was not: an atom over its
 * valence that was fine before the choices went in. Strain the chemist drew stays theirs.
 */
function newlyOverValence(mol: Molecule, before: Set<number>): string | null {
  const problem = validate(mol).find((item) => item.code === "valence" && item.atoms?.some((id) => !before.has(id)))
  return problem ? problem.message : null
}

export type EnumerateOptions = {
  /** Most molecules to build; the total is counted regardless. */
  limit?: number
  /** Let typical members stand in for each class (methyl, ethyl… for alkyl); else classes are left out. */
  representatives?: boolean
  /**
   * What makes two molecules the same compound (a canonical SMILES, say), for dropping
   * repeats: symmetric positions on a ring, or (R1)m where R1 = H gives the bare ring many
   * ways. Left out, every combination is kept. Kept here as a function so this package needs
   * no chemistry toolkit; null from it means "cannot tell", and the molecule is kept.
   */
  identity?: (mol: Molecule) => string | null
  /**
   * The same identity for a compound given as SMILES (an excluded compound of a proviso),
   * so it can be matched against what is built. Without it, such provisos cannot be checked.
   */
  identifySmiles?: (smiles: string) => string | null
}

/** A choice in a word: the label, the ring's name, "bond", or a piece's name or formula. */
export function choiceText(choice: Choice): string {
  if (choice.kind === "label") return choice.text
  if (choice.kind === "bridge") return choice.name
  if (choice.kind === "fragment") return choice.name ?? fragmentFormula(choice.molecule)
  return "bond"
}

/** A combination as SD data items: each variable's choice, and each attachment's position. */
export function pickFields(picks: readonly Pick[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const pick of picks) {
    if ("position" in pick) fields[`${pick.name} position`] = pick.position
    else fields[pick.name] = choiceText(pick.choice)
  }
  return fields
}

/** A way of making every variable attachment's bond, with the placeholders it displaces gone. */
type Layout = { drawing: Drawing; where: Pick[] } | { error: string; where: Pick[] } | { occupied: true }

/** Every set of `size` items from `items`, in order. */
function* subsets<T>(items: readonly T[], size: number, from = 0): Generator<T[]> {
  if (size === 0) return yield []
  for (let at = from; at <= items.length - size; at++) for (const rest of subsets(items, size - 1, at + 1)) yield [items[at], ...rest]
}

/**
 * The ways one attachment can be made: each candidate atom on its own, or for "(R1)m" every
 * set of min to max different candidates, one copy of the piece on each (none for 0).
 */
function placements(attachment: Attachment): number[][] {
  if (!attachment.repeat) return attachment.to.map((id) => [id])
  const all: number[][] = []
  for (let size = attachment.repeat.min; size <= attachment.repeat.max; size++) all.push(...subsets(attachment.to, size))
  return all
}

/**
 * Every way of placing the variable attachments. A candidate that carries a placeholder
 * (R10 on the ring carbon –L– lands on) loses it: the attachment takes that position. A
 * repeated piece is copied once per extra position, and goes altogether when it appears
 * no times.
 */
function* layouts(drawing: Drawing): Generator<Layout> {
  const attachments = drawing.attachments ?? []
  const names = new Set(Object.keys(drawing.variables ?? {}))
  const label = (mol: Molecule, id: number) => mol.atoms.find((atom) => atom.id === id)?.alias ?? `#${id}`
  const ways = attachments.map(placements)
  for (const choice of odometer(ways.map((list) => list.length))) {
    let laid: Drawing = { molecule: drawing.molecule, arrows: [], nextArrowId: drawing.nextArrowId, variables: drawing.variables }
    const where: Pick[] = []
    let error: string | null = null
    let occupied = false
    for (const [index, attachment] of attachments.entries()) {
      const targets = ways[index][choice[index]]
      const name = label(drawing.molecule, attachment.atom)
      // The copies go in first, while the piece still stands where it was drawn.
      const hubs = [attachment.atom]
      const piece = componentOf(laid.molecule, attachment.atom)
      if (targets.length === 0) laid = { ...laid, molecule: deleteSelection(laid.molecule, { atoms: piece, bonds: [] }) }
      for (let copy = 1; copy < targets.length; copy++) {
        const order = subMolecule(laid.molecule, piece).atoms.map((atom) => atom.id)
        const copied = duplicateAtoms(laid.molecule, order)
        laid = { ...laid, molecule: copied.mol }
        hubs.push(copied.ids[order.indexOf(attachment.atom)])
      }
      const positions: string[] = []
      for (const [at, target] of targets.entries()) {
        const displaced = neighbors(laid.molecule, target).filter((atom) => atom.alias && names.has(atom.alias) && neighbors(laid.molecule, atom.id).length === 1)
        positions.push(displaced[0]?.alias ?? `#${target}`)
        const placed = attach(laid, hubs[at], target, displaced.map((atom) => atom.id))
        if ("occupied" in placed) occupied = true
        else if ("error" in placed) error = placed.error
        else laid = placed.drawing
        if (occupied || error) break
      }
      where.push({ name, position: attachment.repeat ? (positions.length > 0 ? positions.join(", ") : "none") : positions[0] })
      if (occupied || error) break
    }
    yield occupied ? { occupied: true } : error ? { error, where } : { drawing: laid, where }
  }
}

/**
 * Makes one attachment's bond: the placeholder on `target` goes, the attached piece (the
 * hub and everything it carries) is carried over to sit one bond out from `target`, the
 * way a substituent would grow there, then bonded and tidied. Nothing else moves.
 */
function attach(drawing: Drawing, hub: number, target: number, displaced: number[]): { drawing: Drawing } | { error: string } | { occupied: true } {
  const freed = displaced.length > 0 ? applyOps(drawing, [{ op: "remove", atoms: displaced }]) : { ok: true as const, drawing }
  if (!freed.ok) return { error: freed.error }
  const mol = freed.drawing.molecule
  // A position is free only while it has a hydrogen to give up.
  if (atomHydrogens(mol, target).h < 1) return { occupied: true }
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

/** Whether a choice made is one of a condition's values: the same choice, or a member standing in for a class it names. */
function meets(choice: Choice, value: Alternative): boolean {
  if (value.kind === "class") return representativesOf(value).some((member) => same(member, choice))
  if (value.kind === "fragment" && choice.kind === "fragment") return value.name != null ? value.name === choice.name : JSON.stringify(value.molecule) === JSON.stringify(choice.molecule)
  return same(value, choice)
}

/** Whether a proviso rules out a combination: every condition is met by some placeholder of its variable. */
function excludedBy(proviso: Extract<Proviso, { kind: "combination" }>, picks: readonly Pick[]): boolean {
  return proviso.when.every((condition) => picks.some((pick) => pick.name === condition.name && "choice" in pick && condition.is.some((value) => meets(pick.choice, value))))
}

/** A laid-out formula ready to build: which formula, its sites with the choices that fit, and how many combinations they make. */
type Plan = { formula: number; layout: Exclude<Layout, { occupied: true }>; sites: Site[]; count: number }

/**
 * The separate generic formulas on a drawing: pieces held together by bonds or by a variable
 * attachment's line, that carry a variable or an attachment. Plain molecules beside them are
 * no part of any formula. A drawing with no variables at all is one "formula", itself.
 */
export function formulasOf(drawing: Drawing): Drawing[] {
  const mol = drawing.molecule
  const parent = new Map(mol.atoms.map((atom) => [atom.id, atom.id]))
  const root = (id: number): number => {
    let at = id
    while (parent.get(at) !== at) at = parent.get(at)!
    parent.set(id, at)
    return at
  }
  const join = (a: number, b: number) => parent.has(a) && parent.has(b) && parent.set(root(a), root(b))
  for (const bond of mol.bonds) join(bond.a, bond.b)
  for (const attachment of drawing.attachments ?? []) for (const id of attachment.to) join(attachment.atom, id)
  const names = new Set(Object.keys(drawing.variables ?? {}))
  const marked = new Set([
    ...mol.atoms.filter((atom) => atom.alias && (names.has(atom.alias) || isVariableName(atom.alias))).map((atom) => root(atom.id)),
    ...(drawing.attachments ?? []).map((attachment) => root(attachment.atom)),
  ])
  if (marked.size === 0) return [drawing]
  const pieces = new Map<number, number[]>()
  for (const atom of mol.atoms) if (marked.has(root(atom.id))) pieces.set(root(atom.id), [...(pieces.get(root(atom.id)) ?? []), atom.id])
  return [...pieces.values()].map((ids) => ({
    ...drawing,
    molecule: subMolecule(mol, ids),
    arrows: [],
    attachments: drawing.attachments?.filter((attachment) => ids.includes(attachment.atom)),
  }))
}

/**
 * Expands a generic formula into concrete molecules: every placement of each variable
 * attachment, and every combination of each placeholder's choices that fit where it sits,
 * each placeholder choosing on its own. A class ("(C1-C30)alkyl") is never expanded in
 * full; it is left out, or with `representatives` a few typical members inside its range
 * stand in for it. The result says which, and what was skipped as not fitting.
 */
export function enumerate(drawing: Drawing, options: EnumerateOptions = {}): Enumeration {
  const steps = enumerateSteps(drawing, options)
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

/**
 * enumerate() one step at a time, so a caller can spread the work out, show progress, or
 * stop early and keep what was made. It first lays out every attachment placement (one
 * step each), so `total` and the misfits are complete before any molecule is built, then
 * builds one combination per step. Every step yields the same result object, growing in
 * place: copy what you keep. The return value is exactly what enumerate() returns.
 */
export function* enumerateSteps(drawing: Drawing, { limit = 1000, representatives = false, identity, identifySmiles }: EnumerateOptions = {}): Generator<Enumeration, Enumeration> {
  /** The compounds made so far, by identity, when repeats are being dropped. */
  const seen = new Set<string>()
  const variables = drawing.variables ?? {}
  const defined = new Set(Object.keys(variables))
  const classesLeftOut: Record<string, number> = {}
  const represented: Record<string, Choice[]> = {}
  const misfits: Record<string, Choice[]> = {}
  /** Each variable's choices, counting its classes once however many atoms carry it. */
  const choicesOf = new Map<string, Choice[]>()
  /** For a piece made concrete, what the placeholders inside it became. */
  const inside = new WeakMap<Choice, Pick[]>()
  const misfit = (name: string, choice: Choice) => {
    if (!(misfits[name] ?? []).some((other) => same(other, choice))) misfits[name] = [...(misfits[name] ?? []), choice]
  }
  /** The sites of `drawing`'s placeholders, each with the choices that fit there (misfits noted). */
  const sitesOf = (drawing: Drawing, stack: string[]): Site[] =>
    placeholders(drawing).map(({ atom, name }) => {
      const where = siteKind(drawing, atom)
      const all = stack.includes(name) ? [] : choicesFor(name, stack)
      for (const choice of all) if (!fits(drawing, atom, where, choice)) misfit(name, choice)
      return { atom, name, where, choices: all.filter((choice) => fits(drawing, atom, where, choice)) }
    })
  /**
   * A variable's concrete choices: its own, representatives for its classes when asked, and
   * each piece with placeholders inside (Ar = N–R5) made concrete every way they can be.
   */
  function choicesFor(name: string, stack: string[] = []): Choice[] {
    const known = choicesOf.get(name)
    if (known) return known
    const alternatives = alternativesOf(variables, name)
    const choices: Choice[] = alternatives.flatMap((item) => (item.kind === "class" ? [] : [item]))
    for (const item of alternatives) {
      if (item.kind !== "class") continue
      const standIns = representatives ? representativesOf(item).filter((choice) => !choices.some((other) => same(other, choice))) : []
      if (standIns.length === 0) classesLeftOut[name] = (classesLeftOut[name] ?? 0) + 1
      choices.push(...standIns)
      if (standIns.length > 0) represented[name] = [...(represented[name] ?? []), ...standIns]
    }
    const concrete = choices.flatMap((choice) =>
      choice.kind === "fragment" && fragmentVariables(choice.molecule).some((inner) => defined.has(inner)) ? filled(choice, [...stack, name]) : [choice],
    )
    choicesOf.set(name, concrete)
    return concrete
  }
  /** Every concrete version of a piece, its inner placeholders filled with the choices that fit them. */
  function filled(piece: Extract<Choice, { kind: "fragment" }>, stack: string[]): Choice[] {
    if (stack.length > NESTING) return []
    const drawing: Drawing = { molecule: piece.molecule, arrows: [], nextArrowId: 1, variables }
    const sites = sitesOf(drawing, stack)
    const versions: Choice[] = []
    for (const index of odometer(sites.map((site) => site.choices.length))) {
      const chosen = sites.map((site, at) => ({ site, choice: site.choices[index[at]] }))
      const built = applyOps({ ...drawing, variables: undefined }, opsForAll(chosen))
      if (!built.ok) continue
      const version: Choice = { kind: "fragment", molecule: built.drawing.molecule, ...(piece.name != null ? { name: piece.name } : {}) }
      inside.set(version, chosen.flatMap(({ site, choice }) => [{ name: site.name, choice }, ...(inside.get(choice) ?? [])]))
      versions.push(version)
    }
    return versions
  }
  for (const { name } of placeholders(drawing)) choicesFor(name)
  const formulas = formulasOf(drawing)
  const result: Enumeration = {
    molecules: [],
    picks: [],
    total: 0,
    occupied: 0,
    classesLeftOut,
    represented,
    misfits,
    undefinedNames: undefinedVariables(drawing),
    onlyClasses: [],
    failures: [],
    failed: 0,
    duplicates: 0,
    formulas: formulas.length,
    formulaOf: [],
    excluded: 0,
    uncheckedCompounds: 0,
  }
  const provisos = drawing.provisos ?? []
  const combinations = provisos.flatMap((proviso) => (proviso.kind === "combination" ? [proviso] : []))
  // Excluded compounds, by identity, when both identities are at hand.
  const compounds = provisos.flatMap((proviso) => (proviso.kind === "compound" ? [proviso.smiles] : []))
  const excludedKeys = new Set(identity && identifySmiles ? compounds.flatMap((smiles) => identifySmiles(smiles) ?? []) : [])
  result.uncheckedCompounds = compounds.length - excludedKeys.size
  // Variables with nothing concrete: their formula cannot be expanded at all.
  const unfilled = new Set<string>()
  const plans: Plan[] = []
  for (const [index, formula] of formulas.entries()) {
    const top = new Set(placeholders(formula).map(({ name }) => name))
    const bare = [...top].filter((name) => choicesOf.get(name)!.length === 0)
    if (bare.length > 0) {
      for (const name of bare) unfilled.add(name)
      result.onlyClasses = [...unfilled]
      continue
    }
    for (const layout of layouts(formula)) {
      if ("occupied" in layout) {
        result.occupied++
        yield result
        continue
      }
      if ("error" in layout) {
        result.total++
        plans.push({ formula: index + 1, layout, sites: [], count: 0 })
        yield result
        continue
      }
      // Each way this layout can be: as drawn, and with each pair that may close a ring closed into each of its rings.
      const variants: Array<Exclude<Layout, { occupied: true } | { error: string }>> = [layout]
      for (const closure of drawing.ringClosures ?? []) {
        for (const ring of closure.ring) {
          if (ring.kind !== "fragment") continue
          const closed = closeRing(layout.drawing, closure, ring.molecule)
          if (closed) variants.push({ drawing: closed, where: [...layout.where, { name: `${closure.a}+${closure.b}`, choice: ring }] })
        }
      }
      for (const variant of variants) {
        const sites = sitesOf(variant.drawing, [])
        for (const site of sites) if (site.choices.length === 0) unfilled.add(site.name)
        const count = sites.reduce((product, site) => product * site.choices.length, 1)
        result.total += count
        result.onlyClasses = [...unfilled]
        plans.push({ formula: index + 1, layout: variant, sites, count })
      }
      yield result
    }
  }
  // Nothing at all could be laid out: only classes stand in the way.
  if (plans.length === 0 && unfilled.size > 0) return result

  const fail = (choice: Pick[], error: string) => {
    if (result.failed++ < 5) result.failures.push({ choice, error })
  }
  for (const { formula, layout, sites } of plans) {
    if ("error" in layout) {
      fail(layout.where, layout.error)
      continue
    }
    const laid = layout.drawing
    const strained = overValence(laid.molecule)
    for (const index of odometer(sites.map((site) => site.choices.length))) {
      if (result.molecules.length + result.failed >= limit) break
      const chosen = sites.map((site, at) => ({ site, choice: site.choices[index[at]] }))
      const picks: Pick[] = [...layout.where, ...chosen.flatMap(({ site, choice }) => [{ name: site.name, choice }, ...(inside.get(choice) ?? [])])]
      if (combinations.some((proviso) => excludedBy(proviso, picks))) {
        result.excluded++
        yield result
        continue
      }
      const built = applyOps({ ...laid, variables: undefined }, opsForAll(chosen))
      const wrong = built.ok ? (leftover(built.drawing.molecule, defined) ?? newlyOverValence(built.drawing.molecule, strained)) : built.error
      if (built.ok && !wrong) {
        const key = identity?.(built.drawing.molecule) ?? null
        if (key != null && excludedKeys.has(key)) result.excluded++
        else if (key != null && seen.has(key)) result.duplicates++
        else {
          if (key != null) seen.add(key)
          result.molecules.push(built.drawing.molecule)
          result.picks.push(picks)
          result.formulaOf.push(formula)
        }
      } else fail(picks, wrong!)
      yield result
    }
  }
  return result
}
