import { readDocument, toDocument } from "@structura/core/document"
import type { Drawing } from "@structura/core/types"
import { createEditorStore } from "@structura/engine"
import { drawingFromMolfile, drawingMolfile, drawingSvg } from "../core.ts"
import { readSmiles } from "../editor/imports/smiles.ts"
import { edit } from "./sheet.ts"

/**
 * <chem-molecule>: a structure shown on a page, as a picture. Its content is the first of: a
 * child <script type="application/vnd.structura+json"> (a Structura document), a child
 * <script type="chemical/x-mdl-molfile"> (molfile or SD text), the `smiles` attribute (read
 * with RDKit). With `editable`, a click (or Enter) opens the editor over the page, and 保存
 * changes it and fires `change`. `load` fires once its content is read (`smiles` takes a moment:
 * RDKit loads first). In a <form>, its `name` submits it (molfile, or the Structura document
 * with format="document").
 */
export interface MoleculeElement extends HTMLElement {
  /** The structure as molfile text, empty when nothing is drawn; setting it replaces the structure (no `change` event). */
  molfile: string
  /** The structure as a Structura document; setting it replaces the structure (no `change` event). */
  document: string
  /** What a form submits: the molfile (empty when nothing is drawn), or the document with format="document". */
  readonly value: string
  /** Opens the editor on it, as a click does when it is editable; resolves to whether it was saved. */
  edit(): Promise<boolean>
}

/** The `change` event's detail: the structure as saved. */
export type MoleculeChange = { molfile: string; document: string }

declare global {
  interface HTMLElementTagNameMap {
    "chem-molecule": MoleculeElement
  }
}

const DOCUMENT_TYPE = "application/vnd.structura+json"
const MOLFILE_TYPES = ["chemical/x-mdl-molfile", "chemical/x-mdl-sdfile"]

const empty = (): string => toDocument(createEditorStore().latest())

/** Registers <chem-molecule> (or another tag name), once; nothing on a server. */
export function defineMoleculeElement(tag = "chem-molecule"): void {
  if (typeof customElements === "undefined" || customElements.get(tag)) return
  customElements.define(tag, moleculeElementClass())
}

