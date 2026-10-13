# chem-structura

A ChemDraw-style 2D chemical structure editor as a React component, with drawing and
enumeration of patent generic (Markush) formulas. The interface is in Chinese.

ChemDraw 风格的 2D 化学结构编辑器 React 组件，支持专利通式（Markush）的绘制和批量生成。

## Install

```sh
npm install chem-structura
```

React 19 is a peer dependency.

## Use

```tsx
import { useRef } from "react"
import { StructuraEditor, type EditorHandle } from "chem-structura"
import "chem-structura/style.css"

export function MoleculeField() {
  const editor = useRef<EditorHandle>(null)
  return (
    // The editor fills its container: give the container a size.
    <div style={{ width: 960, height: 600 }}>
      <StructuraEditor ref={editor} onChange={(molfile) => console.log(molfile)} />
    </div>
  )
}
```

The styles stay inside the editor: it does not reset or restyle the rest of your page, and its
colour variables do not override your own theme. Nor do your page's styles change the editor
(see [Without React](#without-react) for the details).

### Props

| Prop | |
|---|---|
| `initialMolfile` | Molfile or SD text to start with |
| `initialDocument` | A Structura document (from `getDocument()`) to start with |
| `onChange(molfile)` | After every edit that changes the molecule |
| `onDocumentChange(document)` | After every edit, as a Structura document (with the generic formula's variables) |
| `onDirtyChange(dirty)` | When the drawing gains or loses unsaved changes |
| `templateStore` | Where the user's own group templates are kept (`httpTemplateStore()`, `memoryTemplateStore()`, or your own) |
| `onDismiss()` | An Escape the editor has no use for (nothing to stop or deselect, the lasso in hand): for a host showing it in a dialog of its own, to close that |
| `fillVariables`, `recognizeStructure` | Optional AI features; hidden unless given |

### Handle (`ref`)

| Method | |
|---|---|
| `getMolfile()` / `setMolfile(text)` | Molfile or SD text |
| `getDocument()` / `setDocument(text)` | The whole drawing as a Structura document (variables included) |
| `getSmiles()` / `setSmiles(text)` | SMILES (promises; RDKit). Variables such as R1 come out as `*` |
| `getInchi()`, `getInchiKey()` | Promises (RDKit); refused for drawings with variables |
| `getSvg()` | The picture as SVG text, as 导出 SVG saves it; empty for an empty page |
| `getPng({ scale })` | A promise of the picture as a PNG `Blob` (`scale` 3 by default), or null for an empty page |
| `getCdxml()` | ChemDraw CDXML, generic-formula marks and definitions included |
| `run(ops)` | Edits through the op layer, as one undoable step |
| `enumerate(options)` | The generic formula expanded into compounds, with their SD file |
| `fit()` | Zooms and pans so the whole drawing is in view |

The `set…` methods replace the drawing as one undoable step and return the problems worth
telling the user; they are the host's own changes, so `onChange` is not called for them.

### Server rendering

The component renders on a server (Next.js, Remix…) and comes alive in the browser; it needs no
`dynamic(…, { ssr: false })`.

## Without React

`chem-structura/standalone` is the same editor with React bundled in, for pages that do not
use React or a bundler: one stylesheet and one script.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chem-structura@0.3.0/dist/style.css" />
<script src="https://cdn.jsdelivr.net/npm/chem-structura@0.3.0"></script>
```

The script (`dist/chem-structura.iife.js`, which the short address above serves) sets
`window.ChemStructura`; as an ES module it is `import … from "chem-structura/standalone"`, or
`…/dist/standalone.js` from the CDN.

### Molecules on a page: `<chem-molecule>`

Shows a structure; with `editable`, a click (or Enter) opens the editor over the page, and
保存 updates it.

```html
<chem-molecule editable label="Aspirin" smiles="CC(=O)Oc1ccccc1C(=O)O"></chem-molecule>

<chem-molecule editable label="Compound 2">
  <script type="chemical/x-mdl-molfile">
…molfile text…
  </script>
</chem-molecule>
```

| | |
|---|---|
| Content | A child `<script type="chemical/x-mdl-molfile">` (molfile / SD text), or `<script type="application/vnd.structura+json">` (a Structura document: keeps a generic formula's variables), or the `smiles` attribute (read with RDKit) |
| `editable` | A click or Enter opens the editor; without it, a picture (`role="img"`) |
| `label` | Its name: the editor's title and the accessible name |
| `fit` | The drawing grows to fill the element (by default it only shrinks to fit) |
| `raised-numbers` | Variables' numbers raised (R¹) |
| `name`, `format` | In a `<form>`, submitted under `name`: the molfile (empty when nothing is drawn), or the Structura document with `format="document"`; a form reset restores what the page gave |
| `.molfile`, `.document` | Read or replace the structure from script (no `change` event) |
| `.edit()` | Opens the editor, as a click does; resolves to whether it was saved |
| `change` event | After 保存; `event.detail` is `{ molfile, document }` |
| `load` event | Once its content is read (SMILES takes a moment: RDKit loads first) |

Size and frame it as any element (`width`, `height`, `border`…): the page's rules win over
its defaults. In TypeScript, `document.querySelector("chem-molecule")` is typed.

### The editor over the page: `edit()`

```js
const saved = await ChemStructura.edit({ title: "Edit", molfile })   // or document
if (saved) console.log(saved.molfile, saved.document)                  // null when cancelled
```

取消 and Escape cancel, asking first if there are changes. The editor uses Escape too, one
press at a time (stop a drag, clear the selection, take the lasso); the press after that
closes the sheet. While it is open the rest of the page is `inert`, so Tab and clicks stay in
it; focus starts in the editor and returns where it was. One at a time: a call while one is
open rejects (a `<chem-molecule>` clicked meanwhile just ignores the click). An editor of your
own (`mount()`, or the React component) gets the same Escape through the `onDismiss` prop.

### An editor in your own element: `mount()`

Give an element a size and mount the editor in it; the handle is the one above, plus
`update(options)` (new callbacks, template store…) and `unmount()`.

```js
const editor = ChemStructura.mount("#editor", { onChange: (molfile) => console.log(molfile) })
editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
editor.fit()
```

### The page's styles

The editor's styles do not reach out, and the page's do not reach in: rules on tag names
(`button { … }`), classes that share the editor's names (`.grid`, `.flex`), a root font size
or inherited text styles leave it as it is. What still gets through: `!important` rules, and
selectors with two ids or more. Runnable pages: [`examples/`](https://github.com/wxyhgk/structura/tree/master/packages/react/examples).

## Chemistry without the editor

`chem-structura/core` builds, reads, writes, draws and expands structures with no editor on
the page, in the browser or in Node, and without React. Its files are the editor's own.

```ts
import { applyOps, drawingCdxml, drawingFromMolfile, drawingMolfile, drawingSvg, emptyDrawing, enumerate, enumerationSdf } from "chem-structura/core"

const built = applyOps(emptyDrawing(), [
  { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
  { op: "add_atom", el: "O", to: 1 },
])
if (built.ok) {
  drawingSvg(built.drawing)     // an SVG picture, as 导出 SVG saves it
  drawingMolfile(built.drawing) // molfile text
  drawingCdxml(built.drawing)   // ChemDraw CDXML
}
const { drawing, notes } = drawingFromMolfile(sdText) // opens it as the editor would
const compounds = enumerate(drawing)                   // a generic formula, expanded
enumerationSdf(compounds)
```

Also: `readDocument` / `toDocument` (the editor's `getDocument()` text), `validateDrawing`,
`librarySize`, `plainFormula`, `molecularWeight`, `exactMass`, `elementalAnalysis`,
`readSdf` / `toSdf`. The ops are those of the editor's `run()`.

### RDKit

Some features (SMILES in and out, `<chem-molecule smiles>`, InChI, removing duplicate
compounds) use [RDKit](https://www.rdkit.org/) compiled to WebAssembly, loaded on first use
from the jsDelivr CDN. `chem-structura/core` does not use it. To serve it yourself (offline use,
a strict content security policy), copy `node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm`
(the release this package pins) to your site; if your page loads RDKit already, lend it that
module instead of a second copy:

```ts
import { configureRDKit } from "chem-structura"            // or "chem-structura/standalone"
configureRDKit({ wasmUrl: "/assets/RDKit_minimal.wasm" })
configureRDKit({ module: initRDKitModule() })             // or: lend your own (a module or its promise)
```

- **Call it before RDKit is first needed.** A `<chem-molecule smiles>` on the page needs it as
  soon as the script is loaded: call `configureRDKit` right after loading chem-structura (the
  next statement of the module that imports it, or a `<script>` right after the library's, in
  `<head>`, before the elements). A call after RDKit has started loading changes nothing and
  says so in the console.
- **Each entry has its own setting.** `chem-structura` and `chem-structura/standalone` (the
  `ChemStructura` global) are separate copies: call the `configureRDKit` of the one in use.
- **A lent module is switched to Coordgen layouts** (`prefer_coordgen(true)`), for the page's
  own uses of it too. Structura is built and tested with the @rdkit/rdkit release in its
  `package.json`.

## License

MIT
