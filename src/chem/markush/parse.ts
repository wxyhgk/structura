import { knownLabel } from "../label.ts"
import type { Alternative, BridgeName } from "../types.ts"

// What text typed for a variable means, shared by the editor and anything else filling a
// formula (an agent reading a claim): "H, D, 卤素、CN" → H, D, F, Cl, Br, I, CN.

/** Words for several labels at once. */
const SHORTHANDS: Record<string, string[]> = { 卤素: ["F", "Cl", "Br", "I"], halogen: ["F", "Cl", "Br", "I"], 氢: ["H"], 氘: ["D"] }

/** Words for a direct bond, for a linker: "L is a single bond". */
const BOND_WORDS = new Set(["单键", "bond", "single bond"])

/** Names a divalent ring goes by, in the claim's language or in English. */
const BRIDGE_WORDS: Record<string, BridgeName> = {
  "p-phenylene": "p-phenylene",
  对亚苯基: "p-phenylene",
  "1,4-亚苯基": "p-phenylene",
  "m-phenylene": "m-phenylene",
  间亚苯基: "m-phenylene",
  "1,3-亚苯基": "m-phenylene",
  "4,4'-biphenylene": "4,4'-biphenylene",
  "4,4′-联亚苯基": "4,4'-biphenylene",
  联亚苯基: "4,4'-biphenylene",
  "2,5-pyridinediyl": "2,5-pyridinediyl",
  "2,5-亚吡啶基": "2,5-pyridinediyl",
}

const same = (a: Alternative, b: Alternative) => JSON.stringify(a) === JSON.stringify(b)

/** Longest first, so "4,4′-联亚苯基" is taken whole before "联亚苯基". */
const BRIDGE_ORDER = Object.keys(BRIDGE_WORDS).sort((a, b) => b.length - a.length)
const SEPARATOR = /[,，、;；\s]/

/**
 * The words of typed text. Ring names such as "2,5-亚吡啶基" contain commas, so they are
 * taken whole where they start; everything else is split at commas, 、, semicolons and spaces.
 */
function wordsOf(text: string): string[] {
  const words: string[] = []
  let word = ""
  for (let at = 0; at < text.length; ) {
    const name = word === "" ? BRIDGE_ORDER.find((candidate) => text.startsWith(candidate, at) && (at + candidate.length === text.length || SEPARATOR.test(text[at + candidate.length]))) : undefined
    if (name) {
      words.push(name)
      at += name.length
    } else if (SEPARATOR.test(text[at])) {
      if (word) words.push(word)
      word = ""
      at++
    } else {
      word += text[at++]
    }
  }
  if (word) words.push(word)
  return words
}

/**
 * The alternatives typed text adds to `existing`: labels an atom label understands, "单键",
 * divalent ring names and shorthands, without repeats. Words that mean none of these come
 * back as `rejected`, for the typist to fix (a range such as C1-C30 is a class, not a label).
 */
export function alternativesFromText(text: string, existing: Alternative[] = []): { add: Alternative[]; rejected: string[] } {
  const words = wordsOf(text)
  const add: Alternative[] = []
  const rejected: string[] = []
  const take = (alternative: Alternative) => {
    if (![...existing, ...add].some((other) => same(other, alternative))) add.push(alternative)
  }
  for (const word of words) {
    if (BOND_WORDS.has(word.toLowerCase())) take({ kind: "bond" })
    else if (Object.hasOwn(BRIDGE_WORDS, word)) take({ kind: "bridge", name: BRIDGE_WORDS[word] })
    else if (Object.hasOwn(SHORTHANDS, word.toLowerCase())) for (const label of SHORTHANDS[word.toLowerCase()]) take({ kind: "label", text: label })
    else if (knownLabel(word)) take({ kind: "label", text: word })
    else if (!rejected.includes(word)) rejected.push(word)
  }
  return { add, rejected }
}
