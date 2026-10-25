import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { forgetUnsaved, keepUnsaved, readUnsaved } from "@/autosave"
import { httpTemplateStore, memoryTemplateStore, type EditorHandle, type Theme } from "chem-structura"
import { recognizeOverHttp } from "@/recognizeOverHttp"
import { RestoreBar } from "@/RestoreBar"
import { takeHandoff } from "@/handoff"
import { exposeForTests } from "@/testHook"

/** The user's templates: the backend's; in the browser tests' build, kept in memory so they need no backend. */
const templateStore = import.meta.env.MODE === "e2e" ? memoryTemplateStore() : httpTemplateStore()

const THEME = "structura:theme"

/** The theme chosen in 查看 on an earlier visit; following the system until one is. */
function readTheme(): Theme {
  try {
    const kept = localStorage.getItem(THEME)
    return kept === "light" || kept === "dark" || kept === "auto" ? kept : "auto"
  } catch {
    return "auto"
  }
}

/** What every page gives its editor: the shared settings and the hooks that guard unsaved work. */
export type PageEditorProps = {
  ref: RefObject<EditorHandle | null>
  initialDocument?: string
  theme: Theme
  onThemeChange: (theme: Theme) => void
  recognizeStructure: typeof recognizeOverHttp
  templateStore: typeof templateStore
  onDirtyChange: (dirty: boolean) => void
  onDocumentChange: (document: string) => void
}

/**
 * One of the app's pages: its editor filling the page, reaching the model through the app's
 * own server. It guards unsaved work: a warning before the page goes, and a copy in this
 * browser under `storageKey` (offered back on the next visit) while there are changes not saved
 * to a file. A document handed over from the other page (handoff.ts) is where it starts.
 */
export function EditorPage({ storageKey, what, children }: { storageKey: string; what: string; children: (props: PageEditorProps) => ReactNode }) {
  const editor = useRef<EditorHandle>(null)
  const dirty = useRef(false)
  const [handed] = useState(takeHandoff)
  const [unsaved, setUnsaved] = useState(() => (handed ? null : readUnsaved(storageKey)))
  const [theme, setTheme] = useState(readTheme)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => exposeForTests(editor.current), [])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      {unsaved && (
        <RestoreBar
          unsaved={unsaved}
          what={what}
          onRestore={() => {
            editor.current?.setDocument(unsaved.document)
            setUnsaved(null)
          }}
          onDiscard={() => {
            forgetUnsaved(storageKey)
            setUnsaved(null)
          }}
        />
      )}
      <div className="min-h-0 flex-1">
        {children({
          ref: editor,
          initialDocument: handed ?? undefined,
          theme,
          onThemeChange(next) {
            setTheme(next)
            try {
              localStorage.setItem(THEME, next)
            } catch {
              // No storage: the choice lasts this visit.
            }
          },
          recognizeStructure: recognizeOverHttp,
          templateStore,
          onDirtyChange(now) {
            const was = dirty.current
            dirty.current = now
            // Saved (or a new page): the copy is no longer needed. Not on the first report at
            // start, which would drop last time's copy before it could be restored.
            if (was && !now) {
              clearTimeout(timer.current)
              forgetUnsaved(storageKey)
            }
          },
          onDocumentChange(document) {
            // Kept a moment after the last edit, not on every one.
            clearTimeout(timer.current)
            timer.current = setTimeout(() => dirty.current && keepUnsaved(storageKey, document), 600)
          },
        })}
      </div>
    </div>
  )
}
