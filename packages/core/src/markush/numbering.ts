import type { CompoundNumbering } from "./types.ts"

/** How compounds are numbered until the document says otherwise: C-1, C-2… */
export const DEFAULT_NUMBERING: CompoundNumbering = { pattern: "C-{n}", start: 1 }

/** Why a generation setting cannot be kept, or null when it can. */
export function generationProblem(generation: unknown): string | null {
  if (typeof generation !== "object" || generation === null || Array.isArray(generation)) return "the generation settings are not an object"
  const { representatives, dedupe, limit } = generation as Record<string, unknown>
  if (representatives !== undefined && typeof representatives !== "boolean") return "the generation setting 'representatives' is not true or false"
  if (dedupe !== undefined && typeof dedupe !== "boolean") return "the generation setting 'dedupe' is not true or false"
  if (limit !== undefined && !(Number.isInteger(limit) && (limit as number) >= 1 && (limit as number) <= 1_000_000)) return "the generation limit is not a whole number of at least 1"
  return null
}

/** Why a numbering cannot be kept, or null when it can. */
export function numberingProblem(numbering: unknown): string | null {
  if (typeof numbering !== "object" || numbering === null || Array.isArray(numbering)) return "the compound numbering is not an object"
  const { pattern, start, assigned } = numbering as Record<string, unknown>
  if (typeof pattern !== "string" || pattern.length > 100) return "the numbering pattern is not text"
  if (!Number.isSafeInteger(start)) return "the first compound number is not a whole number"
  if (assigned === undefined) return null
  if (typeof assigned !== "object" || assigned === null || Array.isArray(assigned)) return "the assigned compound numbers are not an object"
  const used = new Set<number>()
  for (const [key, number] of Object.entries(assigned)) {
    if (!key || key.length > 20_000) return "a compound's identity is empty or too long"
    if (!Number.isSafeInteger(number)) return "an assigned compound number is not a whole number"
    if (used.has(number as number)) return `the compound number ${String(number)} is given to two compounds`
    used.add(number as number)
  }
  return null
}

/** The number the next new compound gets: one past the highest given out, or `start` when none was. */
export function nextNumber(numbering: CompoundNumbering): number {
  let highest: number | null = null
  for (const number of Object.values(numbering.assigned ?? {})) if (highest == null || number > highest) highest = number
  return highest == null ? numbering.start : highest + 1
}

/**
 * Gives each identity in `keys` (in this order) a number, those that have one already
 * keeping it; new ones follow the highest number given out. Returns the same numbering when
 * nothing is new.
 */
export function assignNumbers(numbering: CompoundNumbering, keys: readonly string[]): CompoundNumbering {
  const assigned = numbering.assigned ?? {}
  const fresh = [...new Set(keys)].filter((key) => !Object.hasOwn(assigned, key))
  if (fresh.length === 0) return numbering
  let next = nextNumber(numbering)
  const added: Record<string, number> = {}
  for (const key of fresh) added[key] = next++
  return { ...numbering, assigned: { ...assigned, ...added } }
}
