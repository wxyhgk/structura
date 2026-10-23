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
| `onSelectionChange(selection)` | 用户改变选择时回调，给出 `{ atoms, bonds }`（id 与 `getDocument()` 里的一致）；框选、套索在松开时报一次；宿主自己 `setSelection` 不回报 |

**ref 方法**（`EditorHandle`）

| 方法 | 说明 |
|---|---|
| `getMolfile()` / `setMolfile(text)` | 读写 MOL / SDF；写入是一步可撤销的操作，不触发回调 |
| `getDocument()` / `setDocument(text)` | 读写完整文档（`.structura`）；写入不触发回调，返回读不了的原因 |
| `getCdxml()` | ChemDraw 文件（CDXML），与“导出 CDXML”相同：变量、可变连接、方括号写成 ChemDraw 自己的对象，定义写成结构下面的文字 |
| `getSmiles()` / `setSmiles(text)` | 读写 SMILES（返回 Promise，经 RDKit）；R1 这类变量写成 `*`。写入与 `setMolfile` 一样是一步可撤销的操作，不触发回调 |
| `getInchi()` / `getInchiKey()` | InChI / InChIKey（Promise，经 RDKit）；含变量时拒绝 |
| `getSvg()` / `getPng({ scale })` | 图片：SVG 文本与“导出 SVG”相同；PNG 是 `Blob` 的 Promise，默认 3 倍大小。空白页时分别是空文本和 null |
| `run(ops)` | 用操作层修改（与 agent 相同的 JSON 操作，见 `packages/core/src/ops/types.ts`），一步可撤销，触发回调；失败时返回哪一步、为什么 |
| `enumerate({ limit, representatives })` | 把通式展开成具体化合物，结果附带 SDF 文本 |
| `fit()` | 缩放平移到整张图可见 |
| `getSelection()` | 当前选择 `{ atoms, bonds }`（副本） |
| `setSelection({ atoms, bonds? })` | 设置选择，不存在的 id 忽略；不给 `bonds` 时两端都选中的键一起选上；空数组清空。不进撤销、不移动视图、不触发 `onSelectionChange` |

不用 React 时：`chem-structura/standalone` 把 React 一起打包。页面上放分子用 `<chem-molecule editable>` 标签（内容是子元素 `<script>` 里的 MOL / Structura 文档，或 `smiles` 属性；点击用编辑器修改，保存后触发 `change`；放在表单里按 `name` 提交）；`edit({ molfile | document })` 在页面上方打开编辑器，保存后返回结果；`mount(元素, 参数)` 返回上面的 ref 方法和 `update()`、`unmount()`，有 ES 模块（`dist/standalone.js`）和直接用 `<script>` 加载的版本（`dist/chem-structura.iife.js`，全局 `ChemStructura`）；`chem-structura/core` 是不带编辑器的化学功能（搭建、读写 MOL / 文档、出 SVG / CDXML、展开通式），不依赖 React，浏览器和 Node 都能用。写法见 `packages/react/README.md`，能直接打开的示例页在 `packages/react/examples/`（先 `npm run build -w chem-structura`，再把 `packages/react` 当静态文件目录打开，如 `node e2e/serve-package.ts 25401`）。

## 测试

