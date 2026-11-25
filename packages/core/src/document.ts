import { markushProblem } from "./markush/problems.ts"
import type { Drawing } from "./types.ts"
import { errorsOf, validateDrawing } from "./validate.ts"

// Structura's own file: the whole drawing as JSON, including what MOL files cannot hold,
// such as a generic formula's variables.

const FORMAT = "structura"
const VERSION = 1

export function toDocument(drawing: Drawing): string {
  return `${JSON.stringify({ format: FORMAT, version: VERSION, drawing }, null, 2)}\n`
}

/** Whether text looks like a Structura file, before trying to read it. */
export function isDocument(text: string): boolean {
  return /^\s*\{[\s\S]*"format"\s*:\s*"structura"/.test(text.slice(0, 200))
}

/** The keys of T that may be left out. */
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T]

/**
 * The drawing's optional parts, each kept from a file as it is (the bracket counter is worked
 * out, below). Every optional field of Drawing must be here, or it fails to compile: a field
 * left out would be dropped from every file opened, and saved without it.
 */
const PARTS: Record<Exclude<OptionalKeys<Drawing>, "nextBracketId">, true> = {
  variables: true,
  attachments: true,
  provisos: true,
  ringClosures: true,
  brackets: true,
  generation: true,
  numbering: true,
}
const PART_KEYS = Object.keys(PARTS) as Array<keyof typeof PARTS>

/** The bracket counter as saved, or one past the highest id when a file left it out. */
function bracketCounter(drawing: Partial<Drawing>): Pick<Drawing, "nextBracketId"> {
  if (drawing.nextBracketId != null) return { nextBracketId: drawing.nextBracketId }
  if (!Array.isArray(drawing.brackets) || drawing.brackets.length === 0) return {}
  return { nextBracketId: Math.max(0, ...drawing.brackets.map((bracket) => (Number.isInteger(bracket?.id) ? bracket.id : 0))) + 1 }
}

/** Reads a Structura file; the error says why when it cannot be used as it is. */
export function readDocument(text: string): { drawing: Drawing } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: "not valid JSON" }
  }
  const file = parsed as { format?: unknown; version?: unknown; drawing?: Partial<Drawing> }
  if (file?.format !== FORMAT) return { error: "not a Structura file" }
  if (typeof file.version !== "number" || file.version > VERSION) return { error: `made by a newer Structura (version ${String(file.version)})` }
  const drawing = file.drawing
  const molecule = drawing?.molecule
  if (!drawing || !molecule || !Array.isArray(molecule.atoms) || !Array.isArray(molecule.bonds) || !Array.isArray(molecule.groups ?? []) || !Array.isArray(drawing.arrows)) {
    return { error: "the drawing is incomplete" }
  }
  if (![molecule.nextAtomId, molecule.nextBondId].every(Number.isInteger)) return { error: "the drawing's id counters are missing" }
  // A counter or id that is text or a fraction ("7", 1.5) slips past the checks below (an
  // id is compared with it, not counted up from it) and breaks the next edit: "7" + 1 is "71".
  if (![molecule.nextGroupId ?? 1, drawing.nextArrowId ?? 1, drawing.nextBracketId ?? 1].every(Number.isInteger)) {
    return { error: "the drawing's id counters must be whole numbers" }
  }
  const items: unknown[] = [...molecule.atoms, ...molecule.bonds, ...(molecule.groups ?? []), ...drawing.arrows, ...(Array.isArray(drawing.brackets) ? drawing.brackets : [])]
  if (items.some((item) => typeof item === "object" && item !== null && !Number.isInteger((item as { id?: unknown }).id))) {
    return { error: "every atom, bond, group, arrow and bracket needs a whole-number id" }
  }
  const whole: Drawing = {
    molecule: { ...molecule, groups: molecule.groups ?? [], nextGroupId: molecule.nextGroupId ?? 1 },
    arrows: drawing.arrows,
    nextArrowId: drawing.nextArrowId ?? 1,
    ...Object.fromEntries(PART_KEYS.filter((key) => drawing[key] != null).map((key) => [key, drawing[key]])),
    ...bracketCounter(drawing),
  }
  // The checks assume parts of the right shape; one that is not (an atom that is null, a
  // variable that is a number) makes a check throw, and is refused like any other fault.
  let problem: string | null
  try {
    problem = errorsOf(validateDrawing(whole))[0]?.message ?? markushProblem(whole)
  } catch {
    problem = "the drawing has parts of the wrong shape"
  }
  return problem ? { error: problem } : { drawing: whole }
}
