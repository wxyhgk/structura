import { expanded, formula } from "../figures/markush.ts"
import { Figure } from "../ui/Figure.tsx"
import { Steps, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const enumeratePage = definePage({
  id: "enumerate",
  group: "通式（Markush）",
  title: "批量生成化合物",
  keywords: "批量生成 枚举 展开 代表结构 SDF 停止 上限 去重 重复 对称 库大小 计数 多少 筛选 CSV SMILES 放到画布 多个式子 式I 式II",
  body: () => (
    <>
      <Steps>
        <li>不用生成就能看到规模：面板底部实时显示“可展开为 N 种组合”；含基团类别时按代表结构计数，并注明实际范围更大。</li>
        <li>点面板底部的“批量生成化合物…”（结构菜单里也有）。</li>
        <li>一张画布上可以画几个式子（式 I、式 II……）：用键或可变连接连在一起、带变量的那一块算一个式子，各自展开，互不拼接，变量定义共用；旁边没有变量的普通分子不参与。生成的化合物标着“式 1”“式 2”，导出时多一列 Formula No。</li>
        <li>默认勾选“基团类别用代表结构展开”：烷基用甲基、乙基、异丙基、叔丁基，芳基用苯基、萘基等；不勾选时类别不展开。</li>
        <li>默认勾选“去掉重复的化合物”：环上对称的位置、(R1)m 里取 H 后相同的组合，只保留一个（按 RDKit 标准 SMILES 判断）。上方会写出共几种组合、得到几个不同的化合物、合并了几个。</li>
        <li>选择最多生成多少个（100 / 500 / 2000），组合太多时可以随时点“停止”。</li>
        <li>每个化合物下面写着各变量取了什么（如“R1 在 #1、#3，R1 = Cl、F”）；鼠标移上去点“放到画布”，就把它放在视图中间。</li>
        <li>上方的“筛选”框按分子式或取值筛，几个词都要满足（如 “Cl”、“R1=OMe C6H4”）。</li>
        <li>下载：SDF（每条记录带着各变量的取值和连接位置）、SMILES 或 CSV（编号、SMILES、分子式、分子量、各变量取值，可直接用 Excel 打开）。有筛选时只下载筛选出的；文件名跟着当前文档。</li>
      </Steps>
      <Figure panels={[{ drawing: formula(), caption: "通式" }, { drawing: expanded()[0], caption: "其中一个化合物" }]} steps={["批量生成"]} />
      <Tip>对话框上方的提示会说明哪些候选项放不下被跳过、哪些位置已被占用、哪些组合生成失败及原因。</Tip>
    </>
  ),
})
