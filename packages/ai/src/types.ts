import type { Alternative, GroupClass, Variable } from "@structura/core/types"

/** What the editor sends: the claim text and the formula's variables as they stand. */
export type FillRequest = {
  /** The patent text that defines the variables (a claim, or the paragraphs after the formula). */
  text: string
  variables: Array<{
    name: string
    /** It sits between two atoms (like L), so a bond or a divalent ring can stand for it. */
    linker: boolean
    /** Drawn on the formula, rather than only defined. */
    onDrawing: boolean
    /** Its current definition, if it has one. */
    current: Variable | null
  }>
}

/** One alternative as Claude writes it: every field present, null for "not stated". */
export type AnswerAlternative =
  | { kind: "label"; text: string }
  | { kind: "bond" }
  | { kind: "bridge"; name: string }
  | { kind: "class"; class: GroupClass; min: number | null; max: number | null; substituted: boolean | null }

/** Claude's reading of the text, in the shape of ANSWER_SCHEMA. */
export type FillAnswer = {
  variables: Array<{
    name: string
    /** The sentence of the text that defines it, quoted. */
    source: string
    /** Another variable whose list it shares ("R3 is as defined for R1"), or null. */
    sameAs: string | null
    alternatives: AnswerAlternative[]
    /** Parts of its definition the editor cannot express, quoted from the text. */
    unrepresented: string[]
  }>
  /** Anything else to check, in Chinese. */
  notes: string[]
}

/** Where the standalone app's dev server answers FillRequests (POST, JSON). */
export const FILL_PATH = "/api/ai/variables"

/** What the server hands back for a FillRequest. */
export type FillResult = { ok: true; answer: FillAnswer } | { ok: false; error: string }

export type { Alternative }
