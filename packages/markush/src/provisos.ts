import type { Alternative, Choice, Proviso } from "@structura/core/types"
import type { Pick } from "./picks.ts"
import { representativesOf } from "./representatives.ts"
import { sameAlternative } from "./same.ts"

/** Whether a choice made is one of a condition's values: the same choice, or a member standing in for a class it names. */
function meets(choice: Choice, value: Alternative): boolean {
  if (value.kind === "class") return representativesOf(value).some((member) => sameAlternative(member, choice))
  if (value.kind === "fragment" && choice.kind === "fragment") return value.name != null ? value.name === choice.name : JSON.stringify(value.molecule) === JSON.stringify(choice.molecule)
  return sameAlternative(value, choice)
}

/** Whether a proviso rules out a combination: every condition is met by some placeholder of its variable. */
export function excludedBy(proviso: Extract<Proviso, { kind: "combination" }>, picks: readonly Pick[]): boolean {
  return proviso.when.every((condition) => picks.some((pick) => pick.name === condition.name && "choice" in pick && condition.is.some((value) => meets(pick.choice, value))))
}
