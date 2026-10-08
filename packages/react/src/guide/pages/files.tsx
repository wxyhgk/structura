import { Table } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const filesPage = definePage({
  id: "files",
  group: "文件",
  title: "保存、打开和导出",
  keywords: "自动保存 恢复 未保存 文件名 保存 打开 导出 SVG MOL SDF SMILES 粘贴 拖入 structura R-group R# 图片 PNG 复制为图片 Word PowerPoint",
  body: ({ mod }) => (
    <>
      <Table
        rows={[
          [`[${mod}][S] 保存`, "存成 .structura 文件，通式变量、可变连接、片段都在里面"],
          [`[${mod}][O] 打开`, "打开 .structura、MOL 或 SDF；也可以把文件直接拖进页面"],
          ["导出 SVG / MOL", "文件菜单；MOL 只含分子本身，不含通式变量的定义"],
          [`[${mod}][⇧][C] 复制为图片`, "编辑菜单；把图片放进剪贴板，粘贴到 Word、PowerPoint，不用先存文件"],
          ["导入 SMILES", "文件菜单，或把 SMILES 文本直接粘贴到画布上；第一次会下载 RDKit（约 2.4 MB）。接点 *:1、*:2（写在方括号里）读成变量 R1、R2，不带编号的 * 读成 R；MOL 里的 R# 也一样"],
          [`[${mod}][N] 新建`, "清空画布（可以撤销）"],
          ["文件名和未保存标记", "右上角显示打开或保存的文件名，有没保存的修改时带一个蓝点；保存和导出都用这个名字"],
          ["不怕刷新", "有没保存的修改时，关闭或刷新页面会先询问；浏览器里也会自动留一份副本，下次打开时顶部提示“恢复”"],
        ]}
      />
    </>
  ),
})