/** The element's class, made on first use: HTMLElement exists only in a browser. */
function moleculeElementClass(): CustomElementConstructor {
  return class extends HTMLElement implements MoleculeElement {
    static formAssociated = true
    static observedAttributes = ["smiles", "editable", "label", "format", "raised-numbers"]

    #internals: ElementInternals | null = null
    #picture: HTMLElement | null = null
    #text = empty()
    /** What the page started with, for a form reset. */
    #initial: string | null = null
    #loaded = false
    /** Whether the tabindex is the one it set itself for being editable. */
    #ownTabIndex = false

    constructor() {
      super()
      this.#internals = this.attachInternals?.() ?? null
      this.addEventListener("click", () => this.#editable() && void this.edit())
      this.addEventListener("keydown", (event) => {
        if (!this.#editable() || (event.key !== "Enter" && event.key !== " ")) return
        event.preventDefault()
        void this.edit()
      })
    }

    connectedCallback() {
      if (!this.#picture) {
        // chem-overlay: the page's own styles stay out of the picture (style.css).
        this.#picture = document.createElement("span")
        this.#picture.className = "chem-overlay chem-molecule-picture"
        this.append(this.#picture)
      }
      if (!this.#loaded) {
        // Met while the page is still being read, its <script> child may not be there yet.
        const waiting = document.readyState === "loading" && !this.#data() && !this.hasAttribute("smiles")
        if (waiting) document.addEventListener("DOMContentLoaded", () => this.#load(), { once: true })
        else this.#load()
      }
      this.#render()
    }

    attributeChangedCallback(name: string, before: string | null, after: string | null) {
      if (before === after) return
      if (name === "smiles" && this.#loaded && !this.#data()) void this.#loadSmiles()
      else this.#render()
    }

    get document() {
      return this.#text
    }
    set document(text: string) {
      const read = readDocument(text)
      if ("error" in read) throw new Error(`chem-molecule: ${read.error}`)
      this.#show(toDocument(read.drawing))
    }

    get molfile() {
      const drawing = this.#drawing()
      return drawing && drawing.molecule.atoms.length > 0 ? drawingMolfile(drawing) : ""
    }
    set molfile(text: string) {
      this.#show(toDocument(drawingFromMolfile(text).drawing))
    }

    get value() {
      return this.getAttribute("format") === "document" ? this.#text : this.molfile
    }

    async edit(): Promise<boolean> {
      const label = this.getAttribute("label")
      const saved = await edit({ title: label ? `编辑：${label}` : undefined, document: this.#text })
      if (!saved) return false
      this.#show(saved.document)
      this.dispatchEvent(new CustomEvent<MoleculeChange>("change", { bubbles: true, detail: saved }))
      return true
    }

    formResetCallback() {
      if (this.#initial !== null) this.#show(this.#initial)
    }

    /** The child <script> holding the structure, if any. */
    #data(): HTMLScriptElement | null {
      return [...this.querySelectorAll(":scope > script")].find((script): script is HTMLScriptElement => [DOCUMENT_TYPE, ...MOLFILE_TYPES].includes((script as HTMLScriptElement).type)) ?? null
    }

    #load() {
      if (this.#loaded) return
      this.#loaded = true
      const data = this.#data()
      if (!data) {
        if (this.hasAttribute("smiles")) void this.#loadSmiles()
        else this.#start(empty())
        return
      }
      // The text starts on the line after the tag; a molfile's first line (its title) may be blank.
      const text = (data.textContent ?? "").replace(/^\r?\n/, "")
      try {
        if (data.type === DOCUMENT_TYPE) {
          const read = readDocument(text)
          if ("error" in read) throw new Error(read.error)
          this.#start(toDocument(read.drawing))
        } else {
          const { drawing, notes } = drawingFromMolfile(text)
          if (notes.length > 0) console.warn(`chem-molecule: ${notes.join("；")}`)
          this.#start(toDocument(drawing))
        }
      } catch (error) {
        console.warn(`chem-molecule: could not read its structure: ${error instanceof Error ? error.message : error}`)
        this.#start(empty())
      }
    }

    async #loadSmiles() {
      const smiles = this.getAttribute("smiles") ?? ""
      try {
        const { molecules, lines } = await readSmiles(smiles)
        if (lines.length > 0) console.warn(`chem-molecule: ${lines.join("；")}`)
        // A newer smiles attribute may have arrived while RDKit was loading.
        if ((this.getAttribute("smiles") ?? "") !== smiles) return
        const store = createEditorStore()
        if (molecules.length > 0) store.openMolecules(molecules)
        this.#start(toDocument(store.latest()))
      } catch (error) {
        console.warn(`chem-molecule: could not read smiles="${smiles}": ${error instanceof Error ? error.message : error}`)
        this.#start(empty())
      }
    }

    /** The structure the page gave it: shown, kept for a form reset, and announced with `load`, as an <img> does. */
    #start(text: string) {
      this.#initial = text
      this.#show(text)
      this.dispatchEvent(new Event("load"))
    }

    #show(text: string) {
      this.#text = text
      this.#internals?.setFormValue(this.value)
      this.#render()
    }

    #drawing(): Drawing | null {
      const read = readDocument(this.#text)
      return "drawing" in read ? read.drawing : null
    }

    #editable() {
      return this.hasAttribute("editable")
    }

    #render() {
      if (!this.#picture) return
      const editable = this.#editable()
      const drawing = this.#drawing()
      const svg = drawing ? drawingSvg(drawing, { raisedNumbers: this.hasAttribute("raised-numbers") }) : ""
      // The SVG goes in as markup: its XML declaration has no place inside HTML.
      this.#picture.innerHTML = svg.replace(/^<\?xml[^>]*>\s*/, "")
      if (!svg) {
        const hint = document.createElement("span")
        hint.className = "chem-molecule-empty"
        hint.textContent = !this.#loaded ? "" : editable ? "点击画结构" : ""
        this.#picture.append(hint)
      }
      const label = this.getAttribute("label")
      if (editable) {
        if (!this.hasAttribute("tabindex")) {
          this.tabIndex = 0
          this.#ownTabIndex = true
        }
        this.setAttribute("role", "button")
        this.setAttribute("aria-label", label ? `编辑 ${label}` : "编辑结构")
      } else {
        if (this.#ownTabIndex) this.removeAttribute("tabindex")
        this.#ownTabIndex = false
        this.setAttribute("role", "img")
        if (label) this.setAttribute("aria-label", label)
        else this.removeAttribute("aria-label")
      }
    }
  }
}
