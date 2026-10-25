import { createRef } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { Editor, type EditorHandle, type EditorProps } from "../editor/Editor.tsx"
import { edit } from "./sheet.ts"

/**
 * The options of mount(): the component's props. Without an `onExpand` of its own, a mini
 * editor's 放大编辑 opens the structure in edit()'s sheet over the page and takes back what is
 * saved there; `onExpand: undefined` offers no 放大编辑 at all.
 */
export type MountOptions = EditorProps

/** 放大编辑 by default: the structure in edit()'s sheet, with this editor's hooks and theme, and none of its callbacks. */
function expandInSheet({ theme, onThemeChange, fillVariables, recognizeStructure, templateStore, wordExport, onFile }: MountOptions) {
  return async (document: string) => {
    const saved = await edit({ document, theme, editor: { onThemeChange, fillVariables, recognizeStructure, templateStore, wordExport, onFile } })
    return saved?.changed ? saved.document : null
  }
}

/** A mounted editor: the component's ref handle, update() to change its options, unmount() to take it off the page. */
export type MountedEditor = EditorHandle & {
  /**
   * Changes some options, keeping the others: callbacks, template store, AI hooks. The
   * starting content (initialMolfile, initialDocument) is read only when mounting.
   */
  update(options: Partial<MountOptions>): void
  /** Removes the editor from its element; the handle cannot be used after. */
  unmount(): void
}

/**
 * Puts an editor in `target` (an element, or a selector for one), which it fills: give the
 * element a size. Returns once the editor is on the page, its handle ready to use.
 */
export function mount(target: Element | string, options: MountOptions = {}): MountedEditor {
  const element = typeof target === "string" ? document.querySelector(target) : target
  if (!element) throw new Error(`chem-structura: no element matches ${JSON.stringify(target)}`)
  const ref = createRef<EditorHandle>()
  const root = createRoot(element)
  let current = options
  const render = () => flushSync(() => root.render(<Editor ref={ref} {...current} onExpand={"onExpand" in current ? current.onExpand : expandInSheet(current)} />))
  render()
  const handle = ref.current
  if (!handle) throw new Error("chem-structura: the editor did not start")
  let mounted = true
  const alive = () => {
    if (!mounted || !ref.current) throw new Error("chem-structura: the editor was unmounted")
    return ref.current
  }
  /** Each method goes to the handle the editor has now, so it always sees the latest drawing. */
  const live = (name: keyof EditorHandle) => (...args: unknown[]) => (alive()[name] as (...args: unknown[]) => unknown)(...args)
  const methods = Object.fromEntries(Object.keys(handle).map((name) => [name, live(name as keyof EditorHandle)])) as EditorHandle
  return {
    ...methods,
    update(next) {
      alive()
      current = { ...current, ...next }
      render()
    },
    unmount() {
      if (!mounted) return
      mounted = false
      root.unmount()
    },
  }
}
