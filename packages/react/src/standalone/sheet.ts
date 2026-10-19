import { readDocument, toDocument } from "@structura/core/document"
import { usableRecords } from "@structura/core/import"
import { readSdf } from "@structura/core/sdf"
import { createEditorStore } from "@structura/engine"
import { importNotes } from "../editor/imports/notes.ts"
import { autoIsDark, type Theme } from "../components/theme.ts"
import { readSmiles } from "../editor/imports/smiles.ts"
import { mount, type MountOptions } from "./mount.tsx"
import { drawingSmiles, structureProblems, type StructureProblem } from "./report.ts"

/** What edit() opens with: a title, and the structure (a Structura document wins over a molfile, a molfile over SMILES). */
export type EditOptions = {
  /** Shown above the editor; "编辑结构" by default. */
  title?: string
  /** The structure as a Structura document (keeps a generic formula's variables). */
  document?: string
  /** Or as molfile / SD text. */
  molfile?: string
  /** Or as SMILES (one per line for several), laid out by RDKit; edit() rejects SMILES it cannot read. */
  smiles?: string
  /**
   * A molfile with 3D coordinates: "project" (the default) flattens it onto the page, as
   * opening the file does, and says so in Edited.notes; "reject" refuses it, edit() rejecting
   * before anything opens. (The editor is 2D: z coordinates are not kept either way.)
   */
  on3D?: "project" | "reject"
  /** With problems in the structure (an atom over its valence…), ask before saving: "结构有问题，仍然保存吗？". Off by default. */
  confirmProblems?: boolean
  /** Hand back the saved structure's SMILES too (Edited.smiles); always so when it came in as `smiles`. Loads RDKit. */
  withSmiles?: boolean
  /** "light" (the default), "dark", or "auto": dark when the page (data-theme / class "dark" on <html>) or the system is. */
  theme?: Theme
  /** Other options for the editor inside (template store, AI hooks…). */
  editor?: Omit<MountOptions, "initialDocument" | "initialMolfile">
}

/** What 保存 hands back. */
export type Edited = {
  /** The structure as a Structura document. */
  document: string
  /** And as molfile text. */
  molfile: string
  /** What is wrong with it, as the editor marks it in red (empty when nothing is). */
  problems: StructureProblem[]
  /** What reading the given structure said, in Chinese (3D coordinates flattened, a feature not supported…). */
  notes: string[]
  /** Whether anything was edited since it opened. */
  changed: boolean
  /**
   * Its SMILES, when it came in as SMILES or `withSmiles` asked: "" for nothing drawn, null
   * when it has variables (R1…) or RDKit could not give one. Absent otherwise.
   */
  smiles?: string | null
}

export type { StructureProblem }

let open = false

/** The structure to open with, and what reading it said. */
async function readInput(options: EditOptions): Promise<{ document?: string; molfile?: string; notes: string[] }> {
  if (options.document !== undefined) return { document: options.document, notes: [] }
  if (options.molfile !== undefined) {
    let notes: string[] = []
    try {
      const records = readSdf(options.molfile)
      const imported = usableRecords(records)
      // How it was read; what is wrong with the structure itself comes back as Edited.problems.
      notes = importNotes(records, imported.problems.filter((problem) => problem.code !== "valence"))
      if (options.on3D === "reject" && imported.problems.some((problem) => problem.code === "flattened-3d")) {
        throw new Error("chem-structura: 结构带三维坐标（on3D: \"reject\"），编辑器只能画平面结构")
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("on3D")) throw error
      // Unreadable text opens an empty editor, as the editor's own initialMolfile does.
    }
    return { molfile: options.molfile, notes }
  }
  if (options.smiles !== undefined && options.smiles.trim() !== "") {
    const { molecules, lines } = await readSmiles(options.smiles)
    if (molecules.length === 0) throw new Error(`chem-structura: SMILES 读不了：${lines.join("；")}`)
    const store = createEditorStore()
    store.openMolecules(molecules)
    return { document: toDocument(store.latest()), notes: lines }
  }
  return { notes: [] }
}

