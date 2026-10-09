import { alternativeProblem, fragmentEnds } from "@structura/core/markush"
import type { Alternative } from "@structura/core/types"

// The group library: named alternatives kept to be reused, built in or the user's own. A
// template is an alternative as a variable holds it (a drawn piece with its sites, a class,
// a label…), plus what the library needs to find and sort it. Where the user's templates are
// kept (a server's database, a file) is the host's business; this is only their shape.

/** Where a template can stand: the end of a branch (R1), between two atoms (L), or inside a ring (X). */
export type TemplateSite = "end" | "link" | "ring"

export const TEMPLATE_SITES: readonly TemplateSite[] = ["end", "link", "ring"]

/** What the user gives when making or changing a template. */
export type TemplateInput = {
  name: string
  /** Other names it is found by ("pyridyl", "Py"). */
  aliases?: string[]
  /** The shelf it sits on in the library ("杂芳基", "烷基"…). */
  group: string
  site: TemplateSite
  alternative: Alternative
}

export type Template = TemplateInput & {
  id: string
  /** Built-in templates come with the app and cannot be changed; the user's own can. */
  source: "builtin" | "user"
  /** ISO 8601 times. */
  createdAt: string
  updatedAt: string
}

/** A library as a file, for backing up or handing templates on. */
export type TemplateLibrary = { format: "structura-templates"; version: 1; templates: Template[] }

/** What importing a library did. */
export type ImportReport = { added: number; skipped: number; problems: string[] }

const MOST_ALIASES = 10

/** Why a template will not do, or null. Its alternative must suit its site: a drawn piece's "*" marks say where it stands. */
export function templateProblem(input: TemplateInput): string | null {
  if (typeof input !== "object" || input == null) return "a template is an object"
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name || name.length > 60) return "a template's name is 1 to 60 characters"
  const group = typeof input.group === "string" ? input.group.trim() : ""
  if (!group || group.length > 30) return "a template's group is 1 to 30 characters"
  if (input.aliases != null) {
    if (!Array.isArray(input.aliases) || input.aliases.length > MOST_ALIASES) return `a template has at most ${MOST_ALIASES} other names`
    if (input.aliases.some((alias) => typeof alias !== "string" || !alias.trim() || alias.length > 40)) return "another name is 1 to 40 characters"
  }
  if (!TEMPLATE_SITES.includes(input.site)) return `a template's site is one of ${TEMPLATE_SITES.join(", ")}`
  const alternative = input.alternative
  if (typeof alternative !== "object" || alternative == null) return "a template holds an alternative"
  const problem = alternativeProblem(alternative)
  if (problem) return problem
  return siteMismatch(input.site, alternative)
}

/** Why an alternative cannot stand at that site, or null. */
function siteMismatch(site: TemplateSite, alternative: Alternative): string | null {
  if ((alternative.kind === "bond" || alternative.kind === "bridge") && site !== "link") return "a bond or a divalent ring only links two atoms (site link)"
  if (alternative.kind !== "fragment") return null
  const ends = fragmentEnds(alternative.molecule)
  const heads = new Set(ends.map((end) => end.head))
  if (site === "end" && ends.length !== 1) return "a group (site end) is a piece with one *"
  // A linker joins by two atoms (p-phenylene), or by one atom bonded twice (–C(=O)–).
  if (site === "link" && ends.length !== 2) return "a linker (site link) is a piece with two *: one on each of two atoms, or both on one atom"
  if (site === "ring" && (ends.length !== 2 || heads.size !== 1)) return "a ring atom (site ring) is a piece with both * on one atom"
  return null
}

/** Why a library file will not do, or null; each template is checked as well. */
export function libraryProblem(library: TemplateLibrary): string | null {
  if (typeof library !== "object" || library == null || library.format !== "structura-templates") return "not a Structura template library"
  if (library.version !== 1) return `unknown template library version ${String(library.version)}`
  if (!Array.isArray(library.templates)) return "a library has a list of templates"
  for (const [index, template] of library.templates.entries()) {
    const problem = templateProblem(template)
    if (problem) return `template ${index + 1} (${String(template?.name)}): ${problem}`
  }
  return null
}
