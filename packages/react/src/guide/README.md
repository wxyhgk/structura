# 使用说明模块（src/guide）

编辑器里“帮助 → 使用说明”（F1）的全部内容：每一页的文字、页内的化学结构图、阅读用的对话框，以及打开指定页面的“?”链接。

## 结构

| 位置 | 内容 |
|---|---|
| `pages/<主题>.tsx` | 一页一个文件，用 `definePage({ id, group, title, keywords, body })` 定义 |
| `pages/index.ts` | 所有页面的顺序；`GuideTopic`（页面 id）由这里推导 |
| `figures/` | 页内的结构图，由 core 现场画出：`build.ts`（工具）、`drawing.ts`（绘图页）、`markush.ts`（通式页） |
| `ui/` | 写页面用的小部件：`parts.tsx`（段落、步骤、按键、提示框、表格）、`Figure.tsx`（结构图） |
| `GuideDialog.tsx`、`HelpLink.tsx` | 对话框和“?”链接 |
| `index.ts` | 对外入口，编辑器只从 `@/guide` 引用 |

## 依赖规则

这个模块只依赖 core、React 和 `@/components/ui`，不引用编辑器。它需要编辑器提供的东西（⌘ 还是 Ctrl、快捷键表、打开快捷键总表、对话框属性）通过 `GuideHost` 传进来，适配器在 `src/editor/shell/EditorGuide.tsx`。`tests/guide/boundary.test.ts` 会检查这条规则。

## 加一页

1. 在 `pages/` 新建 `<id>.tsx`，导出 `<id>Page = definePage({...})`。
2. 在 `pages/index.ts` 里 import，并放进 `PAGES` 的合适位置（同一 `group` 的放在一起）。
3. 需要结构图时，在 `figures/` 里用 `build(ops)` 画出来，在页面里用 `<Figure panels={...} />`；`tests/guide/figures.test.ts` 里加一条检查。
4. 想从界面某处直接打开这一页：放一个 `<HelpLink onClick={() => onHelp("<id>")} label="…" />`。

表格的第一列用方括号标按键：`` `[${mod}][Z]` `` 显示为 ⌘ Z 两个键帽。
