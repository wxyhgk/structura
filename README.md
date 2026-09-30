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
| `run(ops)` | 用操作层修改（与 agent 相同的 JSON 操作，见 `src/chem/ops/types.ts`），一步可撤销，触发回调；失败时返回哪一步、为什么 |
| `enumerate({ limit, representatives })` | 把通式展开成具体化合物，结果附带 SDF 文本 |
| `fit()` | 缩放平移到整张图可见 |
