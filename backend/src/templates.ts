import { randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { libraryProblem, templateProblem, type ImportReport, type Template, type TemplateInput, type TemplateLibrary } from "@structura/markush"

// The user's templates in the database: plain functions over an open handle. Every template
// is checked with templateProblem before it is stored; what comes back is always a Template.

/** A template or library that will not do; the HTTP layer answers it with 400. */
export class InvalidInput extends Error {}

type Row = { id: string; name: string; aliases: string; group_name: string; site: string; alternative: string; created_at: string; updated_at: string }

const COLUMNS = "id, name, aliases, group_name, site, alternative, created_at, updated_at"

const fromRow = (row: Row): Template => ({
  id: row.id,
  name: row.name,
  aliases: JSON.parse(row.aliases) as string[],
  group: row.group_name,
  site: row.site as Template["site"],
  alternative: JSON.parse(row.alternative) as Template["alternative"],
  source: "user",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/** Only the fields a template is made of, tidied: anything else a client sends is dropped. */
function cleaned(input: TemplateInput): TemplateInput {
  const problem = templateProblem(input)
  if (problem) throw new InvalidInput(problem)
  return {
    name: input.name.trim(),
    aliases: (input.aliases ?? []).map((alias) => alias.trim()),
    group: input.group.trim(),
    site: input.site,
    alternative: input.alternative,
  }
}

const now = () => new Date().toISOString()

/** `value` as an ISO 8601 UTC time, or null when it is not a time. */
function isoTime(value: unknown): string | null {
  if (typeof value !== "string") return null
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? null : time.toISOString()
}

function insert(db: DatabaseSync, input: TemplateInput, createdAt: string, updatedAt: string): Template {
  const id = randomUUID()
  db.prepare(`INSERT INTO templates (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    input.name,
    JSON.stringify(input.aliases ?? []),
    input.group,
    input.site,
    JSON.stringify(input.alternative),
    createdAt,
    updatedAt,
  )
  // Read back, so the answer is exactly what is stored (JSON drops undefined fields).
  return getTemplate(db, id) as Template
}

/** How many templates the user has. */
export function countTemplates(db: DatabaseSync): number {
  return (db.prepare("SELECT count(*) AS n FROM templates").get() as { n: number }).n
}

/** The user's templates, oldest first. */
export function listTemplates(db: DatabaseSync): Template[] {
  return (db.prepare(`SELECT ${COLUMNS} FROM templates ORDER BY created_at, rowid`).all() as Row[]).map(fromRow)
}

/** The template with this id, or null. */
export function getTemplate(db: DatabaseSync, id: string): Template | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM templates WHERE id = ?`).get(id) as Row | undefined
  return row ? fromRow(row) : null
}

/** Stores a new template of the user's; throws InvalidInput if it will not do. */
export function createTemplate(db: DatabaseSync, input: TemplateInput): Template {
  const time = now()
  return insert(db, cleaned(input), time, time)
}

/** Replaces a template's content, keeping its id and createdAt; null if there is no such template. */
export function updateTemplate(db: DatabaseSync, id: string, input: TemplateInput): Template | null {
  const template = cleaned(input)
  const updatedAt = now()
  const result = db
    .prepare("UPDATE templates SET name = ?, aliases = ?, group_name = ?, site = ?, alternative = ?, updated_at = ? WHERE id = ?")
    .run(template.name, JSON.stringify(template.aliases), template.group, template.site, JSON.stringify(template.alternative), updatedAt, id)
  return result.changes === 0 ? null : getTemplate(db, id)
}

/** Deletes a template; false if there was none. */
export function removeTemplate(db: DatabaseSync, id: string): boolean {
  return db.prepare("DELETE FROM templates WHERE id = ?").run(id).changes > 0
}

/** Every template of the user's as a library file. */
export function exportLibrary(db: DatabaseSync): TemplateLibrary {
  return { format: "structura-templates", version: 1, templates: listTemplates(db) }
}

/** JSON with object keys sorted, so two equal values give the same text whatever their key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
    return `{${entries
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

/** What makes two templates the same, whatever their ids and times. */
const content = (template: TemplateInput) =>
  canonical({ name: template.name, aliases: template.aliases ?? [], group: template.group, site: template.site, alternative: template.alternative })

/**
 * Adds a library file's templates as the user's. The file itself must be a library (else
 * InvalidInput); each template in it is checked on its own, and a bad one is listed and
 * skipped. One already stored under the same id with the same content is skipped; every other
 * gets a new id, keeping its createdAt. All of it goes in at once or not at all.
 */
export function importLibrary(db: DatabaseSync, library: TemplateLibrary): ImportReport {
  const shape = typeof library === "object" && library != null ? libraryProblem({ ...library, templates: [] }) : libraryProblem(library)
  if (shape) throw new InvalidInput(shape)
  if (!Array.isArray(library.templates)) throw new InvalidInput("a library has a list of templates")
  const report: ImportReport = { added: 0, skipped: 0, problems: [] }
  db.exec("BEGIN")
  try {
    for (const [index, template] of library.templates.entries()) {
      const problem = templateProblem(template)
      if (problem) {
        report.problems.push(`template ${index + 1} (${String(template?.name)}): ${problem}`)
        continue
      }
      const input = cleaned(template)
      const stored = typeof template.id === "string" ? getTemplate(db, template.id) : null
      if (stored && content(stored) === content(input)) {
        report.skipped++
        continue
      }
      const time = now()
      const createdAt = isoTime(template.createdAt) ?? time
      insert(db, input, createdAt, isoTime(template.updatedAt) ?? createdAt)
      report.added++
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
  return report
}
