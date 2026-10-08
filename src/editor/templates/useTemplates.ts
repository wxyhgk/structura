import { useCallback, useEffect, useMemo, useState } from "react"
import { builtinTemplates, type ImportReport, type Template, type TemplateInput } from "@structura/markush"
import { download } from "@/editor/browser"
import { LIBRARY_FILE, readLibrary } from "./libraryFile.ts"
import type { TemplateStore } from "./store.ts"

/** Loading the user's templates; ready with them; or offline, with only the built-ins. */
export type TemplatesStatus = "loading" | "ready" | "offline"

/** The template library as the editor uses it: built-ins and the user's, and the ways to change the user's. */
export type Templates = {
  /** Built-ins first, then the user's, oldest first. */
  templates: Template[]
  status: TemplatesStatus
  /** Why the user's templates could not be loaded, while offline. */
  error: string | null
  /** Makes a new template of the user's, or (with `id`) changes one; throws when the store refuses. */
  save(input: TemplateInput, id?: string): Promise<Template>
  remove(id: string): Promise<void>
  /** Downloads the user's templates as a library file. */
  exportFile(): Promise<void>
  /** Adds the templates in a library file to the user's. */
  importFile(file: File): Promise<ImportReport>
}

/** What the user is told while the user's templates cannot be reached. */
export const OFFLINE_NOTE = "自定义模板需要后端（npm run backend）"

/**
 * The template library: the built-ins, always there, and the user's own from `store` (the
 * backend). Without a store, or when it cannot be reached, it is offline: the built-ins still
 * work, and changing the user's templates says why it cannot.
 */
export function useTemplates(store?: TemplateStore): Templates {
  const builtins = useMemo(() => builtinTemplates(), [])
  const [mine, setMine] = useState<Template[]>([])
  const [status, setStatus] = useState<TemplatesStatus>(store ? "loading" : "offline")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!store) return
    let live = true
    store.list().then(
      (templates) => {
        if (!live) return
        setMine(templates)
        setStatus("ready")
        setError(null)
      },
      (failure: unknown) => {
        if (!live) return
        setStatus("offline")
        setError(failure instanceof Error ? failure.message : String(failure))
      },
    )
    return () => {
      live = false
    }
  }, [store])

  const ready = useCallback((): TemplateStore => {
    if (!store || status !== "ready") throw new Error(OFFLINE_NOTE)
    return store
  }, [store, status])

  const save = useCallback(
    async (input: TemplateInput, id?: string) => {
      const target = ready()
      const saved = id ? await target.update(id, input) : await target.create(input)
      setMine((templates) => (id ? templates.map((template) => (template.id === id ? saved : template)) : [...templates, saved]))
      return saved
    },
    [ready],
  )

  const remove = useCallback(
    async (id: string) => {
      await ready().remove(id)
      setMine((templates) => templates.filter((template) => template.id !== id))
    },
    [ready],
  )

  const exportFile = useCallback(async () => {
    const library = await ready().exportLibrary()
    download(LIBRARY_FILE, `${JSON.stringify(library, null, 2)}\n`, "application/json")
  }, [ready])

  const importFile = useCallback(
    async (file: File) => {
      const target = ready()
      const report = await target.importLibrary(readLibrary(await file.text()))
      setMine(await target.list())
      return report
    },
    [ready],
  )

  // The user's own first: the library shows shelves in the order they first appear, and theirs are the likeliest wanted.
  const templates = useMemo(() => [...mine, ...builtins], [builtins, mine])
  return { templates, status, error, save, remove, exportFile, importFile }
}
