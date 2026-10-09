import type { Choice } from "@structura/core/markush"
import { fragmentFormula } from "@structura/core/markush"

/** One thing in a combination: a placeholder's choice, or where an attachment was made. */
export type Pick = { name: string; choice: Choice } | { name: string; position: string }

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
