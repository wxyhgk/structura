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
colour variables do not override your own theme.

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

`getMolfile()`, `setMolfile(text)`, `getDocument()`, `setDocument(text)`, `run(ops)`,
`enumerate(options)`, `fit()`.

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
