import { emptyDrawing, knownLabel } from "@structura/core"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, BridgeName, Molecule } from "@structura/core/types"

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

/** A piece built from ops, which are known good: anything else is a bug here. */
function pieceOf(ops: Op[]): Molecule {
  const built = applyOps(emptyDrawing(), ops)
  if (!built.ok) throw new Error(`could not build a piece: ${built.error}`)
  return built.drawing.molecule
}

/** "CR3", "NR5", "CR3R4", "SiR2R3": a ring member carrying variables, as drug patents write "X is N or CR3". */
const RING_MEMBER = /^(C|N|Si|P|B)((?:R\d+[a-z]?'?)+)$/

/**
 * A ring member with its variables on it, e.g. CR3: the atom takes both of the ring's bonds
 * (both "*" on it) and carries R3, so it can stand where X sits in a ring.
 */
function ringMember(element: string, variables: string[]): Alternative {
  const ops: Op[] = [{ op: "place_atom", el: element, at: { x: 0, y: 0 } }]
  for (const [index, name] of variables.entries()) ops.push({ op: "add_atom", el: "C", to: 1, as: `v${index}` }, { op: "label", atom: `v${index}`, text: name })
  for (const end of ["a", "b"]) ops.push({ op: "add_atom", el: "C", to: 1, as: end }, { op: "label", atom: end, text: "*" })
  return { kind: "fragment", molecule: pieceOf(ops), name: `${element}${variables.join("")}` }
}

/** "(CH2)2-4", "(CH2)1–3", "(CH2)3": a chain of CH2 linking two atoms, one alternative per length. */
const CHAIN = /^\(CH2\)(\d+)(?:[-–~](\d+))?$/

/** n CH2 between the two atoms a linker joins (0 is a direct bond). */
function chain(length: number): Alternative {
  if (length === 0) return { kind: "bond" }
  const ops: Op[] = [{ op: "add_atom", el: "C", as: "c1" }]
  for (let at = 2; at <= length; at++) ops.push({ op: "add_atom", el: "C", to: `c${at - 1}`, as: `c${at}` })
  ops.push({ op: "add_atom", el: "C", to: "c1", as: "a" }, { op: "label", atom: "a", text: "*" })
  ops.push({ op: "add_atom", el: "C", to: `c${length}`, as: "b" }, { op: "label", atom: "b", text: "*" })
  return { kind: "fragment", molecule: pieceOf(ops), name: length === 1 ? "CH2" : `(CH2)${length}` }
}

/** Ring members written with their hydrogen, which in a ring are just the element. */
const HYDRIDE_MEMBERS: Record<string, string> = { CH: "C", NH: "N", SiH: "Si" }

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
 * divalent ring names and shorthands, ring members with variables ("N, CR3" for "X is N or
 * CR3"; CH is C), and chains of CH2 ("(CH2)1-4", one per length, 0 a bond), without repeats. Words that mean none of these come
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
    const member = RING_MEMBER.exec(word)
    const lengths = CHAIN.exec(word)
    if (member) take(ringMember(member[1], member[2].match(/R\d+[a-z]?'?/g)!))
    else if (lengths) {
      const [from, to] = [Number(lengths[1]), Number(lengths[2] ?? lengths[1])]
      if (from > to || to > 12) rejected.push(word)
      else for (let length = from; length <= to; length++) take(chain(length))
    } else if (Object.hasOwn(HYDRIDE_MEMBERS, word)) take({ kind: "label", text: HYDRIDE_MEMBERS[word] })
    else if (BOND_WORDS.has(word.toLowerCase())) take({ kind: "bond" })
    else if (Object.hasOwn(BRIDGE_WORDS, word)) take({ kind: "bridge", name: BRIDGE_WORDS[word] })
    else if (Object.hasOwn(SHORTHANDS, word.toLowerCase())) for (const label of SHORTHANDS[word.toLowerCase()]) take({ kind: "label", text: label })
    else if (knownLabel(word)) take({ kind: "label", text: word })
    else if (!rejected.includes(word)) rejected.push(word)
  }
  return { add, rejected }
}
