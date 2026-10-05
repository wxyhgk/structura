// Scaffold templates: common ring systems with IUPAC-numbered sites, for placing whole,
// joining at an atom (carbazole's N9 to benzene's C1) or fusing at a lettered bond. An
// agent that reads a structure off a picture can rebuild it as a few add_scaffold ops.
import { atomHydrogens } from "./formula.ts"
import { buildScaffold, type Scaffold } from "./scaffolds/build.ts"
import { SCAFFOLD_SPECS } from "./scaffolds/catalog.ts"

export type { Scaffold }

let built: Scaffold[] | null = null

/** Every scaffold, in catalogue order (single rings, then bicyclic, then tricyclic). */
export function scaffolds(): Scaffold[] {
  built ??= SCAFFOLD_SPECS.map(buildScaffold)
  return built
}

export function scaffoldNamed(name: string): Scaffold | undefined {
  return scaffolds().find((scaffold) => scaffold.name === name)
}

/** The atom of a site: "C3", "N9", or the bare number "3" or "9". */
export function siteAtom(scaffold: Scaffold, site: string): number | undefined {
  if (Object.hasOwn(scaffold.atoms, site)) return scaffold.atoms[site]
  const found = Object.keys(scaffold.atoms).find((locant) => locant.replace(/^[A-Z][a-z]?/, "") === site)
  return found ? scaffold.atoms[found] : undefined
}

/** For an agent's prompt: each scaffold with its sites and bond letters, one line each. */
export function scaffoldCatalog(): string {
  return scaffolds()
    .map((scaffold) => {
      const locants = Object.entries(scaffold.atoms)
      const name = (id: number) => locants.find(([, atom]) => atom === id)![0]
      const edges = Object.entries(scaffold.edges).map(([letter, [a, b]]) => `${letter}=${name(a)}-${name(b)}`)
      return `${scaffold.name} (${scaffold.zh}): atoms ${locants.map(([locant]) => locant).join(" ")}; bonds ${edges.join(" ")}`
    })
    .join("\n")
}

/** Locants of atoms that can take a substituent (they still carry a hydrogen), in numbering order. */
export function freeSites(scaffold: Scaffold): string[] {
  return Object.entries(scaffold.atoms)
    .filter(([, atom]) => atomHydrogens(scaffold.molecule, atom).h > 0)
    .map(([locant]) => locant)
}

/** Where it joins when nothing else is said: its N–H if it has one (carbazole's N9), else its first free site. */
export function defaultSite(scaffold: Scaffold): string {
  const sites = freeSites(scaffold)
  return sites.find((locant) => !locant.startsWith("C")) ?? sites[0]
}

/**
 * Bonds it can fuse by: outer bonds between two carbons that both still carry a hydrogen.
 * A heteroatom would turn into the drawing's atom, and a fusion atom has no room left.
 */
export function fusableEdges(scaffold: Scaffold): string[] {
  const free = new Set(freeSites(scaffold).map((locant) => scaffold.atoms[locant]))
  const carbon = (id: number) => scaffold.molecule.atoms.find((atom) => atom.id === id)?.el === "C"
  return Object.entries(scaffold.edges)
    .filter(([, ends]) => ends.every((id) => free.has(id) && carbon(id)))
    .map(([letter]) => letter)
}

/** The bond it fuses by when nothing else is said: its first fusable one (furan's b, pyridine's b, benzene's a). */
export function defaultEdge(scaffold: Scaffold): string {
  return fusableEdges(scaffold)[0] ?? "a"
}

/** Scaffolds whose English or Chinese name contains `text`, those starting with it first. */
export function matchScaffolds(text: string): Scaffold[] {
  const words = text.trim().toLowerCase()
  if (!words) return scaffolds()
  const starts = (item: Scaffold) => item.name.startsWith(words) || item.zh.startsWith(words)
  const hits = scaffolds().filter((item) => item.name.includes(words) || item.zh.includes(words))
  return [...hits.filter(starts), ...hits.filter((item) => !starts(item))]
}
