import { templateProblem, type ImportReport, type Template, type TemplateInput, type TemplateLibrary } from "@structura/markush"
import type { TemplateStore } from "./store.ts"

/** The parts of a template a user gives, in a fixed order, for telling whether two hold the same. */
function content(template: TemplateInput): string {
  const { name, aliases, group, site, alternative } = template
  return JSON.stringify({ name, aliases: aliases ?? [], group, site, alternative })
}

function inputOf(input: TemplateInput): TemplateInput {
  const { name, aliases, group, site, alternative } = input
  return { name: name.trim(), ...(aliases?.length ? { aliases: aliases.map((alias) => alias.trim()) } : {}), group: group.trim(), site, alternative }
}

/**
 * The user's templates kept in memory, behaving as the backend does (backend/API.md): for
 * tests, the browser tests, and a host with nowhere to keep them. Gone when the page is.
 */
export function memoryTemplateStore(initial: Template[] = []): TemplateStore {
  let templates: Template[] = initial.map((template) => structuredClone(template))
  const now = () => new Date().toISOString()
  const checked = (input: TemplateInput) => {
    const problem = templateProblem(input)
    if (problem) throw new Error(problem)
    return inputOf(input)
  }
  const find = (id: string) => {
    const found = templates.find((template) => template.id === id)
    if (!found) throw new Error(`no template ${id}`)
    return found
  }

  return {
    async list() {
      return structuredClone(templates)
    },
    async create(input) {
      const time = now()
      const template: Template = { ...checked(input), id: crypto.randomUUID(), source: "user", createdAt: time, updatedAt: time }
      templates = [...templates, template]
      return structuredClone(template)
    },
    async update(id, input) {
      const old = find(id)
      const template: Template = { ...checked(input), id, source: "user", createdAt: old.createdAt, updatedAt: now() }
      templates = templates.map((other) => (other.id === id ? template : other))
      return structuredClone(template)
    },
    async remove(id) {
      find(id)
      templates = templates.filter((template) => template.id !== id)
    },
    async exportLibrary() {
      return { format: "structura-templates", version: 1, templates: structuredClone(templates) }
    },
    async importLibrary(library: TemplateLibrary): Promise<ImportReport> {
      if (library?.format !== "structura-templates" || !Array.isArray(library.templates)) throw new Error("not a Structura template library")
      const report: ImportReport = { added: 0, skipped: 0, problems: [] }
      for (const [index, template] of library.templates.entries()) {
        const problem = templateProblem(template)
        if (problem) {
          report.problems.push(`template ${index + 1} (${String(template?.name)}): ${problem}`)
          continue
        }
        const same = templates.find((other) => other.id === template.id)
        if (same && content(same) === content(template)) {
          report.skipped += 1
          continue
        }
        const time = now()
        templates = [...templates, { ...inputOf(template), id: crypto.randomUUID(), source: "user", createdAt: template.createdAt ?? time, updatedAt: time }]
        report.added += 1
      }
      return report
    },
  }
}
