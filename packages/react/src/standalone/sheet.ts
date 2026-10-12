import { mount, type MountOptions } from "./mount.tsx"

/** What edit() opens with: a title, and the structure (a Structura document wins over a molfile). */
export type EditOptions = {
  /** Shown above the editor; "编辑结构" by default. */
  title?: string
  /** The structure as a Structura document (keeps a generic formula's variables). */
  document?: string
  /** Or as molfile / SD text. */
  molfile?: string
  /** Other options for the editor inside (template store, AI hooks…). */
  editor?: Omit<MountOptions, "initialDocument" | "initialMolfile">
}

/** What 保存 hands back: the structure as a Structura document and as molfile text. */
export type Edited = { document: string; molfile: string }

let open = false

/**
 * Opens the editor over the page, with 保存 and 取消 above it, and resolves once it is closed:
 * to the saved structure, or null when it was cancelled (after asking, if there were changes).
 * One at a time: a second call while one is open is refused.
 */
export function edit(options: EditOptions = {}): Promise<Edited | null> {
  if (open) return Promise.reject(new Error("chem-structura: an editor is already open"))
  open = true
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const title = options.title ?? "编辑结构"

  // chem-overlay: the page's own styles stay out, as they do out of the editor (style.css).
  const sheet = document.createElement("div")
  sheet.className = "chem-overlay chem-sheet"
  sheet.setAttribute("role", "dialog")
  sheet.setAttribute("aria-modal", "true")
  sheet.setAttribute("aria-label", title)
  sheet.innerHTML = `
    <div class="chem-sheet-panel">
      <div class="chem-sheet-bar">
        <span class="chem-sheet-title"></span>
        <span class="chem-sheet-changed" hidden>有未保存的修改</span>
        <button type="button" class="chem-sheet-button" data-action="cancel">取消</button>
        <button type="button" class="chem-sheet-button chem-sheet-primary" data-action="save">保存</button>
      </div>
      <div class="chem-sheet-editor"></div>
    </div>`
  sheet.querySelector(".chem-sheet-title")!.textContent = title
  const changedNote = sheet.querySelector<HTMLElement>(".chem-sheet-changed")!
  document.body.append(sheet)
  const scroll = document.documentElement.style.overflow
  document.documentElement.style.overflow = "hidden"

  let changed = false
  const editor = mount(sheet.querySelector(".chem-sheet-editor")!, {
    ...options.editor,
    initialDocument: options.document,
    initialMolfile: options.molfile,
    onDocumentChange(text) {
      changed = true
      changedNote.hidden = false
      options.editor?.onDocumentChange?.(text)
    },
  })
  editor.fit()

  return new Promise((resolve) => {
    const close = (result: Edited | null) => {
      editor.unmount()
      sheet.remove()
      document.documentElement.style.overflow = scroll
      open = false
      returnFocus?.focus()
      resolve(result)
    }
    sheet.querySelector('[data-action="save"]')!.addEventListener("click", () => close({ document: editor.getDocument(), molfile: editor.getMolfile() }))
    sheet.querySelector('[data-action="cancel"]')!.addEventListener("click", () => {
      if (changed && !confirm("修改还没保存，确定放弃吗？")) return
      close(null)
    })
  })
}
