import type { TemplateLibrary } from "@structura/markush"

/** The name a library is saved under. */
export const LIBRARY_FILE = "structura-templates.json"

/**
 * A template library read from a file's text. Only the file's shape is checked here; each
 * template is checked by the store, which takes the good ones and lists the rest.
 */
export function readLibrary(text: string): TemplateLibrary {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("文件不是 JSON，不是 Structura 模板库")
  }
  const library = data as Partial<TemplateLibrary> | null
  if (library?.format !== "structura-templates" || !Array.isArray(library.templates)) throw new Error("这不是 Structura 模板库文件")
  if (library.version !== 1) throw new Error(`不认识的模板库版本：${String(library.version)}`)
  return library as TemplateLibrary
}