- `npm test`：全部单元测试（core、markush、engine、ai、rdkit、testkit 和界面里的纯逻辑），十几秒。每个包也能在自己的目录里 `npm test` 单独跑。
- `npm run test:e2e`：真浏览器里的关键流程（`e2e/`，Playwright），先打包再用预览服务器打开；同时构建 `chem-structura`，把 `packages/react` 当静态文件提供，检查不用 React 的示例页（`standalone.spec.ts`）。第一次运行前 `npx playwright install --only-shell chromium`；本机已有 Chromium 时也可以设 `STRUCTURA_CHROMIUM=浏览器路径`。测试通过 `window.__structura`（只在 `--mode e2e` 的打包里存在）准备数据、读取文档，不靠像素和坐标判断结果。
- 出图快照：`packages/core/tests/render/` 存了 24 个代表结构的 SVG（数字取一位小数）。渲染有变化时这些测试会失败并给出差异；确认变化是有意的，就运行 `npm test -w @structura/core -- --test-update-snapshots`，把新快照和引起变化的代码一起提交。
- 测试共用的工具在 `@structura/testkit`（执行操作、按 RDKit 标准 SMILES 比较结构、模拟画布、边界测试的导入解析），只给测试用。
- `npm run check:dist -w chem-structura`：构建后按别的项目使用的方式检查 `dist/`：组件能在服务器上渲染（Next.js 等），`chem-structura/core` 在 Node 里能用，`core.js`、`standalone.js` 不引用包外的东西。
- 每次推送和 PR 由 GitHub Actions 检查：类型、lint（有警告即失败）、按包的单元测试、打包（含上一条）、端到端测试。本地 `git push` 前会自动跑类型检查、lint 和单元测试（`.githooks/pre-push`，`npm install` 时启用）。

## 化学核心 `@structura/core`

`packages/core` 是不带界面的化学核心：分子模型、操作层（ops）、MOL / SDF / `.structura` 读写、出图（SVG），以及通式的数据模型和校验（变量、可变连接、片段必须合法，操作层据此检查）。它只依赖自己的文件，不依赖 React 或浏览器，Node 里可以直接用（量标签宽度时有 canvas 就用，没有就估算）。

```ts
import { applyOps, emptyDrawing, toSdf } from "@structura/core"
import { enumerate } from "@structura/markush"

const result = applyOps(emptyDrawing(), [
  { op: "add_atom", el: "C", as: "c" },
  { op: "add_atom", el: "O", to: "c" },
])
if (result.ok) console.log(toSdf(enumerate(result.drawing).molecules))
```

公开的入口写在 `packages/core/package.json` 的 `exports` 里：根入口放常用的，细一些的工具在子路径下（`@structura/core/molecule`、`/draw`、`/ops`、`/types`…；`/markush` 只给 `@structura/markush` 用）。没列出的内部文件引用不到，TypeScript、Vite 和 Node 都会报错。

- 仓库内（编辑器、测试）通过 `structura-source` 条件直接用 TypeScript 源码，改了立即生效，不用先构建。
- 给别的项目用：`cd packages/core && npm run build`，生成 `dist/`（JavaScript 和类型声明）。
- 核心自己的测试在 `packages/core/tests`，`cd packages/core && npm test` 可以单独跑；根目录的 `npm test` 两边一起跑。

## 通式 `@structura/markush`

`packages/markush` 在 core 的通式数据模型之上做事：把通式展开成具体化合物（批量生成、代表结构、(R1)m 的位置组合）、从专利文字读出候选项、关于变量和位点的查询。它只依赖 core；core 反过来不依赖它，`packages/markush/tests/boundary.test.ts` 会检查这两点。core 里的通式模型也从这里导出，所以界面、engine、ai 只从 `@structura/markush` 导入通式相关的东西。

## 交互引擎 `@structura/engine`

`packages/engine` 是编辑器的“行为”，不含界面：编辑器状态（撤销历史、选中、工具设置，`createEditor()`，可订阅）、对选中部分的全部动作、鼠标手势（按下、移动、松开 → 预览和操作）、热点和悬停规则、按键路由和命令、悬停快捷键表、工具和它们的按键、命中检测、拖动吸附、双击的含义、视图的缩放平移换算，以及每个用户动作对应的操作（ops）。它只依赖 core 和 markush，不依赖 React 和浏览器，`packages/engine/tests/boundary.test.ts` 会检查这一点。前端（`src/editor`）只负责渲染、菜单和对话框，把鼠标和键盘事件交给它。以后嵌进 3D 编辑器，或让 agent 模拟用户操作，都用同一套规则。

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

## 深色主题

编辑器有浅色（默认）和深色两套配色，嵌入时用 `theme` 参数选（`"light"` / `"dark"` / `"auto"`；`"auto"` 跟随页面 `<html>` 上的 `data-theme` 或 `dark` 类，没有时跟随系统），给了 `onThemeChange` 就在“查看”菜单里让用户自己选。本应用把选择记在浏览器里，默认跟随系统。

