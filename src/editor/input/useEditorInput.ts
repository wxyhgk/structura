import { useId, type RefObject } from "react"
import type { CanvasHandle } from "@/editor/canvas/types"
import { editorKeysBlocked, inTextField, keepFocusOffToolbar } from "@/editor/input/guards"
import { matches } from "@/editor/input/keymap"
import { useOwnership } from "@/editor/input/ownership"
import { routeKey, type KeyRoutes } from "@/editor/input/router"
import { useWindowListener } from "@/editor/input/useWindowListener"

type Input = Omit<KeyRoutes, "canvas"> & {
  canvas: RefObject<CanvasHandle | null>
  /** A paste the editor owns; it takes the event only for text it can read. */
  onPaste: (event: ClipboardEvent) => void
  /** ⌘C / ⌘X the editor owns. */
  onCopy: (event: ClipboardEvent) => void
}

/**
 * Every browser event the editor listens to beyond its own elements, in one place: keys go
 * through the guards to the router, Space holds the canvas's pan, and paste, copy and cut
 * reach the import and clipboard handlers. Returns the props for the editor's root element
 * and the scope id its dialogs and menus carry.
 */
export function useEditorInput({ onPaste, onCopy, canvas, ...routes }: Input) {
  const overlayScope = useId()
  const { owns, mark } = useOwnership()
  const blocked = (event: Event) => !owns(event) || editorKeysBlocked(event, overlayScope)

  useWindowListener("keydown", (event) => {
    if (!owns(event)) return
    // ⌘A never selects the page's text, not even while a menu is open; fields keep it.
    if (matches(event, { key: "a", meta: true }) && !inTextField(event)) event.preventDefault()
    if (editorKeysBlocked(event, overlayScope)) return
    if (event.code === "Space" && !event.repeat) {
      canvas.current?.holdSpace()
      event.preventDefault()
    }
    routeKey(event, { ...routes, canvas: canvas.current })
  })
  useWindowListener("keyup", (event) => {
    if (event.code === "Space") canvas.current?.releaseSpace()
  })
  useWindowListener("paste", (event) => {
    if (!blocked(event)) onPaste(event)
  })
  const copy = (event: ClipboardEvent) => {
    if (!blocked(event)) onCopy(event)
  }
  useWindowListener("copy", copy)
  useWindowListener("cut", copy)
  // The page itself is never text to select: a select-all from anywhere else (the Edit
  // menu, an extension) is cancelled here. Text fields and dialog text stay selectable.
  useWindowListener("selectstart", (event) => {
    const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement
    if (!target?.closest("input, textarea, [contenteditable=true], [data-slot=dialog-content]")) event.preventDefault()
  })

  return {
    overlayScope,
    rootProps: {
      onKeyDownCapture: mark,
      onPointerDownCapture: mark,
      onFocusCapture: mark,
      onPasteCapture: mark,
      onCopyCapture: mark,
      onCutCapture: mark,
      onMouseDownCapture: keepFocusOffToolbar,
    },
  }
}
