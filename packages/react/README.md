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
| `fillVariables`, `recognizeStructure` | Optional AI features; hidden unless given |

### Handle (`ref`)

`getMolfile()`, `setMolfile(text)`, `getDocument()`, `setDocument(text)`, `getCdxml()` (ChemDraw
CDXML, generic-formula marks and definitions included), `run(ops)`, `enumerate(options)`, `fit()`.

## Without React

`chem-structura/standalone` is the same editor with React bundled in, for pages that do not
use React or a bundler. Give an element a size and mount the editor in it; the handle is the
one above, plus `unmount()`.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chem-structura@0.3.0/dist/style.css" />
<div id="editor" style="height: 600px"></div>

<script src="https://cdn.jsdelivr.net/npm/chem-structura@0.3.0/dist/chem-structura.iife.js"></script>
<script>
  const editor = ChemStructura.mount("#editor", {
    onChange: (molfile) => console.log(molfile),
  })
  editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  editor.fit()
</script>
```

As an ES module, `import { mount } from "chem-structura/standalone"` (or
`…/dist/standalone.js` from the CDN). `mount` takes the component's props as its options, an
element or a selector, and returns once the editor is on the page.

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

Some features (SMILES import, identifiers, removing duplicate compounds) use
[RDKit](https://www.rdkit.org/) compiled to WebAssembly, loaded on first use from the jsDelivr
CDN. To serve it yourself (offline use, a strict content security policy), copy
`node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm` to your site and call, before the editor
first needs it:

```ts
import { configureRDKit } from "chem-structura"
configureRDKit({ wasmUrl: "/assets/RDKit_minimal.wasm" })
```

## License

MIT
