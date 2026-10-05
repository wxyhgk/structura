import { BRIDGES, GROUP_CLASSES } from "@structura/markush"
import { abbreviationList } from "@structura/core/templates"
import type { FillRequest } from "./types.ts"

// What Claude is told. The system prompt holds only what never changes between requests
// (the task and the editor's vocabulary), so it can be cached; the request's own variables
// and text go in the user message.

const CLASS_LIST = Object.entries(GROUP_CLASSES)
  .map(([name, { size, arity }]) => `- ${name}: size counted in ${size === "members" ? "ring members" : "carbon atoms"}${arity === 2 ? "; divalent, for a linker" : ""}`)
  .join("\n")

const ABBREVIATIONS = abbreviationList()
  .map(({ label, formula, attachments }) => `${label} (${formula}${attachments === 1 ? "" : `, ${attachments} bonds`})`)
  .join(", ")

export const SYSTEM_PROMPT = `You read the variable definitions of a patent's generic (Markush) formula and write them in the form a structure editor stores. A chemist has drawn the formula with placeholder atoms (R1, X, L…) and will review what you produce before it is applied, so be literal: say what the text says, and say plainly what you could not express.

Each variable is a list of alternatives. An alternative is one of:
- label: one atom label. An element symbol (H, D, F, Cl, Br, I, O, S, N, Si…) or exactly one of the abbreviations listed below, spelled as listed. Write "halogen" as four labels: F, Cl, Br, I. Do not invent labels: a specific group with no element symbol or listed abbreviation goes into unrepresented.
- bond: a direct single bond, for a linker ("L is a single bond").
- bridge: a divalent ring joining the two atoms a linker sits between, one of: ${Object.keys(BRIDGES).join(", ")}. Use these only when the text names that exact ring; a general class such as arylene is a class.
- class: a group class, as patent claims name them:
${CLASS_LIST}
  min and max are the size range ("C1-C30 alkyl": 1 and 30; "5- to 30-membered heteroaryl": 5 and 30), null when the text gives none. substituted is true for "substituted", false for "unsubstituted", null for "substituted or unsubstituted" or when the text does not say.

A variable may instead share another's list: "R2 is as defined for R1", or "R1 to R4 are each independently selected from …" (give the first its list and the rest sameAs the first). sameAs must name a variable that has a list of its own, never one that itself shares a list.

For each variable the text defines, quote the sentence that defines it in source. Put into unrepresented, quoted briefly from the text, every part of its definition this form cannot hold: which substituents a "substituted" group may carry, "adjacent groups may join to form a ring", "one or more CH2 may be replaced by O", provisos, groups with no label. Include variables the text defines even when they are not in the formula's list. Leave out variables the text does not define.

notes are for the chemist, in Chinese: an ambiguity and the reading you chose, a variable in the formula the text never defines, anything that should be checked. Keep them short; leave notes empty when there is nothing to say.

Abbreviations: ${ABBREVIATIONS}`

/** The request's variables and text, as the user message. */
export function userMessage(request: FillRequest): string {
  const variables = request.variables
    .map(({ name, linker, onDrawing, current }) => {
      const where = [linker ? "a linker between two atoms" : "a substituent", onDrawing ? null : "not drawn in the formula"].filter(Boolean).join(", ")
      return `- ${name} (${where})${current ? `; currently ${JSON.stringify(current)}` : ""}`
    })
    .join("\n")
  return `The formula's variables:\n${variables || "(none drawn yet)"}\n\nThe patent text:\n<patent>\n${request.text}\n</patent>`
}
