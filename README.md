# Structura

轻量化学结构式编辑器（ChemDraw 式交互）：画键、稠环、螺环，导出 SVG / MOL。

开发：`npm install && npm run dev`；测试：`npm test`。

## 作为组件嵌入

`<Editor />`（`src/editor/Editor.tsx`）填满它所在的容器，大小由宿主决定。

```tsx
import { useRef } from "react"
import { Editor, type EditorHandle } from "@/editor/Editor"

function Host({ saved }: { saved?: string }) {
  const editor = useRef<EditorHandle>(null)
  return (
    <div style={{ width: 900, height: 600 }}>
      <Editor
        ref={editor}
        initialDocument={saved}
        onDocumentChange={(document) => localStorage.setItem("formula", document)}
      />
    </div>
  )
}
```

**参数**

| 参数 | 说明 |
|---|---|
| `initialMolfile` | 启动时读入的 MOL / SDF 文本 |
| `initialDocument` | 启动时读入的 Structura 文档（含通式的变量和可变连接），优先于 `initialMolfile` |
| `onChange(molfile)` | 分子改变后回调，给出 MOL 文本 |
| `onDocumentChange(document)` | 任何改动后回调，给出完整的 Structura 文档（JSON） |

**ref 方法**（`EditorHandle`）

| 方法 | 说明 |
|---|---|
| `getMolfile()` / `setMolfile(text)` | 读写 MOL / SDF；写入是一步可撤销的操作，不触发回调 |
| `getDocument()` / `setDocument(text)` | 读写完整文档（`.structura`）；写入不触发回调，返回读不了的原因 |
| `run(ops)` | 用操作层修改（与 agent 相同的 JSON 操作，见 `packages/core/src/ops/types.ts`），一步可撤销，触发回调；失败时返回哪一步、为什么 |
| `enumerate({ limit, representatives })` | 把通式展开成具体化合物，结果附带 SDF 文本 |
| `fit()` | 缩放平移到整张图可见 |

## 化学核心 `@structura/core`

`packages/core` 是不带界面的化学核心：分子模型、操作层（ops）、MOL / SDF / `.structura` 读写、出图（SVG）、通式变量和批量生成。它只依赖自己的文件，不依赖 React 或浏览器，Node 里可以直接用（量标签宽度时有 canvas 就用，没有就估算）。

```ts
import { applyOps, emptyDrawing, enumerate, toSdf } from "@structura/core"

const result = applyOps(emptyDrawing(), [
  { op: "add_atom", el: "C", as: "c" },
  { op: "add_atom", el: "O", to: "c" },
])
if (result.ok) console.log(toSdf(enumerate(result.drawing).molecules))
```

公开的入口写在 `packages/core/package.json` 的 `exports` 里：根入口放常用的，细一些的工具在子路径下（`@structura/core/molecule`、`/draw`、`/markush`、`/ops`、`/types`…）。没列出的内部文件引用不到，TypeScript、Vite 和 Node 都会报错。

- 仓库内（编辑器、测试）通过 `source` 条件直接用 TypeScript 源码，改了立即生效，不用先构建。
- 给别的项目用：`cd packages/core && npm run build`，生成 `dist/`（JavaScript 和类型声明）。
- 核心自己的测试在 `packages/core/tests`，`cd packages/core && npm test` 可以单独跑；根目录的 `npm test` 两边一起跑。

## RDKit 桥 `@structura/rdkit`

`packages/rdkit` 把 SMILES 经 RDKit 转成 molfile，再读成 core 的分子记录。RDKit（约 2.4 MB 的 WebAssembly）单独放在这个包里，core 因此保持零依赖。RDKit 模块由调用方加载后传进来：Node 里直接 `await initRDKitModule()`；浏览器里要给出 .wasm 的地址（编辑器的做法见 `src/editor/rdkit.ts`）。

```ts
import initRDKitModule from "@rdkit/rdkit"
import { usableRecords } from "@structura/core/import"
import { smilesRecords } from "@structura/rdkit"

const rdkit = await initRDKitModule()
const { molecules, skipped } = usableRecords(smilesRecords(rdkit, "CC(=O)Oc1ccccc1C(=O)O aspirin"))
```

`npm run build` 会先构建 core，再生成自己的 `dist/`。
