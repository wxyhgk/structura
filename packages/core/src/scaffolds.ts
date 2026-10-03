// Scaffold templates: common ring systems with IUPAC-numbered sites, for placing whole,
// joining at an atom (carbazole's N9 to benzene's C1) or fusing at a lettered bond. An
// agent that reads a structure off a picture can rebuild it as a few add_scaffold ops.
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
