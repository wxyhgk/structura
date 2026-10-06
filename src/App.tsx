import { useEffect, useRef, useState } from "react"
import { forgetUnsaved, keepUnsaved, readUnsaved } from "@/autosave"
import { Editor, type EditorHandle } from "@/editor/Editor"
import { fillOverHttp } from "@/fillOverHttp"
import { recognizeOverHttp } from "@/recognizeOverHttp"
import { RestoreBar } from "@/RestoreBar"
import { exposeForTests } from "@/testHook"

/**
 * The standalone app: the editor filling the whole page, reaching the model through its own
 * server. It guards unsaved work: a warning before the page goes, and a copy in this browser
 * (offered back on the next visit) while there are changes not saved to a file.
 */
export default function App() {
  const editor = useRef<EditorHandle>(null)
  const dirty = useRef(false)
  const [unsaved, setUnsaved] = useState(readUnsaved)
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
          onRestore={() => {
            editor.current?.setDocument(unsaved.document)
            setUnsaved(null)
          }}
          onDiscard={() => {
            forgetUnsaved()
            setUnsaved(null)
          }}
        />
      )}
      <div className="min-h-0 flex-1">
        <Editor
          ref={editor}
          fillVariables={fillOverHttp}
          recognizeStructure={recognizeOverHttp}
          onDirtyChange={(now) => {
            const was = dirty.current
            dirty.current = now
            // Saved (or a new page): the copy is no longer needed. Not on the first report at
            // start, which would drop last time's copy before it could be restored.
            if (was && !now) {
              clearTimeout(timer.current)
              forgetUnsaved()
            }
          }}
          onDocumentChange={(document) => {
            // Kept a moment after the last edit, not on every one.
            clearTimeout(timer.current)
            timer.current = setTimeout(() => dirty.current && keepUnsaved(document), 600)
          }}
        />
      </div>
    </div>
  )
}
