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

- 仓库内（编辑器、测试）通过 `structura-source` 条件直接用 TypeScript 源码，改了立即生效，不用先构建。
- 给别的项目用：`cd packages/core && npm run build`，生成 `dist/`（JavaScript 和类型声明）。
- 核心自己的测试在 `packages/core/tests`，`cd packages/core && npm test` 可以单独跑；根目录的 `npm test` 两边一起跑。

## 交互引擎 `@structura/engine`

`packages/engine` 是编辑器的“行为”，不含界面：编辑器状态（撤销历史、选中、工具设置，`createEditor()`，可订阅）、对选中部分的全部动作、鼠标手势（按下、移动、松开 → 预览和操作）、热点和悬停规则、按键路由和命令、悬停快捷键表、工具和它们的按键、命中检测、拖动吸附、双击的含义、视图的缩放平移换算，以及每个用户动作对应的操作（ops）。它只依赖 core，不依赖 React 和浏览器，`packages/engine/tests/boundary.test.ts` 会检查这一点。前端（`src/editor`）只负责渲染、菜单和对话框，把鼠标和键盘事件交给它。以后嵌进 3D 编辑器，或让 agent 模拟用户操作，都用同一套规则。

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

## AI 填写通式 `@structura/ai`

变量面板里的“从专利文字填写…”：粘贴权利要求中定义变量的文字，由大模型读出每个变量的候选项。回答先经 core 校验：认不出的标签、放不上的候选项、表达不了的部分（取代基范围、“相邻基团可成环”等）都会列出来。逐个勾选后应用，整个填写算一步，可以撤销。

模型调用只在服务器上进行，key 写在项目根目录的 `.env.local` 里，改完后重启 `npm run dev`：

```sh
# Claude（默认）
ANTHROPIC_API_KEY=sk-ant-…
# ANTHROPIC_BASE_URL=…      # 可选：兼容 Anthropic 接口的中转

# 或 OpenAI Responses API（也可以是任何兼容 Responses API 的服务）
OPENAI_API_KEY=sk-…
# OPENAI_BASE_URL=https://…/v1   # 可选：兼容服务的地址
# OPENAI_MODEL=gpt-5.5           # 可选，默认 gpt-5.5

# 两个 key 都写时默认用 Claude，用这一行指定
# AI_PROVIDER=openai
```

- Claude 用 `claude-opus-5-5`，被安全分类器拒绝时服务器端自动改用推荐的备用模型（`fallbacks: "default"`）。OpenAI 用 Responses API 的严格 JSON Schema 输出，并设 `store: false`，专利文字不留在对方服务器上。兼容服务必须支持 `/responses` 和 `json_schema` 严格模式，只支持 Chat Completions 的服务用不了。
- 浏览器端不含任何 SDK，也拿不到 key。开发服务器通过 Vite 插件 `structuraAi()`（`@structura/ai/server`）在 `POST /api/ai/variables` 提供接口。别的 Node 服务器可以挂 `fillHandler()`。
- 嵌入时通过 `<Editor fillVariables={…} />` 指定怎么连到模型。不传就不显示这个按钮。
- `@structura/ai` 的根入口可以在浏览器里用：`requestFor` 构建请求，`reviewAnswer` 校验回答，`fillOps` 生成操作。

npm 脚本通过 `NODE_OPTIONS=--conditions=structura-source` 让 Vite 配置直接加载各个包的 TypeScript 源码。
