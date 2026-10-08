import type { ImportReport, Template, TemplateInput, TemplateLibrary } from "@structura/core/markush"

/**
 * Where the user's own templates are kept. The standalone app talks to the Structura backend
 * (backend/API.md); a host embedding the editor can hand in its own. Built-in templates are
 * not here: they come with the app.
 */
export type TemplateStore = {
  list(): Promise<Template[]>
  create(input: TemplateInput): Promise<Template>
  update(id: string, input: TemplateInput): Promise<Template>
  remove(id: string): Promise<void>
  exportLibrary(): Promise<TemplateLibrary>
  importLibrary(library: TemplateLibrary): Promise<ImportReport>
}