界面的颜色仍按浅色写在组件里（Tailwind 类 `bg-(--c-f2f2f2)` 这样的写法），每个颜色是一个 CSS 变量：浅色就是它自己，深色由 `packages/react/src/components/theme.ts` 的 `darkColor` 算出，写在生成的 `styles/tokens.css` 里（加了新颜色后运行 `npm run tokens -w chem-structura`，没更新时有测试会失败）。画布、缩略图和使用说明里的图用同一套规则（化学结构的墨色用 `darkInk`，保证在深色底上看得清）。导出的文件始终是浅色。

## 化合物表导出 Word（chem2office）

通式工作区“生成结果”里，化合物按“编号”框里的格式编号（如 `C-{n}` → C-1、C-2…），“化合物表…”按专利的样子导出：每行几个结构，下面是编号，同一键长，缩写全部画出。Word 文档有两种：

- 本机有 [chem2office](../chem2office) 时，每个结构是可编辑的 ChemDraw 对象。开发和预览服务器上的 `POST /api/word`（`backend/src/word.ts`，Vite 插件 `structuraWord()`）把化合物表的包（zip，格式见 `packages/react/src/editor/markush/compoundTable.ts`）交给 chem2office 的命令行 `scripts.cli.structura_table_to_docx`，返回 .docx；`GET /api/word` 说明现在能不能做、不能的原因。
- 没有时，浏览器里生成图片版（`wordDocx.ts`），对话框里写明原因。

chem2office 默认在本仓库旁边找（`../chem2office`），也可以写在 `.env.local` 里：

```sh
# CHEM2OFFICE_DIR=/path/to/chem2office
# CHEM2OFFICE_PYTHON=/path/to/python   # 默认 python3，要能 import retain_cdx 和 pycdxml
```

嵌入时由宿主通过 `<Editor wordExport={…} />` 提供（本应用的实现是 `src/wordOverHttp.ts`）；不传时只有图片版。

## AI 填写通式 `@structura/ai`

变量面板里的“从专利文字填写…”（或菜单 AI → 从专利文字填写变量…）：粘贴权利要求中定义变量的文字，由大模型读出每个变量的候选项。回答先经 core 校验：认不出的标签、放不上的候选项、表达不了的部分（取代基范围、“相邻基团可成环”等）都会列出来。逐个勾选后应用，整个填写算一步，可以撤销。

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
- **从图片识别结构**（AI → 从图片识别结构…）：AI 以 agent 方式工作，每一轮返回一个动作（搭建 / 查看 / 重来 / 完成），服务器执行后把结果（查看时附渲染图）发回，直到完成或达到步数上限，每一步实时显示在对话框里。每轮只用普通消息和严格 JSON 输出，不依赖模型或网关的工具调用，所以兼容 Responses API 的网关都能用；网关过载（429/5xx）时自动重试。推理模型的思考强度可用 `OPENAI_REASONING_EFFORT`（low / medium / high）设置，不设时填写通式用 high、识别图片用 medium。只支持 Chat Completions 的服务器（如智谱 `https://open.bigmodel.cn/api/paas/v4`）设 `OPENAI_API=chat`（填写通式和识别图片都适用）。接口是 `POST /api/ai/structure`，按行返回 JSON 事件。
- 浏览器端不含任何 SDK，也拿不到 key。开发服务器通过 Vite 插件 `structuraAi()`（`@structura/ai/server`）在 `POST /api/ai/variables` 提供接口。别的 Node 服务器可以挂 `fillHandler()`。
- 嵌入时通过 `<Editor fillVariables={…} />` 指定怎么连到模型。不传就不显示这个按钮。
- `@structura/ai` 的根入口可以在浏览器里用：`requestFor` 构建请求，`reviewAnswer` 校验回答，`fillOps` 生成操作。

npm 脚本通过 `NODE_OPTIONS=--conditions=structura-source` 让 Vite 配置直接加载各个包的 TypeScript 源码。
