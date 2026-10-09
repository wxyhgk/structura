import { H, P, Table } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const filesPage = definePage({
  id: "files",
  group: "文件",
  title: "保存、打开和导出",
  keywords: "自动保存 恢复 未保存 文件名 保存 打开 导出 SVG MOL SDF CDXML ChemDraw 专利 通式 SMILES 粘贴 拖入 structura R-group R# 图片 PNG 复制为图片 Word PowerPoint",
  body: ({ mod }) => (
    <>
      <Table
        rows={[
          [`[${mod}][S] 保存`, "存成 .structura 文件，通式变量、可变连接、片段都在里面"],
          [`[${mod}][O] 打开`, "打开 .structura、MOL 或 SDF；也可以把文件直接拖进页面"],
          ["导出 SVG / MOL", "文件菜单；MOL 含分子和方括号（重复单元连同它的次数范围、基团），不含通式变量的定义"],
          ["导出 CDXML", "文件菜单；给 ChemDraw 用的文件，通式也能完整带过去（见下）"],
          [`[${mod}][⇧][C] 复制为图片`, "编辑菜单；把图片放进剪贴板，粘贴到 Word、PowerPoint，不用先存文件"],
          ["导入 SMILES", "文件菜单，或把 SMILES 文本直接粘贴到画布上；第一次会下载 RDKit（约 2.4 MB）。接点 *:1、*:2（写在方括号里）读成变量 R1、R2，不带编号的 * 读成 R；MOL 里的 R# 也一样"],
          [`[${mod}][N] 新建`, "清空画布（可以撤销）"],
          ["文件名和未保存标记", "右上角显示打开或保存的文件名，有没保存的修改时带一个蓝点；保存和导出都用这个名字"],
          ["不怕刷新", "有没保存的修改时，关闭或刷新页面会先询问；浏览器里也会自动留一份副本，下次打开时顶部提示“恢复”"],
        ]}
      />
      <H>导出给 ChemDraw（CDXML）</H>
      <P>专利代理人和审查员多用 ChemDraw。文件 → 导出 CDXML 存成 .cdxml，用 ChemDraw 打开就是可以接着编辑的结构，不是图片。键长按 ChemDraw 的 ACS 1996 样式（14.4 pt），打开时就是期刊和专利常用的大小。</P>
      <Table
        rows={[
          ["原子和键", "元素、电荷、同位素、氢的个数，单键、双键、三键，楔形键和虚楔键，都和画布上一样"],
          ["缩写（Ph、Boc…）", "ChemDraw 里显示成同样的标签，里面的原子也都在，在 ChemDraw 里可以展开"],
          ["变量（R1、X、Ar…）", "写成 ChemDraw 的通用标签（generic nickname），数字按画布上的写法放低或抬高（R₁ / R¹）"],
          ["可变连接", "写成 ChemDraw 自己的“可变连接点”：从环中心连出的一根键，列出所有可以连接的原子；重复的写成 (R1)m"],
          ["方括号", "重复单元写成 ChemDraw 的 SRU 括号，右下角是次数的名字 n；基团括号也带过去"],
          ["定义", "每个变量的候选项、m 和 n 的次数范围、成环和附加条件，逐行写在结构下面，如“R1 = H、Cl、取代或未取代的(C1–C6)烷基”“n = 1–4”"],
        ]}
      />
      <P>ChemDraw 不会自己展开通式，定义只是结构下面的文字，可以在 ChemDraw 里直接改；要列出具体化合物，用通式工作区的“展开”。</P>
    </>
  ),
})
