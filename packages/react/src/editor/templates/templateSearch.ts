import type { Alternative } from "@structura/core/types"
import type { Template, TemplateSite } from "@structura/markush"
import { describeAlternative } from "../markush/describe.ts"

// Finding templates in the library: by what they are called, by where they can stand, and
// on which shelf they sit. Pure, so the picker and the library panel show the same.

/** Text as searched: case, spaces and the kind of dash do not matter ("c1-c30" finds "C1–C30 烷基"). */
function folded(text: string): string {
  return text.toLowerCase().replace(/[‐-―−]/g, "-").replace(/\s+/g, "")
}

/** Whether a template's name or one of its other names holds the query; an empty query matches all. */
export function templateMatches(template: Template, query: string): boolean {
  const wanted = folded(query)
  if (!wanted) return true
  return [template.name, ...(template.aliases ?? [])].some((name) => folded(name).includes(wanted))
}

/** Built-ins first, then the user's, each in the order given. */
export function builtinsFirst(templates: Template[]): Template[] {
  return [...templates.filter((template) => template.source === "builtin"), ...templates.filter((template) => template.source !== "builtin")]
}

/** The templates to list: matching the query, and standing at `site` unless every site is asked for. */
export function filterTemplates(templates: Template[], { query = "", site, allSites = false }: { query?: string; site: TemplateSite; allSites?: boolean }): Template[] {
  return builtinsFirst(templates).filter((template) => (allSites || template.site === site) && templateMatches(template, query))
}

/**
 * The built-ins a card offers first for each site, as the old "常用" row did: the classes
 * claims name most, then a few everyday groups. The rest are a click away in the library.
 */
const FAVOURITES: Record<TemplateSite, string[]> = {
  end: ["builtin:alkyl-c1-c30", "builtin:aryl-c6-c30", "builtin:heteroaryl-c2-c30", "builtin:h", "builtin:f", "builtin:phenyl", "builtin:silyl", "builtin:amino"],
  link: ["builtin:bond", "builtin:arylene-c6-c30", "builtin:heteroarylene-c2-c30", "builtin:p-phenylene", "builtin:o-phenylene"],
  ring: ["builtin:ring-o", "builtin:ring-s", "builtin:ring-nh", "builtin:ring-cme2", "builtin:ring-nph"],
}

/** A card's quick picks for a site: the user's own newest first (up to half), then the favourite built-ins. */
export function quickPicks(templates: Template[], site: TemplateSite, limit = 8): Template[] {
  const fitting = filterTemplates(templates, { site })
  const mine = fitting.filter((template) => template.source === "user").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, Math.ceil(limit / 2))
  const byId = new Map(fitting.map((template) => [template.id, template]))
  const favourites = FAVOURITES[site].flatMap((id) => byId.get(id) ?? [])
  return [...mine, ...favourites].slice(0, limit)
}

/** Templates on their shelves, the shelves in the order they first appear. */
export function groupTemplates(templates: Template[]): Array<{ group: string; templates: Template[] }> {
  const shelves = new Map<string, Template[]>()
  for (const template of templates) shelves.set(template.group, [...(shelves.get(template.group) ?? []), template])
  return [...shelves].map(([group, items]) => ({ group, templates: items }))
}

/** Every shelf's name once, the user's own first (they are the likeliest for a new template), for suggestions. */
export function groupNames(templates: Template[]): string[] {
  const mine = templates.filter((template) => template.source === "user")
  return [...new Set([...mine, ...templates].map((template) => template.group))]
}

/** Whether a variable's list already holds this template's alternative. */
export function inList(alternatives: Alternative[], template: Template): boolean {
  const wanted = JSON.stringify(template.alternative)
  return alternatives.some((item) => JSON.stringify(item) === wanted)
}

/** "pyridyl, Py" typed in a field, as other names. */
export function aliasesFromText(text: string): string[] {
  return [...new Set(text.split(/[,，、;；]/).map((alias) => alias.trim()).filter(Boolean))]
}

/** What a template's chip says when hovered: what it adds, and its other names. */
export function templateTitle(template: Template): string {
  const aliases = template.aliases?.length ? `（也叫 ${template.aliases.join("、")}）` : ""
  return `${template.name}${aliases}：${describeAlternative(template.alternative)}`
}

export const SITE_NAMES: Record<TemplateSite, string> = { end: "末端", link: "连接基", ring: "环内" }