/**
 * Opens the editor over the page, with 保存 and 取消 above it, and resolves once it is closed:
 * to the saved structure, or null when it was cancelled (after asking, if there were changes).
 * Escape cancels too, once the editor has nothing to stop or deselect (see EditorProps.onDismiss).
 * While it is open the rest of the page is inert, so Tab and clicks stay in it; focus starts in
 * the editor and goes back where it was. One at a time: a second call while one is open is
 * refused; so is a structure it cannot open (unreadable SMILES; 3D with on3D: "reject").
 */
export function edit(options: EditOptions = {}): Promise<Edited | null> {
  if (open) return Promise.reject(new Error("chem-structura: an editor is already open"))
  open = true
  return readInput(options).then(
    (input) => openSheet(options, input),
    (error: unknown) => {
      open = false
      throw error
    },
  )
}

function openSheet(options: EditOptions, input: { document?: string; molfile?: string; notes: string[] }): Promise<Edited | null> {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const title = options.title ?? "编辑结构"

  // chem-overlay: the page's own styles stay out, as they do out of the editor (style.css).
  const sheet = document.createElement("div")
  const theme = options.theme ?? options.editor?.theme ?? "light"
  const dark = theme === "dark" || (theme === "auto" && autoIsDark())
  sheet.className = `chem-overlay chem-sheet${dark ? " chem-dark" : ""}`
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

  // The rest of the page is inert while the sheet is open. The editor's menus and dialogs
  // portal to <body> after this, so they stay usable.
  const inert = [...document.body.children].filter((element): element is HTMLElement => element !== sheet && element instanceof HTMLElement && !element.inert)
  for (const element of inert) element.inert = true

  let changed = false
  let cancel = () => {}
  const editor = mount(sheet.querySelector(".chem-sheet-editor")!, {
    ...options.editor,
    theme,
    initialDocument: input.document,
    initialMolfile: input.molfile,
    onDocumentChange(text) {
      changed = true
      changedNote.hidden = false
      options.editor?.onDocumentChange?.(text)
    },
    onDismiss: () => cancel(),
  })
  editor.fit()
  // Keys go to the editor from the start, as after a click in it.
  const root = sheet.querySelector<HTMLElement>(".chem-app")
  if (root) {
    root.tabIndex = -1
    root.focus({ preventScroll: true })
  }

  return new Promise((resolve) => {
    /** Takes the sheet away at once; the result may still be on its way (SMILES from RDKit). */
    const close = (result: Edited | null | Promise<Edited>) => {
      editor.unmount()
      sheet.remove()
      for (const element of inert) element.inert = false
      document.documentElement.style.overflow = scroll
      open = false
      returnFocus?.focus()
      resolve(result)
    }
    cancel = () => {
      if (changed && !confirm("修改还没保存，确定放弃吗？")) return
      close(null)
    }
    const save = () => {
      const text = editor.getDocument()
      const read = readDocument(text)
      const problems = "drawing" in read ? structureProblems(read.drawing) : []
      if (options.confirmProblems && problems.length > 0 && !confirm(`结构有问题：\n${problems.map((problem) => `· ${problem.text}`).join("\n")}\n\n仍然保存吗？`)) return
      const saved: Edited = { document: text, molfile: editor.getMolfile(), problems, notes: input.notes, changed }
      const wantSmiles = options.withSmiles || options.smiles !== undefined
      close(wantSmiles && "drawing" in read ? drawingSmiles(read.drawing).then((smiles) => ({ ...saved, smiles })) : saved)
    }
    sheet.querySelector('[data-action="save"]')!.addEventListener("click", save)
    sheet.querySelector('[data-action="cancel"]')!.addEventListener("click", () => cancel())
    // Escape on the bar's buttons, which are not the editor's: the editor sends its own through onDismiss.
    sheet.querySelector(".chem-sheet-bar")!.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key !== "Escape" || event.defaultPrevented) return
      event.preventDefault()
      cancel()
    })
  })
}
