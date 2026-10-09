import type { Op } from "@structura/core/ops"
import type { Choice } from "@structura/core/markush"
import type { SiteKind } from "./sites.ts"

/** One placeholder atom, how it sits (see siteKind), and what it may become there. */
export type Site = { atom: number; name: string; choices: Choice[]; where: SiteKind }

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
export function opsForAll(chosen: Array<{ site: Site; choice: Choice }>): Op[] {
  const order = ({ site, choice }: (typeof chosen)[number]) =>
    site.where === "ring" ? 0 : site.where === "link" ? 1 : choice.kind === "label" && choice.text === "H" ? 3 : 2
  return [...chosen].sort((a, b) => order(a) - order(b)).flatMap(({ site, choice }) => opsFor(site, choice))
}
